// Stock availability / "Reserve & issue plan" routes (Q13) for the fake backend, layered on installMockApi
// (kept separate so mockApi.ts does not grow). Requests it does not know go to the base mock.
// Scenario 2: copper pipe, 8 needed, Bhiwandi 3 + Thane 2 free.
import type { installMockApi } from './mockApi';
import type { StockPlan, StockPlanLine } from '../../src/modules/stockPlan/stockPlanApi';

type BaseApi = ReturnType<typeof installMockApi>;
type Init = { method?: string; body?: string; headers?: Record<string, string> };

export function installStockPlanMock(api: BaseApi, { canPlan = true } = {}) {
  const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
  const base = api.fetchMock.getMockImplementation()!;
  const calls: { method: string; path: string; body: unknown }[] = [];
  const line: StockPlanLine = {
    requisitionLineId: 'rl1', serialNo: '1', description: 'Copper pipe 5/8"', unit: 'Rmt', materialId: 'm1', stockLink: true,
    requested: 8, ordered: 0, receivedDirect: 0, fromStock: 0, need: 8,
    warehouses: [{ warehouseId: 'w2', name: 'Bhiwandi', onHand: 3, reserved: 0, available: 3 }, { warehouseId: 'w3', name: 'Thane', onHand: 2, reserved: 0, available: 2 }],
    available: 5, plan: [{ warehouseId: 'w2', name: 'Bhiwandi', qty: 3 }, { warehouseId: 'w3', name: 'Thane', qty: 2 }],
    toIssue: 5, toPurchase: 3, otherSites: [{ projectId: 'p2', name: 'P-002 Powai Mall', qty: 4 }], reservations: [],
  };
  const noLink: StockPlanLine = { ...line, requisitionLineId: 'rl2', serialNo: '2', description: 'Split AC', unit: 'Nos', materialId: null, stockLink: false, requested: 2, need: 2, warehouses: [], available: 0, plan: [], toIssue: 0, toPurchase: 2, otherSites: [] };
  const plan = (): StockPlan => ({
    requisitionId: 'r1', status: 'open', canPlan, lines: [line, noLink],
    totals: { toIssue: line.toIssue, toPurchase: line.toPurchase + noLink.toPurchase, activeReservations: line.reservations.filter((r) => r.status === 'active').length },
  });

  api.fetchMock.mockImplementation(async (url: string, init: Init) => {
    const p = url.replace(/^.*\/api\/v1/, '').split('?')[0];
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    if (p.includes('stock-plan') || p.includes('stock-reservations')) calls.push({ method, path: p, body });
    if (p === '/requisitions/r1/stock-plan') return ok(plan());
    if (p === '/requisitions/r1/stock-plan/reserve') {
      line.reservations = line.plan.map((x, i) => ({ id: `res${i + 1}`, warehouseId: x.warehouseId, warehouseName: x.name, qty: x.qty, status: 'active', transferId: null, transferNumber: null, releaseReason: '' }));
      Object.assign(line, { fromStock: 5, need: 3, toIssue: 0, plan: [] });
      return ok(plan());
    }
    if (p === '/requisitions/r1/stock-plan/transfer') {
      line.reservations = line.reservations.map((r, i) => ({ ...r, status: 'transferred', transferId: `t${i + 1}`, transferNumber: `STR-000${i + 1}` }));
      return ok({ transfers: [], plan: plan() }, 201);
    }
    const rel = p.match(/^\/requisitions\/stock-reservations\/([^/]+)\/release$/);
    if (rel) {
      const r = line.reservations.find((x) => x.id === rel[1]);
      if (r) Object.assign(r, { status: 'released', releaseReason: body.reason });
      return ok(plan());
    }
    return base(url, init);
  });
  return { calls, line };
}
