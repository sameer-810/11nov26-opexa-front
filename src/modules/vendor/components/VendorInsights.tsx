import { Text, View } from 'react-native';
import { formatDate, formatMoney, formatNumber } from '../../../shared/format';
import { StatusChip } from '../../../shared/ui/StatusChip';
import { s } from '../../inventory/ui';
import type { VendorHistory, VendorPerformanceDetail } from '../types';

const SHOW = 10;
const pct = (n: number | null) => (n === null ? '—' : `${n}%`);

// 2A.2: what we have done with this supplier: RFQs, POs (value), deliveries (on time or late), invoices, payments.
export function VendorHistorySection({ h }: { h: VendorHistory }) {
  return (
    <View style={s.list} testID="vendor-history">
      <Text style={s.title}>Transactions</Text>
      <Text style={s.muted}>PO value {formatMoney(h.totals.purchaseOrderValue)} · invoiced {formatMoney(h.totals.invoiced)} · paid {formatMoney(h.totals.paid)}</Text>
      <Text style={s.title}>Purchase orders ({h.purchaseOrders.length})</Text>
      {h.purchaseOrders.slice(0, SHOW).map((p) => <Text key={p.id} style={s.muted} testID={`hist-po-${p.number}`}>{p.number} · {formatDate(p.date)} · {p.status.replace('_', ' ')} · {formatMoney(p.value)}</Text>)}
      <Text style={s.title}>Deliveries ({h.deliveries.length})</Text>
      {h.deliveries.slice(0, SHOW).map((d) => (
        <View key={d.id} style={s.row} testID={`hist-lot-${d.lotNo}`}>
          <Text style={s.muted}>Lot {d.lotNo} · challan {d.challanNo} · {d.purchaseOrderNumber} · {d.receivedAt ? `received ${formatDate(d.receivedAt)}` : 'in transit'}</Text>
          {d.onTime === null ? null : <StatusChip label={d.onTime ? 'On time' : 'Late'} tone={d.onTime ? 'success' : 'danger'} />}
        </View>
      ))}
      <Text style={s.title}>Invoices ({h.invoices.length})</Text>
      {h.invoices.slice(0, SHOW).map((i) => <Text key={i.id} style={s.muted} testID={`hist-inv-${i.number}`}>{i.number} · {formatDate(i.invoiceDate)} · {i.status.replace('_', ' ')} · {formatMoney(i.total)}</Text>)}
      <Text style={s.title}>Payments ({h.payments.length})</Text>
      {h.payments.slice(0, SHOW).map((p) => <Text key={p.id} style={s.muted} testID={`hist-pay-${p.number}`}>{p.number} · {formatDate(p.date)} · {p.status.replace('_', ' ')} · {formatMoney(p.amount)}{p.tds ? ` + TDS ${formatMoney(p.tds)}` : ''}</Text>)}
      <Text style={s.title}>RFQs ({h.rfqs.length})</Text>
      {h.rfqs.slice(0, SHOW).map((r) => <Text key={r.id} style={s.muted}>{r.number} · {formatDate(r.date)} · {r.supplierStatus ?? r.status}{r.quoteTotal !== null ? ` · quoted ${formatMoney(r.quoteTotal)}` : ''}</Text>)}
    </View>
  );
}

// 2A.3: delivery and invoice performance over the last year, with the price trend of the main materials.
export function VendorPerformanceSection({ p }: { p: VendorPerformanceDetail }) {
  return (
    <View style={s.list} testID="vendor-performance">
      <Text style={s.title}>Performance {formatDate(p.from)} to {formatDate(p.to)}{p.score !== null ? ` · score ${p.score}/100` : ''}</Text>
      <Text style={s.muted} testID="perf-summary">On time {pct(p.onTimePct)} of {p.onTimeChecked} deliveries · average lead time {p.avgLeadDays === null ? '—' : `${p.avgLeadDays} days`}</Text>
      <Text style={s.muted}>Short {pct(p.shortPct)} ({formatNumber(p.shortQty)}) · damaged {pct(p.damagedPct)} ({formatNumber(p.damagedQty)}) of {formatNumber(p.orderedQty)} dispatched · invoice mismatches {p.invoiceMismatches} of {p.invoices}</Text>
      {p.priceTrend.map((t) => (
        <Text key={t.material} style={s.muted}>{t.material}: {formatMoney(t.firstRate)} → {formatMoney(t.lastRate)} per {t.unit}{t.changePct ? ` (${t.changePct > 0 ? '+' : ''}${t.changePct}%)` : ''} over {t.points.length} POs</Text>
      ))}
    </View>
  );
}
