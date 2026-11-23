import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDate, formatMoney, parseNumber, todayLocal } from '../../../shared/format';
import { Button } from '../../../shared/ui/Button';
import { ChoiceChips } from '../../../shared/ui/ChoiceChips';
import { ErrorBanner } from '../../../shared/ui/Banner';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { TextField } from '../../../shared/ui/TextField';
import { s, useAction, useData } from '../../inventory/ui';
import { serviceApi } from '../api/serviceApi';
import { amcApi, type Amc, type AmcHistory, type Handover } from '../api/handoverApi';

type Props = { projectId: string; handover: Handover | null; service: boolean; canBill: boolean };
const YES_NO = [{ value: 'no', label: 'Parts chargeable' }, { value: 'yes', label: 'Parts included' }];

// Q30: AMC contracts of the project: billing, contract technician, visits per year, cancellation, history.
export function AmcPanel({ projectId, handover, service, canBill }: Props) {
  const fetcher = useCallback(async () => ({
    rows: (await amcApi.list().catch(() => ({ rows: [] as Amc[] }))).rows.filter((x) => x.projectId === projectId),
    techs: service ? await serviceApi.technicians().catch(() => []) : [],
  }), [projectId, service]);
  const { data, reload } = useData(fetcher);
  const { busy, problem, run } = useAction(() => void reload());
  const [f, setF] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<string, AmcHistory>>({});
  const set = (k: string) => (t: string) => setF((x) => ({ ...x, [k]: t }));
  const techName = (id: string | null) => data?.techs.find((t) => t.id === id)?.name ?? (id ? 'Assigned' : 'None');
  const techOptions = [{ value: '', label: 'None' }, ...(data?.techs ?? []).map((t) => ({ value: t.id, label: t.name }))];

  return (
    <View style={s.list}>
      <Text style={s.title}>AMC contracts</Text>
      {problem ? <ErrorBanner message={problem} testID="amc-problem" /> : null}
      {data?.rows.map((c) => {
        const h = history[c.id];
        const live = c.status === 'active';
        return (
          <View key={c.id} style={s.card} testID={`amc-${c.number}`}>
            <View style={s.row}><Text style={s.number}>{c.number}</Text><StatusChip label={live && c.daysToEnd <= 30 ? `Renew: ends in ${c.daysToEnd} days` : c.status} tone={live && c.daysToEnd <= 30 ? 'warning' : live ? 'success' : c.status === 'cancelled' ? 'danger' : 'neutral'} testID={`amc-status-${c.number}`} /></View>
            <Text style={s.muted}>{c.clientName} · {formatDate(c.startDate)} to {formatDate(c.endDate)} · {c.assets} unit(s) · {formatMoney(c.contractValue)}</Text>
            <Text style={s.muted}>{c.visitsPerYear} PM visits a year{c.nextVisitDate ? ` · next ${formatDate(c.nextVisitDate)}` : ''} · technician {techName(c.technicianId)} · labour free, parts {c.partsIncluded ? 'included' : 'chargeable'}</Text>
            {c.cancellation ? <Text style={s.danger}>Cancelled from {formatDate(c.cancellation.effectiveDate)}: {c.cancellation.reason}. Invoices already raised for later periods are flagged for a credit note.</Text> : null}
            <Text style={s.muted}>Revenue {formatMoney(c.revenue)} · expenses {formatMoney(c.expenses)} · profit {formatMoney(c.profit)}{c.marginPct != null ? ` (${c.marginPct}%)` : ''} · visits {c.visits.preventive} PM, {c.visits.complaints} complaints, {c.visits.open} open</Text>
            {c.schedule.map((x) => (
              <View key={x.id} style={s.row}>
                <Text style={[x.due ? s.warn : s.muted, s.cell]}>{formatDate(x.dueDate)} · {x.label} · {formatMoney(x.amount)}{x.invoiceId ? ' · invoiced' : x.cancelled ? ' · cancelled' : x.due ? ' · due' : ''}</Text>
                {!x.invoiceId && !x.cancelled && canBill ? <Button title="Invoice" variant="outline" onPress={() => run(`i-${x.id}`, () => amcApi.bill(c.id, x.id))} testID={`amc-bill-${c.number}-${x.dueDate}`} /> : null}
              </View>
            ))}
            <Button title={h ? 'Hide visits & history' : 'Visit plan & service history'} variant="ghost" onPress={() => (h ? setHistory((x) => { const n = { ...x }; delete n[c.id]; return n; }) : run(`h-${c.id}`, async () => { const r = await amcApi.history(c.id); setHistory((x) => ({ ...x, [c.id]: r })); }))} testID={`amc-history-${c.number}`} />
            {h ? (
              <View style={s.list} testID={`amc-history-body-${c.number}`}>
                <Text style={s.muted}>Visit plan: {h.plan.map((p) => `${formatDate(p.date)}${p.status === 'raised' ? ' ✓' : p.status === 'upcoming' ? '' : ' (past)'}`).join(' · ') || 'no visits'}</Text>
                <Text style={s.muted}>{h.totals.preventive} PM jobs · {h.totals.complaints} complaints · {h.totals.visits} visits · parts used on {h.totals.partsUsed} · charged {formatMoney(h.totals.charges)}</Text>
                {h.tickets.map((t) => (
                  <Text key={t.id} style={s.muted}>{t.number} · {t.kind === 'preventive' ? 'PM' : 'Complaint'} · {t.title} · {t.status}{t.technician ? ` · ${t.technician}` : ''}{t.visits.filter((v) => v.partsUsed).map((v) => ` · parts: ${v.partsUsed}`).join('')}{t.charge ? ` · ${formatMoney(t.charge)}` : ''}</Text>
                ))}
              </View>
            ) : null}
            {service && (live || c.status === 'expired') ? (
              <View style={s.row}>
                <View style={s.cell}><TextField label="Renew to (YYYY-MM-DD)" value={f[`ne-${c.id}`] ?? ''} onChangeText={set(`ne-${c.id}`)} testID={`amc-renew-end-${c.number}`} /></View>
                <View style={s.cell}><TextField label="New contract value ₹" value={f[`nv-${c.id}`] ?? ''} onChangeText={set(`nv-${c.id}`)} keyboardType="decimal-pad" testID={`amc-renew-value-${c.number}`} /></View>
                <Button title="Renew AMC" variant="outline" onPress={() => run(`n-${c.id}`, () => amcApi.renew(c.id, { endDate: (f[`ne-${c.id}`] ?? '').trim(), contractValue: parseNumber(f[`nv-${c.id}`] ?? '') ?? 0 }))} disabled={!(f[`ne-${c.id}`] ?? '').trim() || !(parseNumber(f[`nv-${c.id}`] ?? '') ?? 0)} loading={busy === `n-${c.id}`} testID={`amc-renew-${c.number}`} />
              </View>
            ) : null}
            {service && live ? (
              <View style={s.list}>
                <View style={s.row}>
                  <View style={s.cell}><ChoiceChips label="Contract technician" options={techOptions} value={f[`t-${c.id}`] ?? c.technicianId ?? ''} onChange={set(`t-${c.id}`)} testID={`amc-tech-${c.number}`} /></View>
                  <View style={s.cell}><ChoiceChips label="Parts" options={YES_NO} value={f[`p-${c.id}`] ?? (c.partsIncluded ? 'yes' : 'no')} onChange={set(`p-${c.id}`)} /></View>
                  <Button title="Save" variant="outline" onPress={() => run(`u-${c.id}`, () => amcApi.update(c.id, { technicianId: (f[`t-${c.id}`] ?? c.technicianId) || null, partsIncluded: (f[`p-${c.id}`] ?? (c.partsIncluded ? 'yes' : 'no')) === 'yes' }))} testID={`amc-save-${c.number}`} />
                </View>
                <View style={s.row}>
                  <View style={s.cell}><TextField label="Parts expense ₹" value={f[`e-${c.id}`] ?? ''} onChangeText={set(`e-${c.id}`)} keyboardType="decimal-pad" /></View>
                  <Button title="Add parts expense" variant="ghost" onPress={() => run(`e-${c.id}`, () => amcApi.expense(c.id, { date: todayLocal(), category: 'parts', amount: parseNumber(f[`e-${c.id}`] ?? '') ?? 0 }))} />
                </View>
                <View style={s.row}>
                  <View style={s.cell}><TextField label="Cancel: reason" value={f[`r-${c.id}`] ?? ''} onChangeText={set(`r-${c.id}`)} testID={`amc-cancel-reason-${c.number}`} /></View>
                  <View style={s.cell}><TextField label="Effective from (YYYY-MM-DD)" value={f[`d-${c.id}`] ?? todayLocal()} onChangeText={set(`d-${c.id}`)} testID={`amc-cancel-date-${c.number}`} /></View>
                  <Button title="Cancel AMC" variant="outline" onPress={() => run(`c-${c.id}`, () => amcApi.cancel(c.id, { reason: (f[`r-${c.id}`] ?? '').trim(), effectiveDate: f[`d-${c.id}`] ?? todayLocal() }))} disabled={(f[`r-${c.id}`] ?? '').trim().length < 3} loading={busy === `c-${c.id}`} testID={`amc-cancel-${c.number}`} />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
      {service && handover?.status === 'accepted' ? (
        <View style={s.form}>
          <Text style={s.title}>New AMC for this project's equipment</Text>
          <View style={s.row}>
            <View style={s.cell}><TextField label="Start (YYYY-MM-DD)" value={f.start ?? ''} onChangeText={set('start')} testID="amc-start" /></View>
            <View style={s.cell}><TextField label="End (YYYY-MM-DD)" value={f.end ?? ''} onChangeText={set('end')} testID="amc-end" /></View>
            <View style={s.cell}><TextField label="Contract value ₹" value={f.value ?? ''} onChangeText={set('value')} keyboardType="decimal-pad" testID="amc-value" /></View>
            <View style={s.cell}><TextField label="PM visits a year" value={f.visits ?? '4'} onChangeText={set('visits')} keyboardType="number-pad" testID="amc-visits" /></View>
          </View>
          <ChoiceChips label="Contract technician" options={techOptions} value={f.tech ?? ''} onChange={set('tech')} testID="amc-new-tech" />
          <ChoiceChips label="Parts" options={YES_NO} value={f.parts ?? 'no'} onChange={set('parts')} testID="amc-new-parts" />
          <Button title="Create AMC (quarterly billing)" onPress={() => run('amc', () => amcApi.create({ projectId, assetIds: handover.equipment.map((e) => e.assetId).filter((x): x is string => Boolean(x)), startDate: f.start ?? '', endDate: f.end ?? '', contractValue: parseNumber(f.value ?? '') ?? 0, visitsPerYear: parseNumber(f.visits ?? '4') ?? 4, technicianId: f.tech || undefined, partsIncluded: f.parts === 'yes' }))} loading={busy === 'amc'} testID="amc-create" />
        </View>
      ) : null}
    </View>
  );
}
