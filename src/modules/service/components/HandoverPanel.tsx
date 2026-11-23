import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { apiBlob } from '../../../shared/api/apiClient';
import { saveBlob } from '../../../shared/download';
import { formatDate, parseNumber, todayLocal } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { colors } from '../../../shared/designSystem';
import { projectApi } from '../../project/api/projectApi';
import { s, useAction, useData } from '../../inventory/ui';
import { COMPLETION_LABEL, COMPLETION_TONE, handoverApi, type ChecklistStatus, type Handover, type UnitInput } from '../api/handoverApi';

type Props = { projectId: string; pm: boolean; service: boolean; onLoaded: (h: Handover | null) => void };
const CHECK_OPTIONS: { value: ChecklistStatus; label: string }[] = [{ value: 'pending', label: 'Pending' }, { value: 'done', label: 'Done' }, { value: 'na', label: 'N/A' }];
const toInput = (h: Handover | null): UnitInput[] => (h?.equipment ?? []).map((e) => ({ workOrderItemId: e.workOrderItemId, name: e.name, serialNo: e.serialNo, location: e.location, warrantyMonths: e.warrantyMonths, pmEveryMonths: e.pmEveryMonths, installedOn: e.installedOn ?? undefined }));

// Q29: the PM marks the project complete (approval PM -> Director), fills the fixed checklist with documents and
// an install date per unit, then submits; the service head verifies every serial and accepts.
export function HandoverPanel({ projectId, pm, service, onLoaded }: Props) {
  const fetcher = useCallback(async () => ({
    completion: await handoverApi.completion(projectId).catch(() => null),
    handover: await handoverApi.get(projectId).catch(() => null),
    boq: pm ? await projectApi.boq(projectId) : [],
  }), [projectId, pm]);
  const { data, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const h = data?.handover ?? null;
  const [units, setUnits] = useState<UnitInput[]>([]);
  const [checks, setChecks] = useState<Record<string, ChecklistStatus>>({});
  const [date, setDate] = useState(todayLocal());
  const [verified, setVerified] = useState<string[]>([]);
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    onLoaded(h);
    setUnits(toInput(h));
    setChecks(Object.fromEntries((h?.checklist ?? []).map((c) => [c.key, c.status])));
    if (h?.handoverDate) setDate(h.handoverDate);
  }, [h, onLoaded]);

  const c = data?.completion;
  const editable = pm && (!h || ['draft', 'returned'].includes(h.status));
  const set = (k: string) => (t: string) => setF((x) => ({ ...x, [k]: t }));
  const addUnits = () => {
    const serials = (f.serials ?? '').split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
    const warrantyMonths = parseNumber(f.warranty ?? '12') ?? 12;
    setUnits((u) => [...u, ...serials.map((serialNo) => ({ workOrderItemId: f.item ?? '', name: f.name ?? '', serialNo, warrantyMonths, installedOn: f.installed || undefined }))]);
    setF((x) => ({ ...x, serials: '' }));
  };
  const save = () => run('save', () => handoverApi.save(projectId, { handoverDate: date, equipment: units, checklist: Object.entries(checks).map(([key, status]) => ({ key, status })) }));
  const upload = (key: string) => run(`up-${key}`, async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await handoverApi.upload(projectId, { uri: a.uri, name: a.name, mimeType: a.mimeType, file: Platform.OS === 'web' ? a.file : undefined }, key);
  });

  return (
    <View style={s.list}>
      {problem ? <ErrorBanner message={problem} testID="ho-problem" /> : null}
      <View style={s.card} testID="ho-completion-card">
        <View style={s.row}><Text style={s.title}>Project completion</Text><StatusChip label={COMPLETION_LABEL[c?.status ?? 'not_requested']} tone={COMPLETION_TONE[c?.status ?? 'not_requested']} testID="ho-completion" /></View>
        {c?.completedAt ? <Text style={s.muted}>Completed on {formatDate(c.completedAt)}. The handover can be submitted.</Text> : <Text style={s.muted}>The PM marks the project complete; after approval (PM, then Director) the handover can go to service.</Text>}
        {pm && c && ['not_requested', 'rejected', 'sent_back'].includes(c.status) ? (
          <View style={s.row}>
            <View style={s.cell}><TextField label="Note for the approver (optional)" value={f.note ?? ''} onChangeText={set('note')} testID="ho-complete-note" /></View>
            <Button title="Mark project complete" onPress={() => run('complete', () => handoverApi.markComplete(projectId, f.note ?? ''))} loading={busy === 'complete'} testID="ho-complete" />
          </View>
        ) : null}
      </View>

      {h ? (
        <View style={s.card}>
          <View style={s.row}><Text style={s.title}>Handover {formatDate(h.handoverDate)}</Text><StatusChip label={h.status} tone={h.status === 'accepted' ? 'success' : h.status === 'returned' ? 'danger' : 'info'} testID="ho-status" /></View>
          {h.returnReason ? <Text style={s.danger}>Returned: {h.returnReason}</Text> : null}
          {h.equipment.map((e) => {
            const on = verified.includes(e.serialNo) || e.verified;
            return <Pressable key={e.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} disabled={!(service && h.status === 'submitted')} onPress={() => setVerified(on ? verified.filter((x) => x !== e.serialNo) : [...verified, e.serialNo])} testID={`ho-unit-${e.serialNo}`}><Text style={[s.muted, on && { color: colors.success }]}>{on ? '☑' : '☐'} {e.name} · SN {e.serialNo}{e.location ? ` · ${e.location}` : ''} · installed {formatDate(e.installedOn ?? h.handoverDate)}</Text></Pressable>;
          })}
          {(h.checklist ?? []).length ? <Text style={s.muted} testID="ho-checklist-summary">Checklist: {(h.checklist ?? []).map((i) => `${i.label} ${i.status === 'done' ? '✓' : i.status === 'na' ? 'N/A' : '…'}`).join(' · ')}</Text> : null}
          {(h.files ?? []).map((d) => <Text key={d.id} style={[s.muted, { color: colors.primary }]} onPress={() => run(`dl-${d.id}`, async () => saveBlob(await apiBlob(handoverApi.fileUrl(projectId, d.id)), d.name))} testID={`ho-file-${d.id}`}>📎 {d.label ? `${d.label}: ` : ''}{d.name}</Text>)}
          <View style={s.row}>
            {pm && ['draft', 'returned'].includes(h.status) ? <Button title="Submit to service" onPress={() => run('submit', () => handoverApi.submit(projectId))} disabled={c?.status !== 'approved'} testID="ho-submit" /> : null}
            {service && h.status === 'submitted' ? <><Button title={`Accept (${verified.length}/${h.equipment.length} verified)`} onPress={() => run('accept', () => handoverApi.decide(projectId, { action: 'accept', verifiedSerials: verified }))} testID="ho-accept" /><Button title="Return to project team" variant="ghost" onPress={() => run('return', () => handoverApi.decide(projectId, { action: 'return', reason: 'Serial numbers do not match site' }))} /></> : null}
          </View>
        </View>
      ) : null}

      {editable && data ? (
        <View style={s.form}>
          <Text style={s.title}>Prepare handover</Text>
          <TextField label="Handover date (YYYY-MM-DD)" value={date} onChangeText={setDate} testID="ho-date" />
          <ChoiceChips label="BOQ item" options={data.boq.map((i) => ({ value: i.id, label: `${i.serialNo} ${i.description.slice(0, 25)}` }))} value={f.item ?? ''} onChange={set('item')} testID="ho-item" />
          <View style={s.row}>
            <View style={s.cell}><TextField label="Equipment name" value={f.name ?? ''} onChangeText={set('name')} testID="ho-name" /></View>
            <View style={s.cell}><TextField label="Warranty months" value={f.warranty ?? '12'} onChangeText={set('warranty')} keyboardType="number-pad" /></View>
            <View style={s.cell}><TextField label="Installed on (blank = handover date)" value={f.installed ?? ''} onChangeText={set('installed')} testID="ho-installed" /></View>
          </View>
          <TextField label="Serial numbers (one per line or comma separated)" value={f.serials ?? ''} onChangeText={set('serials')} multiline testID="ho-serials" />
          <Button title="Add units" variant="outline" onPress={addUnits} disabled={!f.item || !(f.name ?? '').trim() || !(f.serials ?? '').trim()} testID="ho-add" />
          {units.map((u, i) => (
            <View key={`${u.serialNo}-${i}`} style={s.row}>
              <Text style={[s.muted, s.cell]}>{u.name} · SN {u.serialNo}</Text>
              <TextField label="Installed on" value={u.installedOn ?? ''} onChangeText={(t) => setUnits((x) => x.map((y, j) => (j === i ? { ...y, installedOn: t || undefined } : y)))} testID={`ho-inst-${u.serialNo}`} />
              <Button title="Remove" variant="ghost" onPress={() => setUnits((x) => x.filter((_, j) => j !== i))} />
            </View>
          ))}
          <Text style={s.title}>Checklist</Text>
          {(h?.checklist ?? []).length ? (h?.checklist ?? []).map((i) => (
            <View key={i.key} style={s.row}>
              <View style={s.cell}><ChoiceChips label={`${i.label}${i.required ? ' (required)' : ''}`} options={i.required ? CHECK_OPTIONS.filter((o) => o.value !== 'na') : CHECK_OPTIONS} value={checks[i.key] ?? 'pending'} onChange={(v) => setChecks((x) => ({ ...x, [i.key]: v as ChecklistStatus }))} testID={`ho-ck-${i.key}`} /></View>
              <Button title={i.documentId ? 'Replace document' : 'Attach document'} variant="ghost" onPress={() => upload(i.key)} loading={busy === `up-${i.key}`} testID={`ho-up-${i.key}`} />
            </View>
          )) : <Text style={s.muted}>Save the list once to get the company's handover checklist.</Text>}
          <Button title="Save handover" onPress={save} loading={busy === 'save'} disabled={!units.length} testID="ho-save" />
        </View>
      ) : null}
    </View>
  );
}
