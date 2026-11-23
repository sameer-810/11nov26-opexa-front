import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { saveBlob } from '../../shared/download';
import { formatDate, formatMoney, formatNumber, todayLocal } from '../../shared/format';
import { Button } from '../../shared/ui/Button';
import { ErrorBanner } from '../../shared/ui/Banner';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StatusChip } from '../../shared/ui/StatusChip';
import { TextField } from '../../shared/ui/TextField';
import type { Attachment } from '../requisition/types';
import { AttachmentList, pickAttachment } from '../requisition/components/Attachments';
import { s, useAction, useData } from '../inventory/ui';
import { projectFinanceApi, type ChangeRequest, type CrStatus } from './projectFinanceApi';

const LABEL: Record<CrStatus, string> = { raised: 'Raised', client_approved: 'Client approved', rejected: 'Rejected', cancelled: 'Cancelled', closed: 'Closed' };
const TONE = { raised: 'warning', client_approved: 'success', rejected: 'danger', cancelled: 'neutral', closed: 'info' } as const;
type Run = (key: string, fn: () => Promise<unknown>) => Promise<boolean>;

function ItemDocs({ id, itemId, count, run, onError }: { id: string; itemId: string; count: number; run: Run; onError: (m: string) => void }) {
  const [docs, setDocs] = useState<Attachment[] | null>(null);
  const attach = () => run(`doc-${itemId}`, async () => { const f = await pickAttachment(); if (f) setDocs(await projectFinanceApi.addItemDocument(id, itemId, f)); });
  return (
    <View>
      <View style={s.row}>
        <Button title="Attach document" variant="outline" onPress={() => void attach()} testID={`aw-attach-${itemId}`} />
        {count && !docs ? <Button title={`Show documents (${count})`} variant="ghost" onPress={() => void run(`show-${itemId}`, async () => setDocs(await projectFinanceApi.itemDocuments(id, itemId)))} /> : null}
      </View>
      {docs ? <AttachmentList items={docs} onError={onError} fetchFile={(a) => projectFinanceApi.itemDocument(id, itemId, a)} /> : null}
    </View>
  );
}

function CrCard({ id, cr, pm, run, onError }: { id: string; cr: ChangeRequest; pm: boolean; run: Run; onError: (m: string) => void }) {
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const act = (status: Exclude<CrStatus, 'raised'>) => run(`${status}-${cr.id}`, () => projectFinanceApi.setChangeRequestStatus(id, cr.id, { status, clientReference: ref || undefined, note: note || undefined }));
  const open = cr.status === 'raised' || cr.status === 'client_approved';
  return (
    <View style={s.card} testID={`cr-${cr.number}`}>
      <View style={s.row}><Text style={s.number}>{cr.number}</Text><StatusChip label={LABEL[cr.status]} tone={TONE[cr.status]} /><Text style={s.muted}>{formatMoney(cr.value)}</Text></View>
      <Text style={s.title}>{cr.description}</Text>
      <Text style={s.muted}>Requested by {cr.requestedBy} on {formatDate(cr.requestedOn)}{cr.clientReference ? ` · client ref ${cr.clientReference}` : ''}{cr.reason ? ` · ${cr.reason}` : ''}</Text>
      {cr.items.map((i) => <Text key={i.id} style={s.muted}>S.No {i.serialNo} {i.description}: {formatNumber(i.quantity)} {i.unit} @ {formatMoney(i.rate)} · {i.status ?? ''}</Text>)}
      <AttachmentList items={cr.documents} onError={onError} fetchFile={(a) => projectFinanceApi.changeRequestDocument(id, cr.id, a)} />
      {open ? <Button title="Attach client letter / drawing" variant="outline" onPress={() => void run(`cdoc-${cr.id}`, async () => { const f = await pickAttachment(); if (f) await projectFinanceApi.addChangeRequestDocument(id, cr.id, f); })} testID={`cr-attach-${cr.number}`} /> : null}
      {pm && open ? (
        <View style={s.row}>
          {cr.status === 'raised' ? <View style={s.cell}><TextField label="Client approval reference" value={ref} onChangeText={setRef} testID={`cr-ref-${cr.number}`} /></View> : null}
          <View style={s.cell}><TextField label="Note / reason" value={note} onChangeText={setNote} /></View>
          {cr.status === 'raised' ? <Button title="Client approved" onPress={() => void act('client_approved')} testID={`cr-approve-${cr.number}`} /> : <Button title="Close" onPress={() => void act('closed')} testID={`cr-close-${cr.number}`} />}
          {cr.status === 'raised' ? <Button title="Rejected" variant="ghost" onPress={() => void act('rejected')} /> : null}
          <Button title="Cancel" variant="ghost" onPress={() => void act('cancelled')} />
        </View>
      ) : null}
    </View>
  );
}

// 3E: client change requests, the extra-work register (billed / unbilled) and its documents.
export function ChangeRequestsTab({ id, pm }: { id: string; pm: boolean }) {
  const fetcher = useCallback(async () => ({ crs: await projectFinanceApi.changeRequests(id), reg: await projectFinanceApi.regularisation(id) }), [id]);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run, setProblem } = useAction(() => void reload());
  const [f, setF] = useState({ description: '', requestedBy: '', clientReference: '', reason: '' });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const set = (k: keyof typeof f) => (t: string) => setF((x) => ({ ...x, [k]: t }));
  const extras = data.reg.rows.filter((r) => !r.tendered);
  const excel = () => run('xlsx', async () => { if (!saveBlob(await projectFinanceApi.regularisationExcel(id), 'boq-regularisation.xlsx')) setProblem('Open this on the web to download the Excel file.'); });
  return (
    <View style={s.list} testID="pf-changes">
      {problem ? <ErrorBanner message={problem} testID="cr-problem" /> : null}
      <View style={s.row}>
        <Text style={[s.title, s.cell]} testID="aw-register-total">Extra work {formatMoney(data.reg.summary.additionalValue)} · billed {formatMoney(data.reg.summary.additionalBilled ?? 0)} · unbilled {formatMoney(data.reg.summary.additionalUnbilled ?? 0)}</Text>
        <Button title="Regularisation Excel" variant="outline" onPress={() => void excel()} loading={busy === 'xlsx'} testID="reg-excel" />
      </View>
      {extras.map((r) => (
        <View key={r.workOrderItemId} style={s.card} testID={`aw-${r.serialNo}`}>
          <Text style={s.title}>S.No {r.serialNo} {r.description}{r.changeRequest ? ` · ${r.changeRequest}` : ''}</Text>
          <Text style={s.muted}>{r.status} · billed {formatNumber(r.billed)} {r.unit} ({formatMoney(r.billedValue ?? 0)}) · unbilled {formatNumber(r.unbilledQty ?? 0)} ({formatMoney(r.unbilledValue ?? 0)})</Text>
          <ItemDocs id={id} itemId={r.workOrderItemId} count={r.documents ?? 0} run={run} onError={setProblem} />
        </View>
      ))}
      <Text style={s.title}>Change requests</Text>
      {data.crs.map((cr) => <CrCard key={cr.id} id={id} cr={cr} pm={pm} run={run} onError={setProblem} />)}
      {!data.crs.length ? <Text style={s.muted}>No change requests yet.</Text> : null}
      <View style={s.form}>
        <Text style={s.title}>New change request</Text>
        <TextField label="What the client asked for" value={f.description} onChangeText={set('description')} testID="cr-desc" />
        <View style={s.row}>
          <View style={s.cell}><TextField label="Requested by (client side)" value={f.requestedBy} onChangeText={set('requestedBy')} testID="cr-by" /></View>
          <View style={s.cell}><TextField label="Client reference (optional)" value={f.clientReference} onChangeText={set('clientReference')} /></View>
          <View style={s.cell}><TextField label="Reason (optional)" value={f.reason} onChangeText={set('reason')} /></View>
        </View>
        <Button title="Raise change request" loading={busy === 'cr'} testID="cr-save" onPress={() => void run('cr', async () => {
          await projectFinanceApi.createChangeRequest(id, { description: f.description, requestedBy: f.requestedBy, requestedOn: todayLocal(), clientReference: f.clientReference || undefined, reason: f.reason || undefined });
          setF({ description: '', requestedBy: '', clientReference: '', reason: '' });
        })} />
      </View>
    </View>
  );
}
