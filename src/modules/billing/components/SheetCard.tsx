import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDate, formatNumber, parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { colors } from '../../../shared/designSystem';
import { s } from '../../inventory/ui';
import { openPrint } from '../../invoice/invoiceApi';
import { AttachmentList, pickAttachment } from '../../requisition/components/Attachments';
import { billingApi, type Correction, type CorrectionRole, type Sheet } from '../billingApi';

const ROLES: { value: CorrectionRole; label: string }[] = [
  { value: 'site', label: 'Site measurement' }, { value: 'client_engineer', label: 'Client engineer' }, { value: 'pm', label: 'Project manager' },
];
const roleLabel = (r: CorrectionRole) => ROLES.find((x) => x.value === r)?.label.toLowerCase() ?? r;
// "26 → 25.5 by Mr. Shah (client engineer), 23 Nov 2026"
export const correctionText = (c: Correction) => `${formatNumber(c.oldQty)} → ${formatNumber(c.newQty)} by ${c.byName || roleLabel(c.role)}${c.byName ? ` (${roleLabel(c.role)})` : ''}, ${formatDate(c.at)}`;
const OPEN = ['draft', 'submitted', 'client_verified'];

type Props = {
  sheet: Sheet; projectId: string; serialNo: string; picked: boolean; onPick: () => void;
  run: (key: string, fn: () => Promise<unknown>) => Promise<boolean>; busy: string; onError: (m: string) => void;
};

// One measurement sheet: rows with their working, correction history, corrections, files, print and the workflow.
export function SheetCard({ sheet: sh, projectId, serialNo, picked, onPick, run, busy, onError }: Props) {
  const [fix, setFix] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [role, setRole] = useState<CorrectionRole>('client_engineer');
  const [engineer, setEngineer] = useState(sh.clientEngineer);
  const [warning, setWarning] = useState<string | null>(null);
  const changed = sh.rows.filter((r) => parseNumber(fix[r.id] ?? '') !== null).map((r) => ({ rowId: r.id, correctedQty: parseNumber(fix[r.id] ?? '') ?? r.qty, reason: reason.trim() }));
  const act = (key: string, fn: () => Promise<unknown>) => run(`${key}-${sh.id}`, async () => { await fn(); setFix({}); setReason(''); });
  const needReason = () => {
    if (changed.length && reason.trim().length < 3) { onError('Give the reason for the correction'); return true; }
    return false;
  };
  const correct = () => {
    if (!changed.length) { onError('Enter the corrected quantity for at least one row'); return; }
    if (needReason()) return;
    void act('c', () => billingApi.sheetAction(projectId, sh.id, { action: 'correct', role, clientEngineer: role === 'client_engineer' ? engineer : undefined, corrections: changed }));
  };
  const verify = () => {
    if (needReason()) return;
    void act('v', () => billingApi.sheetAction(projectId, sh.id, { action: 'client_verify', clientEngineer: engineer, corrections: changed }));
  };
  const rowNo = (id: string) => sh.rows.findIndex((r) => r.id === id) + 1;

  return (
    <View style={s.card} testID={`sheet-${sh.number}`}>
      <View style={s.row}>
        {sh.status === 'approved' && !sh.invoiceId ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: picked }} onPress={onPick} testID={`ms-pick-${sh.number}`}><Text style={[s.title, { color: colors.primary }]}>{picked ? '☑' : '☐'}</Text></Pressable> : null}
        <Text style={s.number}>{sh.number}</Text><StatusChip label={sh.invoiceId ? 'billed' : sh.status.replace('_', ' ')} tone={sh.status === 'approved' ? 'success' : 'info'} />
        <Text style={s.muted}>S.No {serialNo} · {[sh.zone, sh.department, sh.floor && `floor ${sh.floor}`].filter(Boolean).join(' · ') || 'no location'} · measured {formatNumber(sh.measuredQty)} → final {formatNumber(sh.finalQty)} {sh.unit ?? ''}{sh.clientEngineer ? ` · verified by ${sh.clientEngineer}` : ''}</Text>
      </View>
      {sh.rows.map((r, i) => (
        <View key={r.id} style={s.row}>
          <Text style={[s.muted, s.cell]}>
            {i + 1}. {r.description || 'Row'}{r.deduct ? ' (deduction)' : ''}: {r.deduct ? '−' : ''}{formatNumber(r.qty)}{r.correctedQty != null ? ` → ${formatNumber(r.correctedQty)}` : ''}{r.formula ? ` · ${r.formula}` : ''}
          </Text>
          {OPEN.includes(sh.status) ? <TextField label="Corrected qty" value={fix[r.id] ?? ''} onChangeText={(v) => setFix((x) => ({ ...x, [r.id]: v }))} keyboardType="decimal-pad" testID={`ms-fix-${r.id}`} /> : null}
        </View>
      ))}
      {sh.corrections.length ? (
        <View testID={`ms-history-${sh.number}`}>
          <Text style={s.title}>Correction history</Text>
          {sh.corrections.map((c, i) => <Text key={`${c.rowId}-${i}`} style={s.muted}>Row {rowNo(c.rowId)}: {correctionText(c)}{c.reason ? ` — ${c.reason}` : ''}</Text>)}
        </View>
      ) : null}
      {OPEN.includes(sh.status) ? (
        <View style={s.list}>
          {sh.status !== 'submitted' ? <ChoiceChips label="Corrected by" options={ROLES} value={role} onChange={(v) => setRole(v as CorrectionRole)} testID={`ms-role-${sh.number}`} /> : null}
          {sh.status === 'submitted' || role === 'client_engineer' ? <TextField label="Client engineer" value={engineer} onChangeText={setEngineer} testID={`ms-engineer-${sh.number}`} /> : null}
          <TextField label="Reason for correction" value={reason} onChangeText={setReason} testID={`ms-reason-${sh.number}`} />
        </View>
      ) : null}
      {warning ? <Text style={s.warn} testID={`ms-warning-${sh.number}`}>{warning}</Text> : null}
      <View style={s.row}>
        {sh.status === 'draft' ? <Button title="Send to client" variant="outline" onPress={() => act('s', () => billingApi.sheetAction(projectId, sh.id, { action: 'submit' }))} testID={`ms-submit-${sh.number}`} /> : null}
        {sh.status === 'submitted' ? <Button title="Record client verification" onPress={verify} loading={busy === `v-${sh.id}`} testID={`ms-verify-${sh.number}`} /> : null}
        {OPEN.includes(sh.status) && sh.status !== 'submitted' ? <Button title="Save correction" variant="outline" onPress={correct} loading={busy === `c-${sh.id}`} testID={`ms-correct-${sh.number}`} /> : null}
        {sh.status === 'client_verified' ? <Button title="Approve" onPress={() => act('a', async () => setWarning((await billingApi.sheetAction(projectId, sh.id, { action: 'approve' })).warning ?? null))} testID={`ms-approve-${sh.number}`} /> : null}
        <Button title="Print / PDF" variant="ghost" onPress={() => run(`p-${sh.id}`, async () => openPrint((await billingApi.sheetPrintLink(projectId, sh.id)).url))} testID={`ms-print-${sh.number}`} />
        {sh.status !== 'rejected' ? <Button title="Attach photo / back sheet" variant="ghost" onPress={() => run(`f-${sh.id}`, async () => { const f = await pickAttachment(); if (f) await billingApi.addSheetFile(projectId, sh.id, f); })} testID={`ms-attach-${sh.number}`} /> : null}
      </View>
      <AttachmentList items={sh.attachments} onError={onError} fetchFile={(a) => billingApi.sheetFile(projectId, sh.id, a)} />
    </View>
  );
}
