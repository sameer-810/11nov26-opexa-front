// Measurement sheets (3C) and the over-BOQ block (Q20) for the fake backend: enough to render MeasurementTab on
// its own. Kept separate so mockApi.ts does not grow.
import type { Correction, LowSide, Sheet } from '../../src/modules/billing/billingApi';

type Init = { method?: string; body?: unknown };
type ActionBody = { action: string; role?: Correction['role']; clientEngineer?: string; corrections?: { rowId: string; correctedQty: number; reason?: string }[] };

export function installMeasurementMock({ lowSide, sheets }: { lowSide: LowSide[]; sheets: Sheet[] }) {
  const actions: ActionBody[] = [];
  const invoices: { sheetIds: string[] }[] = [];
  let overBoq: { message: string; details: { field: string; message: string }[] } | null = null;
  const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
  const fail = (status: number, code: string, message: string, details: unknown[] = []) => ({ ok: false, status, json: async () => ({ success: false, error: { code, message, details } }) });

  const fetchMock = jest.fn(async (url: string, init: Init = {}) => {
    const p = url.replace(/^.*\/api\/v1/, '').split('?')[0];
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    if (/\/billing-position$/.test(p)) return ok({ planStatus: 'approved', highSideValue: 0, milestones: [], lowSide });
    if (/\/measurement-sheets$/.test(p)) return ok(sheets);
    if (/\/measurement-invoices$/.test(p)) {
      if (overBoq) return fail(422, 'OVER_BOQ', overBoq.message, overBoq.details);
      invoices.push(body);
      return ok({ id: 'inv-1' }, 201);
    }
    const act = p.match(/\/measurement-sheets\/([^/]+)\/action$/);
    if (act) {
      const sh = sheets.find((x) => x.id === act[1]);
      if (!sh) return fail(404, 'NOT_FOUND', 'Measurement sheet not found');
      const b = body as ActionBody;
      actions.push(b);
      for (const c of b.corrections ?? []) {
        const row = sh.rows.find((r) => r.id === c.rowId);
        if (!row) continue;
        const byName = b.action === 'client_verify' || b.role === 'client_engineer' ? b.clientEngineer ?? sh.clientEngineer : 'Priya';
        sh.corrections.push({ rowId: row.id, oldQty: row.correctedQty ?? row.qty, newQty: c.correctedQty, byName, role: b.role ?? 'client_engineer', at: '2026-11-23T10:00:00.000Z', reason: c.reason ?? '', legacy: false });
        row.correctedQty = c.correctedQty;
      }
      sh.finalQty = sh.rows.reduce((a, r) => a + (r.deduct ? -1 : 1) * (r.correctedQty ?? r.qty), 0);
      return ok({ ...sh, warning: null });
    }
    return fail(404, 'NOT_FOUND', `No mock for ${p}`);
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return { fetchMock, actions, invoices, blockOverBoq: (message: string, details: { field: string; message: string }[]) => { overBoq = { message, details }; } };
}
