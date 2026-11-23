// Physical counts, minimum stock per store, tools (issue / return / repair / history), damaged stock, a second
// warehouse and supplier payment attachments for the fake backend, layered on installMockApi (kept separate so
// mockApi.ts does not grow). Requests it does not know go to the mock underneath. The real rules are tested in the API.
import type { installMockApi } from './mockApi';
import type { StockCount, Tool, ToolHistory, ToolMaintenance } from '../../src/modules/inventory/types';
import type { SupplierPayment } from '../../src/modules/supplierPayment/supplierPaymentApi';

type BaseApi = ReturnType<typeof installMockApi>;
type Init = { method?: string; body?: unknown; headers?: Record<string, string> };
type Body = Record<string, unknown> & { lines?: { materialId: string; countedQty: number; damagedQty?: number; reason?: string }[] };
const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
const fail = (status: number, code: string, message: string) => ({ ok: false, status, json: async () => ({ success: false, error: { code, message, details: [] } }) });

export const WAREHOUSES = [
  { id: 'w1', code: 'CS', name: 'Central Store', address: '', isCentral: true, managerIds: [], isActive: true },
  { id: 'w2', code: 'BHW', name: 'Bhiwandi', address: '', isCentral: false, managerIds: [], isActive: true },
];

export function installStockControlMock(api: BaseApi, { payments = [] as SupplierPayment[] } = {}) {
  const base = api.fetchMock.getMockImplementation()!;
  const calls: { method: string; path: string; body: unknown }[] = [];
  const counts: StockCount[] = [];
  const tools: ToolHistory[] = [];
  const levels: Body[] = [];

  const totals = (c: StockCount) => {
    const value = (f: (v: number) => number) => c.lines.reduce((t, l) => t + f(l.varianceValue ?? 0), 0);
    c.totals = { lines: c.lines.length, counted: c.lines.filter((l) => l.countedQty !== null).length, withVariance: c.lines.filter((l) => l.variance).length, shortValue: value((v) => Math.min(0, v)), excessValue: value((v) => Math.max(0, v)), netValue: value((v) => v), damagedValue: c.lines.reduce((t, l) => t + l.damagedQty * l.rate, 0) };
    return c;
  };
  const newCount = (b: Body): StockCount => {
    const loc = b.location as { kind: 'warehouse' | 'site'; id: string };
    const lines = api.inventory.stock.filter((r: { location: { id: string } }) => r.location.id === loc.id).map((r: { materialId: string; code: string; name: string; unit: string; onHand: number; avgRate: number }, i: number) => ({
      id: `cl${i + 1}`, materialId: r.materialId, code: r.code, name: r.name, unit: r.unit, category: '', systemQty: r.onHand, rate: r.avgRate, countedQty: null, damagedQty: 0, reason: '', variance: null, varianceValue: null, damagedValue: 0,
    }));
    const name = WAREHOUSES.find((w) => w.id === loc.id)?.name ?? 'Site';
    return totals({ id: `c${counts.length + 1}`, number: `PV-000${counts.length + 1}`, status: 'open', location: { ...loc, name }, countDate: String(b.countDate ?? '2026-11-23'), countedBy: { id: 'u2', name: 'Store' }, scope: { type: 'all', category: '', materialIds: [] }, note: '', adjustmentId: null, createdAt: new Date().toISOString(), lines, totals: { lines: 0, counted: 0, withVariance: 0, shortValue: 0, excessValue: 0, netValue: 0, damagedValue: 0 } });
  };
  const tool = (id: string) => tools.find((t) => t.id === id);
  const move = (t: ToolHistory, action: string, extra: Partial<ToolHistory['history'][number]> = {}) => t.history.unshift({ action, holderName: t.holder?.name ?? '', condition: t.condition, note: '', project: null, responsible: null, recoveryAmount: null, by: 'Store', date: new Date().toISOString(), ...extra });
  const plain = (t: ToolHistory): Tool => ({ id: t.id, code: t.code, name: t.name, serialNo: t.serialNo, category: t.category, condition: t.condition, status: t.status, nextServiceDue: t.nextServiceDue, serviceDue: t.serviceDue, holder: t.holder });

  api.fetchMock.mockImplementation(async (url: string, init: Init) => {
    const [p, query = ''] = url.replace(/^.*\/api\/v1/, '').split('?');
    const method = init?.method ?? 'GET';
    const b: Body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const record = () => calls.push({ method, path: p, body: init?.body instanceof FormData ? 'file' : b });

    if (p === '/inventory/warehouses') return ok(WAREHOUSES);
    const att = p.match(/^\/supplier-payments\/([^/]+)\/attachments$/);
    if (att && method === 'POST') {
      record();
      const pay = payments.find((x) => x.id === att[1]);
      if (!pay) return fail(404, 'NOT_FOUND', 'Supplier payment not found');
      pay.attachments.push({ id: `doc${pay.attachments.length + 1}`, name: 'bank-advice.pdf', contentType: 'application/pdf', size: 2048, uploadedAt: new Date().toISOString() });
      return ok(pay, 201);
    }
    if (/^\/inventory\/damaged\/(mark|write-off|return)$/.test(p)) { record(); return ok({ id: 'd1', number: 'DMG-0001', status: 'pending' }, 201); }
    if (p === '/inventory/stock-levels' && method === 'PUT') {
      record(); levels.push(b);
      const row = api.inventory.stock.find((r: { materialId: string }) => r.materialId === b.materialId);
      if (row) Object.assign(row, { minStock: b.minQty ?? 0, reorderQty: b.reorderQty ?? 0, low: row.available < Number(b.minQty ?? 0) });
      return ok({ id: 'lv1', ...b });
    }

    if (p === '/inventory/counts' && method === 'POST') { record(); const c = newCount(b); counts.unshift(c); return ok(c, 201); }
    if (p === '/inventory/counts') return ok(counts);
    const cm = p.match(/^\/inventory\/counts\/([^/]+)(?:\/(lines|submit|cancel))?$/);
    if (cm) {
      const c = counts.find((x) => x.id === cm[1]);
      if (!c) return fail(404, 'NOT_FOUND', 'Count not found');
      if (cm[2]) record();
      if (cm[2] === 'lines') {
        for (const r of b.lines ?? []) {
          const l = c.lines.find((x) => x.materialId === r.materialId);
          if (!l) continue;
          const v = r.countedQty + (r.damagedQty ?? 0) - l.systemQty;
          Object.assign(l, { countedQty: r.countedQty, damagedQty: r.damagedQty ?? 0, reason: r.reason ?? '', variance: v, varianceValue: v * l.rate, damagedValue: (r.damagedQty ?? 0) * l.rate });
        }
      }
      if (cm[2] === 'submit') {
        if (c.lines.some((l) => l.countedQty === null)) return fail(422, 'COUNT_INCOMPLETE', 'Enter the counted quantity of every item');
        Object.assign(c, { status: 'submitted', adjustmentId: `adj-${c.id}` });
      }
      if (cm[2] === 'cancel') c.status = 'cancelled';
      return ok(totals(c));
    }
    const adj = p.match(/^\/inventory\/adjustments\/adj-([^/]+)\/decision$/);
    if (adj) { record(); const c = counts.find((x) => x.id === adj[1]); if (c) c.status = b.decision === 'approved' ? 'approved' : 'rejected'; return ok({ id: `adj-${adj[1]}`, status: b.decision }); }

    if (p === '/inventory/tools' && method === 'POST') {
      record();
      if (tools.some((t) => b.serialNo && t.serialNo.toUpperCase() === String(b.serialNo).toUpperCase())) return fail(409, 'SERIAL_EXISTS', 'This serial number is already on TL-0001');
      const t: ToolHistory = { id: `t${tools.length + 1}`, code: `TL-000${tools.length + 1}`, name: String(b.name), serialNo: String(b.serialNo ?? ''), category: '', condition: 'good', status: 'available', nextServiceDue: null, serviceDue: false, holder: null, history: [], maintenance: [] };
      tools.push(t);
      return ok(plain(t), 201);
    }
    if (p === '/inventory/tools') return ok((new URLSearchParams(query).get('due') === 'service' ? tools.filter((t) => t.serviceDue) : tools).map(plain));
    const tm = p.match(/^\/inventory\/tools\/([^/]+)(?:\/([a-z]+))?$/);
    if (tm) {
      const t = tool(tm[1]);
      if (!t) return fail(404, 'NOT_FOUND', 'Tool not found');
      if (!tm[2]) return ok(t);
      record();
      const act = tm[2];
      if (act === 'issue') {
        const holder = b.holder as { kind: string; name: string };
        Object.assign(t, { status: 'issued', condition: b.condition ?? 'good', holder: { kind: holder.kind, name: holder.name, projectId: (b.projectId as string) ?? null, issuedAt: new Date().toISOString(), expectedReturn: (b.expectedReturn as string) ?? null, conditionAtIssue: b.condition ?? 'good', overdue: false } });
        move(t, 'issued');
      }
      if (act === 'return') { move(t, 'returned', { condition: String(b.condition), note: String(b.remarks ?? ''), date: String(b.returnedAt) }); Object.assign(t, { status: 'available', condition: b.condition, holder: null }); }
      if (act === 'status') { Object.assign(t, b.action === 'damaged' ? { condition: 'damaged' } : { status: b.action, condition: b.action }); move(t, String(b.action), { note: String(b.note), responsible: (b.responsible as { kind: string; name: string }) ?? null, recoveryAmount: (b.recoveryAmount as number) ?? null }); }
      if (act === 'repair') { t.status = 'in_repair'; move(t, 'repair_sent'); }
      if (act === 'repaired' || act === 'maintenance') {
        const m: ToolMaintenance = { id: `tm${t.maintenance.length + 1}`, type: act === 'repaired' ? 'repair' : (b.type as ToolMaintenance['type']), status: 'done', date: String(b.date), completedAt: String(b.date), vendor: String(b.vendor ?? ''), cost: Number(b.cost ?? 0), notes: String(b.notes ?? ''), nextDueDate: (b.nextDueDate as string) ?? null, projectId: (b.projectId as string) ?? null, project: b.projectId ? 'P-001 Worli' : null, documentIds: [] };
        t.maintenance.unshift(m);
        if (act === 'repaired') Object.assign(t, { status: 'available', condition: 'good' });
        if (m.nextDueDate) Object.assign(t, { nextServiceDue: m.nextDueDate, serviceDue: true });
        move(t, act);
        return ok(act === 'maintenance' ? m : plain(t), act === 'maintenance' ? 201 : 200);
      }
      return ok(plain(t));
    }
    return base(url, init as never);
  });
  return { calls, counts, tools, levels };
}
