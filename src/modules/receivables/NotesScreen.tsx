import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../shared/store/useAuthStore';
import { can, PERMS } from '../../shared/permissions';
import { formatDate, formatMoney, parseNumber, todayLocal } from '../../shared/format';
import { AppScreen } from '../../shared/ui/AppScreen';
import { Button } from '../../shared/ui/Button';
import { ChoiceChips } from '../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import { invoiceApi, openPrint } from '../invoice/invoiceApi';
import { procurementApi } from '../procurement/api/procurementApi';
import { projectApi } from '../project/api/projectApi';
import { s, useAction, useData } from '../inventory/ui';
import { notesApi, type Note, type NoteIn, type NoteRequest } from './receivablesApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Notes'>;
type LineDraft = { description: string; qty: string; rate: string; gstRate: string; hsnSac: string };
const blankLine = (): LineDraft => ({ description: '', qty: '1', rate: '', gstRate: '18', hsnSac: '' });
const TONE: Record<Note['status'], 'success' | 'info' | 'danger' | 'neutral' | 'warning'> = { issued: 'success', pending_approval: 'info', sent_back: 'warning', rejected: 'danger', cancelled: 'neutral' };

// 4D: credit / debit notes (client and supplier), AMC cancellation requests, approval status, print and cancel.
export function NotesScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const client = can(user, PERMS.INVOICE_CREATE) || can(user, PERMS.INVOICE_EDIT);
  const supplier = can(user, PERMS.SUPPLIER_INVOICE_VERIFY);
  const fetcher = useCallback(async () => ({
    notes: await notesApi.list(),
    requests: client ? await notesApi.requests() : [],
    invoices: client ? (await invoiceApi.list()).filter((i) => i.status === 'issued') : [],
    projects: client ? await projectApi.list() : [],
    supplierInvoices: supplier ? await procurementApi.invoices({ status: 'approved' }) : [],
  }), [client, supplier]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [side, setSide] = useState<'client' | 'supplier'>(client ? 'client' : 'supplier');
  const [kind, setKind] = useState<'credit' | 'debit'>('credit');
  const [against, setAgainst] = useState(route.params?.invoiceId ?? '');
  const [requestId, setRequestId] = useState('');
  const [reason, setReason] = useState('');
  const [noteDate, setNoteDate] = useState(todayLocal());
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [cancelWhy, setCancelWhy] = useState<Record<string, string>>({});
  if (error) return <AppScreen title="Credit & debit notes" onBack={() => navigation.navigate('ClientReceipts')}><ErrorState message={error} onRetry={reload} /></AppScreen>;

  const fromRequest = (r: NoteRequest) => {
    setSide('client'); setKind('credit'); setAgainst(r.prefill.invoiceId ?? ''); setRequestId(r.id); setReason(r.prefill.reason);
    setLines(r.prefill.lines.map((l) => ({ description: l.description, qty: String(l.qty), rate: String(l.rate), gstRate: String(l.gstRate ?? 18), hsnSac: l.hsnSac ?? '' })));
  };
  const setLine = (i: number, k: keyof LineDraft) => (v: string) => setLines((x) => x.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const projectChoice = against.startsWith('project:') ? against.slice(8) : '';
  const body = (): NoteIn => ({
    side, kind: side === 'supplier' ? 'debit' : kind, noteDate, reason: reason.trim(), ...(requestId ? { requestId } : {}),
    ...(side === 'supplier' ? { supplierInvoiceId: against } : projectChoice ? { projectId: projectChoice } : { invoiceId: against }),
    lines: lines.map((l) => ({ description: l.description.trim(), qty: parseNumber(l.qty) ?? 1, rate: parseNumber(l.rate) ?? 0, gstRate: parseNumber(l.gstRate) ?? 18, hsnSac: l.hsnSac.trim() || undefined })),
  });
  const save = () => run('save', async () => { await notesApi.create(body()); setLines([blankLine()]); setReason(''); setRequestId(''); });
  const targets = side === 'supplier'
    ? (data?.supplierInvoices ?? []).slice(0, 40).map((i) => ({ value: i.id, label: `${i.number} · ${i.vendor?.name ?? ''} · ${formatMoney(i.total)}` }))
    : [...(data?.invoices ?? []).slice(0, 40).map((i) => ({ value: i.id, label: `${i.label} · ${i.client.name} · ${formatMoney(i.total)}` })), ...(data?.projects ?? []).map((p) => ({ value: `project:${p.id}`, label: `On account: ${p.code} ${p.name}` }))];

  return (
    <AppScreen title="Credit & debit notes" subtitle="Corrections to issued invoices after Tally export, goods returned to suppliers; each note goes through approval" onBack={() => navigation.navigate('ClientReceipts')} testID="notes-screen">
      {problem ? <ErrorBanner message={problem} testID="notes-problem" /> : null}
      {data?.requests.length ? (
        <View style={s.card} testID="note-requests">
          <Text style={s.title}>AMC cancelled: credit notes to raise</Text>
          {data.requests.map((r) => (
            <View key={r.id} style={s.row} testID={`note-request-${r.sourceNumber}`}>
              <Text style={[s.muted, s.cell]}>{r.sourceNumber} · {r.invoice?.number} ({r.invoice?.client}) · suggested {formatMoney(r.suggestedAmount)} + GST · {r.reason}</Text>
              <Button title="Raise credit note" variant="outline" onPress={() => fromRequest(r)} testID={`note-request-raise-${r.sourceNumber}`} />
            </View>
          ))}
        </View>
      ) : null}
      {client || supplier ? (
        <View style={s.form} testID="note-form">
          {client && supplier ? <ChoiceChips label="Party" value={side} onChange={(v) => { setSide(v as 'client' | 'supplier'); setAgainst(''); }} options={[{ value: 'client', label: 'Client' }, { value: 'supplier', label: 'Supplier (goods returned / short)' }]} testID="note-side" /> : null}
          {side === 'client' ? <ChoiceChips label="Note" value={kind} onChange={(v) => setKind(v as 'credit' | 'debit')} options={[{ value: 'credit', label: 'Credit note (reduce)' }, { value: 'debit', label: 'Debit note (increase)' }]} testID="note-kind" /> : <Text style={s.muted}>Debit note to the supplier: reduces what is payable on the invoice.</Text>}
          <ChoiceChips label={side === 'supplier' ? 'Supplier invoice' : 'Against invoice (or on account)'} value={against} onChange={setAgainst} options={targets} testID="note-against" />
          <View style={s.row}>
            <View style={s.cell}><TextField label="Note date (YYYY-MM-DD)" value={noteDate} onChangeText={setNoteDate} /></View>
            <View style={s.cell}><TextField label="Reason" value={reason} onChangeText={setReason} testID="note-reason" /></View>
          </View>
          {lines.map((l, i) => (
            <View key={i} style={s.row}>
              <View style={s.cell}><TextField label={`Line ${i + 1} description`} value={l.description} onChangeText={setLine(i, 'description')} testID={`note-line-${i}`} /></View>
              <TextField label="Qty" value={l.qty} onChangeText={setLine(i, 'qty')} keyboardType="decimal-pad" />
              <TextField label="Rate / lump sum ₹" value={l.rate} onChangeText={setLine(i, 'rate')} keyboardType="decimal-pad" testID={`note-rate-${i}`} />
              <TextField label="GST %" value={l.gstRate} onChangeText={setLine(i, 'gstRate')} keyboardType="decimal-pad" />
              <TextField label="HSN/SAC" value={l.hsnSac} onChangeText={setLine(i, 'hsnSac')} keyboardType="number-pad" />
            </View>
          ))}
          <View style={s.row}>
            <Button title="Add line" variant="ghost" onPress={() => setLines((x) => [...x, blankLine()])} />
            <Button title={requestId ? 'Raise credit note for the AMC request' : 'Submit for approval'} onPress={save} loading={busy === 'save'} testID="note-save" />
          </View>
        </View>
      ) : null}
      {data?.notes.map((n) => (
        <View key={n.id} style={s.card} testID={`note-${n.label}`}>
          <View style={s.row}><Text style={s.title}>{n.label} · {n.kind === 'credit' ? 'Credit' : 'Debit'} note · {n.party?.name}</Text><StatusChip label={n.status.replace('_', ' ')} tone={TONE[n.status]} /></View>
          <Text style={s.muted}>{formatDate(n.noteDate)} · {n.invoice?.number ?? n.supplierInvoice?.number ?? 'on account'} · taxable {formatMoney(n.taxable)} · GST {formatMoney(n.cgst + n.sgst + n.igst)} · total {formatMoney(n.total)}</Text>
          <Text style={s.muted}>{n.reason}{n.cancelled ? ` · cancelled: ${n.cancelled.reason}` : ''}</Text>
          <View style={s.row}>
            <Button title="Print" variant="outline" onPress={() => run(`p-${n.id}`, async () => openPrint((await notesApi.printLink(n.id)).url))} />
            {['issued', 'rejected', 'sent_back'].includes(n.status) ? <><TextField label="Cancel reason" value={cancelWhy[n.id] ?? ''} onChangeText={(v) => setCancelWhy((x) => ({ ...x, [n.id]: v }))} /><Button title="Cancel note" variant="ghost" onPress={() => run(`c-${n.id}`, () => notesApi.cancel(n.id, (cancelWhy[n.id] ?? '').trim()))} /></> : null}
          </View>
        </View>
      ))}
      {data && !data.notes.length ? <Text style={s.muted}>No credit or debit notes yet.</Text> : null}
    </AppScreen>
  );
}
