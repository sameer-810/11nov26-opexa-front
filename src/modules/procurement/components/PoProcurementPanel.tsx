import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../../navigation/types';
import { formatDate, formatMoney, formatNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { procurementApi } from '../api/procurementApi';
import { label } from '../types';
import { History, Section, errorText, printDoc, styles, useLoad } from '../ui';
import { FollowUpForm } from './FollowUpForm';
import { RevisionForm } from './RevisionForm';
import { SupplierInvoiceForm } from './SupplierInvoiceForm';

// Phase 3 additions on the PO screen: GST totals, GRN-wise delivery, revisions, follow-ups, invoices, print.
export function PoProcurementPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const fetcher = useCallback(() => procurementApi.po(id), [id]);
  const { data: po, error, reload } = useLoad(fetcher);
  const [mode, setMode] = useState<'' | 'revise' | 'followup' | 'invoice'>('');
  const [problem, setProblem] = useState('');
  const done = () => { setMode(''); void reload(); onChanged(); };
  if (error) return <ErrorBanner message={error} />;
  if (!po) return null;

  return (
    <View style={styles.list} testID="po-procurement">
      {problem ? <ErrorBanner message={problem} /> : null}
      <View style={styles.row}>
        {po.revision ? <StatusChip label={`Revision ${po.revision}`} tone="info" /> : null}
        {po.pendingRevisionId ? <StatusChip label="Revision awaiting approval" tone="warning" /> : null}
        {po.overdue ? <StatusChip label="Delivery overdue" tone="danger" /> : null}
        <StatusChip label={label(po.receiptStatus)} tone={po.receiptStatus === 'received' ? 'success' : 'neutral'} testID="po-receipt-status" />
      </View>
      <Text style={styles.muted}>{po.requisitionNumbers.join(', ')}{po.rfqNumber ? ` · ${po.rfqNumber}` : ''} · taxable {formatMoney(po.taxable)} + GST {formatMoney(po.gst)}{po.igst ? ' (IGST)' : ' (CGST/SGST)'}{po.freight ? ` + freight ${formatMoney(po.freight)}` : ''} = {formatMoney(po.total)}{po.paymentTerms ? ` · ${po.paymentTerms}` : ''}</Text>
      <View style={styles.row}>
        <Button title="Print / PDF" variant="outline" onPress={() => printDoc('po', id).catch((e) => setProblem(errorText(e)))} testID="po-print" />
        {po.status === 'issued' && !po.pendingRevisionId ? <Button title="Revise PO" variant="outline" onPress={() => setMode('revise')} testID="po-revise" /> : null}
        {po.status === 'issued' ? <Button title="Log follow-up" variant="outline" onPress={() => setMode('followup')} testID="po-followup" /> : null}
        {['issued', 'closed'].includes(po.status) ? <Button title="Book supplier invoice" variant="outline" onPress={() => setMode('invoice')} testID="po-invoice" /> : null}
      </View>
      {mode === 'revise' ? <RevisionForm po={po} onSaved={done} onCancel={() => setMode('')} /> : null}
      {mode === 'followup' ? <FollowUpForm purchaseOrderId={id} onSaved={done} onCancel={() => setMode('')} /> : null}
      {mode === 'invoice' ? <SupplierInvoiceForm po={po} onSaved={(inv) => { done(); navigation.navigate('SupplierInvoiceDetail', { id: inv.id }); }} onCancel={() => setMode('')} /> : null}
      <Section title="Delivery against goods receipts">
        {po.lines.map((l) => (
          <Text key={l.id} style={styles.muted} testID={`po-delivery-${l.serialNo}`}>
            S.No {l.serialNo}: ordered {formatNumber(l.delivery.ordered)} · sent {formatNumber(l.delivery.sent)} · in transit {formatNumber(l.delivery.inTransit)} · accepted {formatNumber(l.delivery.accepted)} · damaged {formatNumber(l.delivery.damaged)} · short {formatNumber(l.delivery.short)} · pending {formatNumber(l.delivery.pending)} {l.unit}{l.cancelledQty ? ` · short-closed ${formatNumber(l.cancelledQty)}` : ''}
          </Text>
        ))}
      </Section>
      {po.revisions.length ? (
        <Section title="Revisions">
          {po.revisions.map((r) => <Text key={r.id} style={styles.muted}>Rev {r.revisionNo} · {label(r.status)} · {r.reason} — {r.changes.map((c) => `${c.field}: ${String(c.from ?? '—').slice(0, 10)} → ${String(c.to ?? '—').slice(0, 10)}`).join('; ')}</Text>)}
        </Section>
      ) : null}
      {po.followUps.length ? (
        <Section title="Supplier follow-ups">
          {po.followUps.map((f) => <Text key={f.id} style={styles.muted}>{formatDate(f.followUpDate)} · {f.method} · {label(f.status)} · {f.remarks}{f.supplierResponse ? ` — ${f.supplierResponse}` : ''}{f.nextFollowUpDate ? ` · next ${formatDate(f.nextFollowUpDate)}` : ''} ({f.responsible.name})</Text>)}
        </Section>
      ) : null}
      <History rows={po.history} />
    </View>
  );
}
