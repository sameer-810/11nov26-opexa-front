import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../shared/store/useAuthStore';
import { can, PERMS } from '../../shared/permissions';
import { formatDate, formatMoney, formatNumber, parseNumber, todayLocal } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { projectApi } from '../project/api/projectApi';
import { s, useAction, useData } from '../inventory/ui';
import { openPrint } from '../invoice/invoiceApi';
import { subcontractApi } from './subcontractApi';
import { WorkOrderForm } from './WorkOrderForm';
import { RetentionTab } from './RetentionTab';

type Props = NativeStackScreenProps<RootStackParamList, 'Subcontract'>;

export function SubcontractScreen({ navigation }: Props) {
  const { user } = useAuth();
  const pm = can(user, PERMS.PROJECT_MANAGE);
  const finance = can(user, PERMS.SUPPLIER_INVOICE_VERIFY);
  const [tab, setTab] = useState('work');
  const fetcher = useCallback(async () => {
    const [subs, agreements, wos, progress, certs, summary, projects] = await Promise.all([subcontractApi.subcontractors(), subcontractApi.agreements(), subcontractApi.workOrders(), subcontractApi.progress('?status=submitted,verified'), subcontractApi.certificates(), subcontractApi.summary(), projectApi.list().catch(() => [])]);
    return { subs, agreements, wos, progress, certs, summary, projects };
  }, []);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  if (error) return <AppScreen title="Subcontractors" onBack={() => navigation.navigate('Dashboard')}><ErrorState message={error} onRetry={reload} /></AppScreen>;
  const subName = (sid: string) => data?.subs.find((x) => x.id === sid)?.name ?? '—';
  const lineOf = (woId: string, lineId: string) => data?.wos.find((w) => w.id === woId)?.lines.find((l) => l.id === lineId);

  return (
    <AppScreen title="Subcontractors" subtitle="Work orders, verified progress and payment certificates — pay only for approved work" onBack={() => navigation.navigate('Dashboard')} testID="subcontract-screen">
      <ChoiceChips label="Section" options={[{ value: 'work', label: 'Work orders' }, { value: 'progress', label: `Progress${data?.progress.length ? ` (${data.progress.length})` : ''}` }, { value: 'pay', label: 'Certificates' }, { value: 'retention', label: 'Retention & register' }, { value: 'setup', label: 'Subcontractors' }]} value={tab} onChange={setTab} testID="sc-tab" />
      {problem ? <ErrorBanner message={problem} testID="sc-problem" /> : null}
      {data && tab === 'work' ? (
        <View style={s.list}>
          {pm && data.agreements.length ? <WorkOrderForm agreements={data.agreements} onSave={(fn) => void run('wo', fn)} busy={busy === 'wo'} /> : null}
          {data.wos.map((w) => (
            <View key={w.id} style={s.card} testID={`wo-${w.number}`}>
              <View style={s.row}><Text style={s.number}>{w.number}</Text><StatusChip label={w.status.replace('_', ' ')} tone={w.status === 'approved' ? 'success' : 'warning'} /><Text style={s.muted}>{subName(w.subcontractorId)} · {formatMoney(w.value)} · done {w.progressPct}%</Text></View>
              {w.lines.map((l) => (
                <View key={l.id} style={s.row}>
                  <Text style={[s.muted, s.cell]}>S.No {l.serialNo} {l.description}: {formatNumber(l.approvedQty)}/{formatNumber(l.qty)} {l.unit} approved @ {formatMoney(l.rate)} · pending {formatNumber(l.pendingQty)}</Text>
                  {w.status === 'approved' && l.enteredQty < l.qty ? (
                    <>
                      <TextField label="Done today" value={f[`p-${l.id}`] ?? ''} onChangeText={set(`p-${l.id}`)} keyboardType="decimal-pad" testID={`wo-enter-${w.number}-${l.serialNo}`} />
                      <Button title="Record work" variant="outline" onPress={() => run(`e-${l.id}`, async () => { await subcontractApi.addProgress({ workOrderId: w.id, lineId: l.id, date: todayLocal(), qty: parseNumber(f[`p-${l.id}`] ?? '') ?? 0 }); setF((x) => ({ ...x, [`p-${l.id}`]: '' })); })} loading={busy === `e-${l.id}`} testID={`wo-save-${w.number}-${l.serialNo}`} />
                    </>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
          {!data.wos.length ? <Text style={s.muted}>No work orders yet. Create a subcontractor and agreement first.</Text> : null}
        </View>
      ) : null}
      {data && tab === 'progress' ? (
        <View style={s.list}>
          {data.progress.map((p) => {
            const l = lineOf(p.workOrderId, p.lineId);
            return (
              <View key={p.id} style={s.card} testID={`prog-${p.id}`}>
                <Text style={s.title}>{formatDate(p.date)} · S.No {l?.serialNo} {l?.description}: {formatNumber(p.qty)} {l?.unit}{p.verifiedQty != null ? ` · verified ${formatNumber(p.verifiedQty)}` : ''}</Text>
                <StatusChip label={p.status} tone={p.status === 'verified' ? 'info' : 'warning'} />
                <View style={s.row}>
                  <TextField label="Quantity accepted" value={f[`q-${p.id}`] ?? ''} onChangeText={set(`q-${p.id}`)} keyboardType="decimal-pad" placeholder={String(p.verifiedQty ?? p.qty)} />
                  {p.status === 'submitted' ? <Button title="Verify at site" onPress={() => run(`v-${p.id}`, () => subcontractApi.review(p.id, 'verify', parseNumber(f[`q-${p.id}`] ?? '') ?? undefined))} testID={`prog-verify-${p.id}`} /> : null}
                  {p.status === 'verified' && pm ? <Button title="Approve" onPress={() => run(`a-${p.id}`, () => subcontractApi.review(p.id, 'approve', parseNumber(f[`q-${p.id}`] ?? '') ?? undefined))} testID={`prog-approve-${p.id}`} /> : null}
                  <Button title="Reject" variant="ghost" onPress={() => run(`r-${p.id}`, () => subcontractApi.review(p.id, 'reject', undefined, 'Rejected at review'))} />
                </View>
              </View>
            );
          })}
          {!data.progress.length ? <Text style={s.muted}>Nothing waiting for verification or approval.</Text> : null}
        </View>
      ) : null}
      {data && tab === 'pay' ? (
        <View style={s.list}>
          {data.summary.rows.map((r) => <Text key={r.subcontractorId} style={s.muted} testID={`sc-sum-${r.name}`}>{r.name}: ordered {formatMoney(r.orderedValue)} · done {formatMoney(r.approvedValue)} · certified {formatMoney(r.certifiedGross)} · retention held {formatMoney(r.retentionHeld)}{r.retentionReleased ? ` (released ${formatMoney(r.retentionReleased)})` : ''} · advance balance {formatMoney(r.advanceBalance)} · paid {formatMoney(r.paid)} · outstanding {formatMoney(r.outstanding)}{r.uncertifiedApprovedValue ? ` · approved, not yet certified ${formatMoney(r.uncertifiedApprovedValue)}` : ''}</Text>)}
          {pm ? data.wos.filter((w) => w.status === 'approved').map((w) => <Button key={w.id} title={`Certify approved work on ${w.number}`} variant="outline" onPress={() => run(`c-${w.id}`, () => subcontractApi.certify(w.id))} loading={busy === `c-${w.id}`} testID={`certify-${w.number}`} />) : null}
          {data.certs.map((c) => (
            <View key={c.id} style={s.card} testID={`cert-${c.number}`}>
              <View style={s.row}><Text style={s.number}>{c.number}</Text><StatusChip label={c.status.replace('_', ' ')} tone={c.status === 'approved' ? 'success' : 'neutral'} /><Button title="Print / PDF" variant="ghost" onPress={() => run(`print-${c.id}`, async () => openPrint((await subcontractApi.certificatePrintLink(c.id)).url))} testID={`cert-print-${c.number}`} /></View>
              {(c.lines ?? []).map((l, i) => <Text key={i} style={s.muted} testID={`cert-line-${c.number}-${i}`}>{l.description}: {formatNumber(l.qty)} {l.unit} certified{l.reportedQty != null ? ` (${formatNumber(l.qty)} of ${formatNumber(l.reportedQty)} reported)` : ''} @ {formatMoney(l.rate)} = {formatMoney(l.amount)}</Text>)}
              <Text style={s.muted}>Gross {formatMoney(c.gross)} − retention {formatMoney(c.retention)} − advance {formatMoney(c.advanceRecovery)} = net {formatMoney(c.net)} · paid {formatMoney(c.paid)} · outstanding {formatMoney(c.outstanding)}</Text>
              {finance && c.outstanding > 0 ? (
                <View style={s.row}>
                  <TextField label="Pay amount" value={f[`pay-${c.id}`] ?? ''} onChangeText={set(`pay-${c.id}`)} keyboardType="decimal-pad" testID={`pay-${c.number}`} />
                  <Button title="Record payment" onPress={() => run(`pay-${c.id}`, () => subcontractApi.pay(c.id, parseNumber(f[`pay-${c.id}`] ?? '') ?? 0))} testID={`pay-save-${c.number}`} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {data && tab === 'retention' ? <RetentionTab agreements={data.agreements} subs={data.subs} pm={pm} finance={finance || pm} /> : null}
      {data && tab === 'setup' ? (
        <View style={s.list}>
          <View style={s.form}>
            <Text style={s.title}>New subcontractor</Text>
            <View style={s.row}>
              <View style={s.cell}><TextField label="Name" value={f.sname ?? ''} onChangeText={set('sname')} testID="sc-name" /></View>
              <View style={s.cell}><TextField label="Phone" value={f.sphone ?? ''} onChangeText={set('sphone')} /></View>
              <View style={s.cell}><TextField label="GSTIN" value={f.sgst ?? ''} onChangeText={set('sgst')} autoCapitalize="characters" /></View>
            </View>
            <Button title="Save" onPress={() => run('sub', () => subcontractApi.createSubcontractor({ name: f.sname ?? '', phone: f.sphone || undefined, gstin: f.sgst || undefined }))} loading={busy === 'sub'} testID="sc-save" />
          </View>
          {pm ? (
            <View style={s.form}>
              <Text style={s.title}>New agreement</Text>
              <ChoiceChips label="Subcontractor" options={data.subs.map((x) => ({ value: x.id, label: x.name }))} value={f.asub ?? ''} onChange={set('asub')} testID="ag-sub" />
              <ChoiceChips label="Project" options={data.projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} value={f.aproj ?? ''} onChange={set('aproj')} testID="ag-proj" />
              <View style={s.row}>
                <View style={s.cell}><TextField label="Title" value={f.atitle ?? ''} onChangeText={set('atitle')} testID="ag-title" /></View>
                <View style={s.cell}><TextField label="Retention %" value={f.aret ?? ''} onChangeText={set('aret')} keyboardType="decimal-pad" /></View>
                <View style={s.cell}><TextField label="Advance recovery %" value={f.aadv ?? ''} onChangeText={set('aadv')} keyboardType="decimal-pad" /></View>
                <View style={s.cell}><TextField label="DLP ends on (YYYY-MM-DD)" value={f.adlp ?? ''} onChangeText={set('adlp')} testID="ag-dlp" /></View>
              </View>
              <Button title="Save agreement" onPress={() => run('ag', () => subcontractApi.createAgreement({ subcontractorId: f.asub ?? '', projectId: f.aproj ?? '', title: f.atitle ?? '', retentionPct: parseNumber(f.aret ?? '') ?? 0, advanceRecoveryPct: parseNumber(f.aadv ?? '') ?? 0, ...(f.adlp ? { dlpEndsOn: f.adlp } : {}) }))} loading={busy === 'ag'} testID="ag-save" />
            </View>
          ) : null}
          {data.subs.map((x) => <Text key={x.id} style={s.muted}>{x.code} · {x.name}{x.gstin ? ` · ${x.gstin}` : ''}</Text>)}
          {data.agreements.map((a) => <Text key={a.id} style={s.muted}>{a.number} · {subName(a.subcontractorId)} · {a.title} · retention {a.retentionPct}% · advance recovery {a.advanceRecoveryPct}%</Text>)}
        </View>
      ) : null}
    </AppScreen>
  );
}
