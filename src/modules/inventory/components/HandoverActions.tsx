import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatNumber, parseNumber } from '../../../shared/format';
import { can, PERMS } from '../../../shared/permissions';
import { useAuth } from '../../../shared/store/useAuthStore';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { TextField } from '../../../shared/ui/TextField';
import { inventoryApi } from '../api/inventoryApi';
import type { Receiver, Resolution, Transfer } from '../types';
import { s, useAction } from '../ui';

type Count = { accepted: string; damaged: string; short: string };
const RESOLUTIONS = [{ value: 'site', label: 'Accept at site' }, { value: 'store', label: 'Back to store' }, { value: 'write_off', label: 'Write off' }];
const num = (v: string) => parseNumber(v) ?? 0;

// Workflow Phase D: store issues to a named engineer; the engineer confirms accepted / damaged / short;
// a mismatch stays "discrepancy pending" until the project manager resolves it with remarks.
export function HandoverActions({ t, onDone }: { t: Transfer; onDone: () => void }) {
  const { user } = useAuth();
  const { busy, problem, run } = useAction(onDone);
  const [receivers, setReceivers] = useState<Receiver[] | null>(null);
  const [to, setTo] = useState('');
  const [counts, setCounts] = useState<Record<string, Count>>({});
  const [note, setNote] = useState('');
  const [actions, setActions] = useState<Record<string, Resolution>>({});
  const [remarks, setRemarks] = useState('');
  if (t.to.kind !== 'site') return null;
  const open = t.lines.filter((l) => l.inTransit > 0);
  const disputed = t.lines.filter((l) => l.qtyDisputed > 0);
  const count = (id: string, inTransit: number): Count => counts[id] ?? { accepted: String(inTransit), damaged: '0', short: '0' };
  const setCount = (id: string, inTransit: number, key: keyof Count, v: string) => setCounts((c) => ({ ...c, [id]: { ...count(id, inTransit), [key]: v } }));
  const banner = problem ? <ErrorBanner message={problem} testID={`mi-problem-${t.number}`} /> : null;

  if (t.status === 'approved') {
    if (!receivers) return <View style={s.list}><Button title="Issue to engineer" variant="outline" onPress={() => run('rcv', async () => setReceivers(await inventoryApi.receivers(t.id)))} loading={busy === 'rcv'} testID={`mi-issue-${t.number}`} style={s.self} />{banner}</View>;
    return (
      <View style={s.form}>
        <ChoiceChips label="Issue to" value={to} onChange={setTo} options={receivers.map((r) => ({ value: r.id, label: `${r.name}${r.siteEngineer ? ' · site engineer' : ''}` }))} testID={`mi-to-${t.number}`} />
        {banner}
        <Button title="Dispatch to this engineer" disabled={!to} onPress={() => run('send', () => inventoryApi.dispatch(t.id, { receiverId: to }))} loading={busy === 'send'} testID={`mi-send-${t.number}`} style={s.self} />
      </View>
    );
  }

  if (['dispatched', 'partially_received'].includes(t.status) && t.receiverId) {
    if (t.receiverId !== user?.id) return <Text style={s.warn}>{t.issueNo}: waiting for the engineer to confirm what arrived</Text>;
    const confirm = () => run('confirm', () => inventoryApi.confirm(t.id, { note, lines: open.map((l) => { const c = count(l.id, l.inTransit); return { lineId: l.id, accepted: num(c.accepted), damaged: num(c.damaged), short: num(c.short) }; }) }));
    return (
      <View style={s.form} testID={`mi-confirm-form-${t.number}`}>
        <Text style={s.title}>Confirm {t.issueNo}</Text>
        {open.map((l) => {
          const c = count(l.id, l.inTransit);
          const left = l.inTransit - num(c.accepted) - num(c.damaged) - num(c.short);
          return (
            <View key={l.id} style={s.list}>
              <Text style={s.muted}>{l.name}: issued {formatNumber(l.inTransit)} {l.unit}</Text>
              <View style={s.row}>
                <TextField label="Accepted" value={c.accepted} onChangeText={(v) => setCount(l.id, l.inTransit, 'accepted', v)} keyboardType="decimal-pad" testID={`mi-accepted-${l.name}`} />
                <TextField label="Damaged" value={c.damaged} onChangeText={(v) => setCount(l.id, l.inTransit, 'damaged', v)} keyboardType="decimal-pad" testID={`mi-damaged-${l.name}`} />
                <TextField label="Short" value={c.short} onChangeText={(v) => setCount(l.id, l.inTransit, 'short', v)} keyboardType="decimal-pad" testID={`mi-short-${l.name}`} />
              </View>
              {left !== 0 ? <Text style={s.danger} testID={`mi-left-${l.name}`}>{left > 0 ? `${formatNumber(left)} ${l.unit} not accounted for` : `${formatNumber(-left)} ${l.unit} more than issued`}</Text> : null}
            </View>
          );
        })}
        <TextField label="Note (what was wrong)" value={note} onChangeText={setNote} maxLength={300} testID={`mi-note-${t.number}`} />
        {banner}
        <Button title="Confirm receipt" onPress={confirm} loading={busy === 'confirm'} testID={`mi-confirm-${t.number}`} style={s.self} />
      </View>
    );
  }

  if (t.status === 'discrepancy') {
    const canResolve = user?.role === 'owner' || can(user, PERMS.PROJECT_MANAGE);
    return (
      <View style={canResolve ? s.form : s.list} testID={`mi-discrepancy-${t.number}`}>
        <Text style={s.danger}>Discrepancy pending{t.discrepancy?.note ? `: ${t.discrepancy.note}` : ''}</Text>
        {disputed.map((l) => (
          <View key={l.id} style={s.list}>
            <Text style={s.muted}>{l.name}: {formatNumber(l.qtyDisputed)} {l.unit} not accepted{l.qtyDamaged ? ` (damaged ${formatNumber(l.qtyDamaged)})` : ''}</Text>
            {canResolve ? <ChoiceChips label="Resolution" value={actions[l.id] ?? ''} onChange={(v) => setActions((a) => ({ ...a, [l.id]: v as Resolution }))} options={RESOLUTIONS} testID={`mi-action-${l.name}`} /> : null}
          </View>
        ))}
        {canResolve ? (
          <>
            <TextField label="Remarks" value={remarks} onChangeText={setRemarks} maxLength={300} testID={`mi-remarks-${t.number}`} />
            {banner}
            <Button title="Resolve discrepancy" onPress={() => run('resolve', () => inventoryApi.resolve(t.id, { remarks: remarks.trim(), lines: disputed.filter((l) => actions[l.id]).map((l) => ({ lineId: l.id, action: actions[l.id] })) }))} loading={busy === 'resolve'} testID={`mi-resolve-${t.number}`} style={s.self} />
          </>
        ) : <Text style={s.muted}>The project manager resolves this.</Text>}
      </View>
    );
  }

  return t.discrepancy?.resolvedAt ? <Text style={s.muted} testID={`mi-resolved-${t.number}`}>Discrepancy resolved: {t.discrepancy.remarks}</Text> : null;
}
