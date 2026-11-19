import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate, formatNumber, parseNumber } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { projectApi } from '../../project/api/projectApi';
import { inventoryApi } from '../api/inventoryApi';
import type { Transfer } from '../types';
import { s, useAction, useData } from '../ui';

const TONE: Record<string, 'success' | 'warning' | 'info' | 'neutral' | 'danger'> = { pending_approval: 'warning', approved: 'info', dispatched: 'info', partially_received: 'warning', received: 'success', closed: 'neutral', cancelled: 'neutral', rejected: 'danger' };

// Store -> site and store -> store transfers: raise, dispatch with gate pass, receive (partly), close short.
export function TransfersTab() {
  const fetcher = useCallback(async () => {
    const [transfers, warehouses, projects, stock] = await Promise.all([inventoryApi.transfers(), inventoryApi.warehouses(), projectApi.list().catch(() => []), inventoryApi.stock({ kind: 'warehouse' })]);
    return { transfers, warehouses, projects, stock };
  }, []);
  const { data, error, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [creating, setCreating] = useState(false);
  const [from, setFrom] = useState('');
  const [toKind, setToKind] = useState<'site' | 'warehouse'>('site');
  const [toId, setToId] = useState('');
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [receiving, setReceiving] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const name = (t: Transfer) => (t.to.kind === 'warehouse' ? data.warehouses.find((w) => w.id === t.to.id)?.name : data.projects.find((p) => p.id === t.to.id)?.name) ?? '—';
  const available = data.stock.filter((r) => r.location.id === from && r.available > 0);

  const create = () => run('create', async () => {
    const lines = available.map((r) => ({ materialId: r.materialId, qty: parseNumber(qtys[r.materialId] ?? '') ?? 0 })).filter((l) => l.qty > 0);
    if (!from || !toId || !lines.length) throw new Error('Choose source, destination and at least one quantity');
    // Site transfers need the BOQ line; the store picks material lines and the server maps them to the project's BOQ.
    await inventoryApi.createTransfer({ fromWarehouseId: from, to: { kind: toKind, id: toId }, reason, lines });
    setCreating(false); setQtys({});
  });

  return (
    <View style={s.list} testID="transfers-tab">
      {problem ? <ErrorBanner message={problem} testID="transfer-problem" /> : null}
      {creating ? (
        <View style={s.form}>
          <ChoiceChips label="From warehouse" options={data.warehouses.map((w) => ({ value: w.id, label: w.name }))} value={from} onChange={setFrom} testID="tr-from" />
          <ChoiceChips label="To" options={[{ value: 'site', label: 'Project site' }, { value: 'warehouse', label: 'Another warehouse' }]} value={toKind} onChange={(v) => { setToKind(v as 'site' | 'warehouse'); setToId(''); }} />
          <ChoiceChips label={toKind === 'site' ? 'Project' : 'Warehouse'} options={toKind === 'site' ? data.projects.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` })) : data.warehouses.filter((w) => w.id !== from).map((w) => ({ value: w.id, label: w.name }))} value={toId} onChange={setToId} testID="tr-to" />
          {available.map((r) => (
            <View key={r.materialId} style={s.row}>
              <Text style={[s.title, s.cell]}>{r.name} · available {formatNumber(r.available)} {r.unit}</Text>
              <TextField label="Send qty" value={qtys[r.materialId] ?? ''} onChangeText={(v) => setQtys((q) => ({ ...q, [r.materialId]: v }))} keyboardType="decimal-pad" testID={`tr-qty-${r.code}`} />
            </View>
          ))}
          {from && !available.length ? <Text style={s.muted}>Nothing available in this warehouse.</Text> : null}
          <TextField label="Reason / note" value={reason} onChangeText={setReason} />
          <View style={s.row}><Button title="Create transfer" onPress={create} loading={busy === 'create'} testID="tr-create" /><Button title="Cancel" variant="ghost" onPress={() => setCreating(false)} /></View>
        </View>
      ) : <Button title="New transfer" onPress={() => setCreating(true)} testID="tr-new" />}
      {data.transfers.map((t) => (
        <View key={t.id} style={s.card} testID={`transfer-${t.number}`}>
          <View style={s.row}><Text style={s.number}>{t.number}</Text><StatusChip label={t.status.replace(/_/g, ' ')} tone={TONE[t.status] ?? 'neutral'} /></View>
          <Text style={s.title}>{data.warehouses.find((w) => w.id === t.fromWarehouseId)?.name} → {name(t)}</Text>
          <Text style={s.muted}>{formatDate(t.createdAt)}{t.gatePassNo ? ` · gate pass ${t.gatePassNo}` : ''}{t.vehicleNo ? ` · ${t.vehicleNo}` : ''}</Text>
          {t.lines.map((l) => (
            <View key={l.id} style={s.row}>
              <Text style={[s.muted, s.cell]}>{l.name}: {formatNumber(l.qty)} {l.unit} · sent {formatNumber(l.qtyDispatched)} · received {formatNumber(l.qtyReceived)}{l.qtyShort ? ` · short ${formatNumber(l.qtyShort)}` : ''}{l.inTransit ? ` · in transit ${formatNumber(l.inTransit)}` : ''}</Text>
              {['dispatched', 'partially_received'].includes(t.status) && l.inTransit > 0 ? <TextField label="Received now" value={receiving[l.id] ?? ''} onChangeText={(v) => setReceiving((r) => ({ ...r, [l.id]: v }))} keyboardType="decimal-pad" testID={`tr-rcv-${t.number}-${l.name}`} /> : null}
            </View>
          ))}
          <View style={s.row}>
            {t.status === 'approved' ? <Button title="Dispatch (gate pass)" onPress={() => run(`d-${t.id}`, () => inventoryApi.dispatch(t.id))} loading={busy === `d-${t.id}`} testID={`tr-dispatch-${t.number}`} /> : null}
            {['dispatched', 'partially_received'].includes(t.status) ? <Button title="Confirm receipt" onPress={() => run(`r-${t.id}`, () => inventoryApi.receive(t.id, t.lines.map((l) => ({ lineId: l.id, qty: parseNumber(receiving[l.id] ?? '') ?? 0 })).filter((x) => x.qty > 0)))} loading={busy === `r-${t.id}`} testID={`tr-receive-${t.number}`} /> : null}
            {['approved', 'pending_approval', 'dispatched', 'partially_received'].includes(t.status) ? <Button title={t.status === 'approved' || t.status === 'pending_approval' ? 'Cancel' : 'Close with shortage'} variant="ghost" onPress={() => run(`c-${t.id}`, () => inventoryApi.closeTransfer(t.id, 'Closed from the store screen'))} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
