import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import { ApiError } from '../../../shared/api/apiClient';
import { formatNumber, parseNumber } from '../../../shared/format';
import { AppScreen } from '../../../shared/ui/AppScreen';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { TextField } from '../../../shared/ui/TextField';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { colors, radius, spacing } from '../../../shared/designSystem';
import { requisitionApi, type PickedFile } from '../api/requisitionApi';
import type { Attachment, BalanceRow, NewRequisition, OverBoqLine, Requisition } from '../types';
import { submitOrQueue } from '../../../shared/offline/outbox';
import { projectApi } from '../../project/api/projectApi';
import type { Project, ProjectSite } from '../../project/types';
import { PackageMaterialLines, packageLinesFor, type PackageLine } from '../../inventory/components/PackageMaterialLines';
import { BoqLines, type BoqEntry } from '../components/BoqLines';
import { ExtraMaterialLines, extraLinesFor, type ExtraLine } from '../components/ExtraMaterialLines';
import { AttachmentPicker } from '../components/Attachments';

type Props = NativeStackScreenProps<RootStackParamList, 'NewRequisition'>;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong');

// New material request, or a sent-back one being corrected and resubmitted (requisitionId).
// Field order (1B.1): project, delivery address, material lines with quantity, required date, remarks, attachments.
export function NewRequisitionScreen({ navigation, route }: Props) {
  const { requisitionId } = route.params;
  const editing = Boolean(requisitionId);
  const [projectId, setProjectId] = useState(route.params.projectId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<BalanceRow[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [boq, setBoq] = useState<Record<string, BoqEntry>>({});
  const [search, setSearch] = useState('');
  const [extras, setExtras] = useState<PackageLine[]>([]);
  const [others, setOthers] = useState<ExtraLine[]>([]);
  const [address, setAddress] = useState('');
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [siteId, setSiteId] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [existing, setExisting] = useState<Attachment[]>([]);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState<OverBoqLine[] | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    projectApi.list().then((p) => setProjects(p.filter((x) => x.status !== 'closed'))).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    let live = true;
    setRows(null);
    requisitionApi.balance(projectId).then((r) => { if (live) setRows(r); }).catch((e) => { if (live) setLoadError(e instanceof ApiError ? e.message : 'Could not load the BOQ'); });
    // Delivery address starts as the project's site address; the user may change it.
    if (!editing) projectApi.get(projectId).then((p) => { if (live) setAddress(p.siteAddress ?? ''); }).catch(() => undefined);
    // The sites this person may raise for: the main site first; with one site there is nothing to choose.
    if (!editing) projectApi.sites(projectId).then((list) => {
      if (!live) return;
      const open = list.filter((x) => x.isActive);
      setSites(open);
      setSiteId((open.find((x) => x.isMain) ?? open[0])?.id ?? '');
    }).catch(() => { if (live) { setSites([]); setSiteId(''); } });
    return () => { live = false; };
  }, [projectId, editing]);

  useEffect(() => {
    if (!requisitionId) return;
    requisitionApi.get(requisitionId).then((r: Requisition) => {
      setAddress(r.deliveryAddress ?? '');
      setNeededBy(r.neededBy ? r.neededBy.slice(0, 10) : '');
      setRemarks(r.remarks ?? r.note ?? '');
      setExisting(r.attachments ?? []);
      setBoq(Object.fromEntries(r.lines.filter((l) => l.workOrderItemId && l.billable !== false).map((l) => [l.workOrderItemId as string, { qty: String(l.qtyRequested), specification: l.specification ?? '' }])));
      setExtras(r.lines.filter((l) => l.workOrderItemId && l.billable === false && l.materialId).map((l) => ({ workOrderItemId: l.workOrderItemId as string, materialId: l.materialId as string, label: `${l.description} (${l.unit}) for S.No ${l.serialNo}`, qty: String(l.qtyRequested), ...(l.extraWorkItemId ? { extraWorkItemId: l.extraWorkItemId } : {}) })));
      setOthers(r.lines.filter((l) => !l.workOrderItemId && l.materialId).map((l) => ({ materialId: l.materialId as string, label: `${l.serialNo} · ${l.description}`, unit: l.unit, qty: String(l.qtyRequested), specification: l.specification ?? '', isNew: Boolean(l.newMaterial) })));
    }).catch((e) => setLoadError(message(e)));
  }, [requisitionId]);

  const chosen = Object.entries(boq).map(([id, v]) => ({ id, qty: parseNumber(v.qty), specification: v.specification.trim() })).filter((x): x is { id: string; qty: number; specification: string } => x.qty !== null && x.qty > 0);
  const badQty = Object.values(boq).some((v) => v.qty.trim() !== '' && (parseNumber(v.qty) ?? 0) <= 0);
  const visible = (rows ?? []).filter((r) => !search.trim() || `${r.serialNo} ${r.description}`.toLowerCase().includes(search.trim().toLowerCase()));
  const current = projects.find((p) => p.id === projectId);
  const count = chosen.length + packageLinesFor(extras).length + extraLinesFor(others).length;

  const chooseProject = (id: string) => {
    if (id === projectId) return;
    setProjectId(id);
    setBoq({});
    setExtras([]);
    setOver(null);
  };

  const upload = async (id: string) => {
    let failed = 0;
    for (const f of picked) {
      try { await requisitionApi.addAttachment(id, f); } catch { failed += 1; }
    }
    return failed;
  };

  const send = async (withReason?: string) => {
    setError('');
    if (badQty) return setError('Quantities must be numbers above 0. Clear any box you do not need.');
    if (!count) return setError('Enter a quantity for at least one item.');
    if (neededBy.trim() && !DATE.test(neededBy.trim())) return setError('Required date must be YYYY-MM-DD');
    const body: NewRequisition = {
      lines: [
        ...chosen.map((c) => ({ workOrderItemId: c.id, qty: c.qty, ...(c.specification ? { specification: c.specification } : {}), ...(withReason ? { reason: withReason } : {}) })),
        ...packageLinesFor(extras),
        ...extraLinesFor(others),
      ],
      ...(siteId && !requisitionId ? { siteId } : {}),
      deliveryAddress: address.trim(),
      remarks: remarks.trim(),
      ...(neededBy.trim() ? { neededBy: neededBy.trim() } : {}),
    };
    setBusy(true);
    try {
      let saved: Requisition;
      if (requisitionId) saved = await requisitionApi.resubmit(requisitionId, body);
      else {
        const r = await submitOrQueue<Requisition>(`Material request (${count} item${count === 1 ? '' : 's'})`, 'POST', `/projects/${projectId}/requisitions`, body);
        if (r.queued) {
          setQueued(true);
          setBusy(false);
          return;
        }
        saved = r.data;
      }
      const attachFailed = await upload(saved.id);
      navigation.replace('RequisitionDetail', { id: saved.id, justCreated: true, ...(attachFailed ? { attachFailed } : {}) });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OVER_BOQ') setOver(e.details as unknown as OverBoqLine[]);
      else setError(message(e));
      setBusy(false);
    }
  };

  const removeExisting = async (a: Attachment) => {
    if (!requisitionId) return;
    try { setExisting((await requisitionApi.removeAttachment(requisitionId, a.id)).attachments ?? []); } catch (e) { setError(message(e)); }
  };

  const confirmOver = () => {
    if (reason.trim().length < 3) return setReasonError('Say why the extra quantity is needed (e.g. client approved on call)');
    setReasonError('');
    send(reason.trim());
  };

  const title = editing ? 'Change and resubmit request' : 'New material request';
  const back = () => (requisitionId ? navigation.navigate('RequisitionDetail', { id: requisitionId }) : navigation.navigate('ProjectDetail', { id: projectId }));
  if (loadError) return <AppScreen title={title} onBack={back}><ErrorState message={loadError} /></AppScreen>;
  if (!rows) return <AppScreen title={title} onBack={back}><ActivityIndicator /></AppScreen>;

  if (queued) {
    return (
      <AppScreen title={title} onBack={back} testID="new-requisition-screen">
        <Text style={styles.queued} testID="req-queued">
          No network. Your request is saved on this phone and will be sent automatically when you are back online. You will see it in the request list after that.
          {picked.length ? ' Attachments are not saved offline: add them to the request once it is sent.' : ''}
        </Text>
        <Button title="Back to project" onPress={back} testID="req-queued-back" />
      </AppScreen>
    );
  }

  return (
    <AppScreen title={title} subtitle="Project, delivery, items, date, remarks and attachments" onBack={back} testID="new-requisition-screen">
      {!editing && projects.length > 1 ? (
        <ChoiceChips label="1. Project" options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} value={projectId} onChange={chooseProject} testID="req-project" />
      ) : current ? (
        <Text style={styles.section} testID="req-project-fixed">1. Project: {current.code} · {current.name}</Text>
      ) : null}
      {sites.length > 1 ? (
        <ChoiceChips label="Site" value={siteId} onChange={(v) => { setSiteId(v); const site = sites.find((x) => x.id === v); if (site?.address) setAddress(site.address); }} options={sites.map((x) => ({ value: x.id, label: x.name }))} testID="req-site" />
      ) : null}
      <TextField label="2. Delivery address" value={address} onChangeText={setAddress} placeholder="Site address, gate, floor…" maxLength={300} multiline testID="req-address" />

      <Text style={styles.section}>3. Material and quantity</Text>
      {rows.length === 0 ? <EmptyState title="No BOQ items" body="Add material not in the BOQ below, or ask the office to load this project's work order." /> : null}
      {over ? (
        <View style={styles.warn} testID="over-boq-warning">
          <Text style={styles.warnTitle}>This goes beyond the work order (BOQ)</Text>
          {over.map((o) => (
            <Text key={o.field} style={styles.warnLine}>
              S.No {o.serialNo}: BOQ {formatNumber(o.boqQty)}, already requested {formatNumber(o.previouslyRequested)}, now {formatNumber(o.qtyRequested)} →{' '}
              <Text style={styles.extra}>{formatNumber(o.overBy)} extra</Text>
            </Text>
          ))}
          <Text style={styles.warnBody}>Do you really need the extra quantity? The owner will be told, and it goes on the PO amendment list.</Text>
          <TextField label="Reason" testID="over-reason" value={reason} onChangeText={(v) => { setReason(v); setReasonError(''); }} error={reasonError} placeholder="e.g. Client approved 2 extra on call, PO amendment coming" />
          <View style={styles.row}>
            <Button title="Yes, request anyway" onPress={confirmOver} loading={busy} testID="over-confirm" />
            <Button title="No, change quantities" variant="ghost" onPress={() => { setOver(null); setReason(''); }} testID="over-cancel" />
          </View>
        </View>
      ) : null}
      {rows.length > 5 ? <TextField label="Search items" value={search} onChangeText={setSearch} placeholder="S.No or description" testID="req-search" /> : null}
      <BoqLines rows={visible} value={boq} onChange={(id, entry) => { setBoq((b) => ({ ...b, [id]: entry })); setOver(null); }} />
      {rows.length ? <PackageMaterialLines boq={rows} value={extras} onChange={setExtras} /> : null}
      <ExtraMaterialLines value={others} onChange={setOthers} />

      <TextField label="4. Required date (YYYY-MM-DD, optional)" value={neededBy} onChangeText={setNeededBy} placeholder="2026-12-01" maxLength={10} testID="req-needed-by" />
      <TextField label="5. Remarks (optional)" value={remarks} onChangeText={setRemarks} testID="req-note" placeholder="e.g. Needed for floors 1-5" maxLength={500} multiline />
      <AttachmentPicker picked={picked} onPick={setPicked} existing={existing} onRemoveExisting={editing ? removeExisting : undefined} />

      {error ? <ErrorBanner message={error} testID="req-error" /> : null}
      {!over ? (
        <Button title={`${editing ? 'Resubmit' : 'Send'} request (${count} item${count === 1 ? '' : 's'})`} onPress={() => send()} loading={busy} testID="req-submit" style={styles.self} />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  queued: { fontSize: 15, color: colors.text, lineHeight: 22 },
  section: { fontSize: 15, fontWeight: '700', color: colors.text },
  extra: { color: colors.danger, fontWeight: '700' },
  warn: { borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  warnTitle: { fontSize: 17, fontWeight: '800', color: colors.danger },
  warnLine: { fontSize: 14, color: colors.text },
  warnBody: { fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  self: { alignSelf: 'flex-start' },
});
