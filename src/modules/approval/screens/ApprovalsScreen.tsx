import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { TextField } from '../../../shared/ui/TextField';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { ApiError } from '../../../shared/api/apiClient';
import { formatDate, formatMoney, formatNumber } from '../../../shared/format';
import { ForwardApproval } from '../components/ForwardApproval';
import { approvalApi, type ApprovalAction, type ApprovalDetail, type PendingApproval } from '../api/approvalApi';
import { decisionsFor, draftsFor, RequisitionLineDecisions, type LineDraft } from '../components/RequisitionLineDecisions';
import { AttachmentList } from '../../requisition/components/Attachments';
import { requisitionApi } from '../../requisition/api/requisitionApi';
import { expenseApi } from '../../expense/expenseApi';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { useAuth } from '../../../shared/store/useAuthStore';
import { can, PERMS } from '../../../shared/permissions';
import { ApprovalHistory } from '../components/ApprovalHistory';
import { StockAvailabilityPanel } from '../../stockPlan/StockAvailabilityPanel';
import { SupplierPaymentApprovalDetails } from '../../supplierPayment/components/SupplierPaymentApprovalDetails';

type Props = NativeStackScreenProps<RootStackParamList, 'Approvals'>;
const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function Details({ d }: { d: ApprovalDetail['details'] }) {
  if (!d) return null;
  if (d.kind === 'supplier_selection') return <View style={styles.gap}><Text style={styles.text}>Why: {d.justification}</Text>{d.allocations?.map((a, i) => <Text key={i} style={styles.text}>S.No {a.serialNo} {a.description}: {formatNumber(a.qty)} {a.unit} from {a.vendorName} @ {formatMoney(a.rate)} = {formatMoney(a.amount)}{a.lowest ? '' : ' (not the lowest)'}</Text>)}</View>;
  if (d.kind === 'expense') return (
    <View style={styles.gap} testID="approval-expense">
      <Text style={styles.text}>{d.employee?.name} · {d.category} · {formatMoney(d.amount ?? 0)}</Text>
      <Text style={styles.text}>{formatDate(d.date)} · {d.projectCode ? `${d.projectCode} ${d.projectName}` : 'Office expense'}{d.billNo ? ` · bill ${d.billNo}` : ''}</Text>
      {d.note ? <Text style={styles.text}>{d.note}</Text> : null}
      {d.attachments?.length ? null : <Text style={styles.text}>No receipt attached (category needs none)</Text>}
    </View>
  );
  if (d.kind === 'over_receipt') return (
    <View style={styles.gap} testID="approval-over-receipt">
      <Text style={styles.text}>{d.poNumber} · Lot {d.lotNo} · challan {d.challanNo} · Reason: {d.reason}</Text>
      {d.excess?.map((l, i) => <Text key={i} style={styles.text}>S.No {l.serialNo} {l.description}: {formatNumber(l.qty)} {l.unit} extra (PO {l.ordered === null ? '—' : formatNumber(l.ordered)}) @ {formatMoney(l.rate)}</Text>)}
      <Text style={styles.text}>Approve to raise the PO and take it into stock; reject to return it to the supplier.</Text>
    </View>
  );
  if (d.kind === 'supplier_payment') return <SupplierPaymentApprovalDetails d={d} />;
  if (d.kind === 'early_billing') return <View style={styles.gap} testID="approval-early-billing"><Text style={styles.text}>{d.projectCode} {d.projectName} · {d.label}: {d.slab}</Text><Text style={styles.text}>Billing {formatMoney(d.amount ?? 0)} of the {formatMoney(d.planAmount ?? 0)} slab before it is marked complete. Reason: {d.reason}</Text></View>;
  if (d.kind === 'credit_note') return <View style={styles.gap} testID="approval-credit-note"><Text style={styles.text}>{d.label}: {d.noteKind === 'credit' ? 'credit' : 'debit'} note to {d.party} against {d.against}</Text>{d.noteLines?.map((l, i) => <Text key={i} style={styles.text}>{l.description}: {formatNumber(l.qty)} × {formatMoney(l.rate)} = {formatMoney(l.amount)} (GST {l.gstRate}%)</Text>)}<Text style={styles.text}>Taxable {formatMoney(d.taxable ?? 0)} + GST {formatMoney(d.gst ?? 0)} = {formatMoney(d.total ?? 0)}. Reason: {d.reason}</Text></View>;
  if (d.kind === 'po_revision') return <View style={styles.gap}><Text style={styles.text}>Reason: {d.reason}</Text>{d.changes?.map((c, i) => <Text key={i} style={styles.text}>{c.field}: {String(c.from ?? '—').slice(0, 10)} → {String(c.to ?? '—').slice(0, 10)}</Text>)}</View>;
  return (
    <View style={styles.gap}>
      <Text style={styles.text}>{[d.priority && `Priority ${d.priority}`, d.department, d.neededBy && `Required by ${formatDate(d.neededBy)}`].filter(Boolean).join(' · ')}</Text>
      {d.deliveryAddress ? <Text style={styles.text}>Deliver to: {d.deliveryAddress}</Text> : null}
      {d.note ? <Text style={styles.text}>Remarks: {d.note}</Text> : null}
    </View>
  );
}

type Tab = 'waiting' | 'completed';

export function ApprovalsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('waiting');
  const [items, setItems] = useState<PendingApproval[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<ApprovalDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [comment, setComment] = useState('');
  const [problem, setProblem] = useState('');
  const [acting, setActing] = useState('');
  const load = useCallback(async () => {
    setError(''); setItems(null);
    try { setItems(await (tab === 'waiting' ? approvalApi.pending() : approvalApi.completed())); } catch (e) { setError(message(e, 'Could not load approvals')); }
  }, [tab]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const expand = async (id: string) => {
    setProblem(''); setComment('');
    try {
      const d = await approvalApi.get(id);
      setOpen(d);
      setDrafts(draftsFor(d.details?.lines ?? []));
    } catch (e) { setProblem(message(e, 'Could not open')); }
  };
  const act = async (id: string, action: ApprovalAction) => {
    if (action !== 'approve' && comment.trim().length < 1) return setProblem('Give a reason for rejecting or sending back');
    const lines = open?.id === id && action === 'approve' ? decisionsFor(open.details?.lines ?? [], drafts) : [];
    if (typeof lines === 'string') return setProblem(lines);
    setActing(`${id}:${action}`); setProblem('');
    try { await approvalApi.act(id, action, comment.trim() || undefined, lines.length ? lines : undefined); setOpen(null); await load(); } catch (e) { setProblem(message(e, 'Try again')); } finally { setActing(''); }
  };

  return (
    <AppScreen
      title="My approvals"
      onBack={() => navigation.navigate('Dashboard')}
      right={
        <View style={styles.row}>
          <Button title="Delegate" variant="ghost" onPress={() => navigation.navigate('Delegations')} testID="open-delegations" />
          {can(user, PERMS.APPROVAL_MANAGE) ? <Button title="Settings" variant="ghost" onPress={() => navigation.navigate('ApprovalSettings')} testID="open-approval-settings" /> : null}
        </View>
      }
      testID="approvals-screen"
    >
      <ChoiceChips label="Show" value={tab} onChange={(v) => { setOpen(null); setTab(v as Tab); }} options={[{ value: 'waiting', label: 'Waiting for me' }, { value: 'completed', label: 'Completed by me' }]} testID="approvals-tab" />
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!items && !error ? <ActivityIndicator /> : null}
      {items?.length === 0 ? <EmptyState title={tab === 'waiting' ? 'No approvals waiting' : 'Nothing decided by you yet'} /> : null}
      {problem ? <ErrorBanner message={problem} testID="approval-problem" /> : null}
      <View style={styles.list}>
        {items?.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.title}>{item.transactionNumber}</Text>
            <Text style={[styles.text, styles.cap]}>{item.transactionType.replace(/_/g, ' ')} · {tab === 'waiting' ? `Level ${item.currentSequence}` : item.status.replace(/_/g, ' ')} · {formatMoney(item.amount)}</Text>
            <ApprovalHistory items={item.history ?? []} testID={`history-${item.id}`} />
            {tab === 'completed' ? null : open?.id === item.id ? (
              <View style={styles.gap}>
                <Details d={open.details} />
                {open.details?.kind === 'requisition' && open.details.requisitionId ? <StockAvailabilityPanel requisitionId={open.details.requisitionId} /> : null}
                {open.details?.lines ? <RequisitionLineDecisions lines={open.details.lines} drafts={drafts} onChange={(lineId, d) => setDrafts((x) => ({ ...x, [lineId]: d }))} /> : null}
                {open.details?.requisitionId && open.details.attachments?.length ? <AttachmentList items={open.details.attachments} onError={setProblem} fetchFile={(a) => requisitionApi.downloadAttachment(open.details?.requisitionId ?? '', a)} /> : null}
                {open.details?.expenseId && open.details.attachments?.length ? <AttachmentList items={open.details.attachments} onError={setProblem} fetchFile={(a) => expenseApi.downloadAttachment(open.details?.expenseId ?? '', a)} /> : null}
                <TextField label="Comment (required to reject or send back)" value={comment} onChangeText={setComment} testID="approval-comment" />
                <View style={styles.row}>
                  <Button title="Approve" onPress={() => act(item.id, 'approve')} loading={acting === `${item.id}:approve`} testID={`approve-${item.id}`} />
                  <Button title="Send back" variant="outline" onPress={() => act(item.id, 'send_back')} loading={acting === `${item.id}:send_back`} />
                  <Button title="Reject" variant="ghost" onPress={() => act(item.id, 'reject')} loading={acting === `${item.id}:reject`} testID={`reject-${item.id}`} />
                </View>
                <ForwardApproval approvalId={item.id} onDone={() => { setOpen(null); void load(); }} />
              </View>
            ) : <Button title="Review" variant="outline" onPress={() => expand(item.id)} testID={`review-${item.id}`} />}
          </View>
        ))}
      </View>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  list: { gap: spacing.sm }, gap: { gap: spacing.sm }, flex: { flexGrow: 1, flexBasis: 200 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text }, text: { color: colors.textMuted }, cap: { textTransform: 'capitalize' },
});
