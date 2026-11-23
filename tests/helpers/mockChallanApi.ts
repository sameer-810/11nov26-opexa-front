// Delivery challan and return-to-store routes for the fake backend, layered on installMockApi
// (kept separate so mockApi.ts does not grow). Requests it does not know go to the base mock.
import type { installMockApi } from './mockApi';
import type { DeliveryChallan } from '../../src/modules/deliveryChallan/types';

type BaseApi = ReturnType<typeof installMockApi>;
type Init = { method?: string; body?: unknown; headers?: Record<string, string> };
type ReqLine = { id: string; serialNo: string; description: string; unit: string; qtyRequested: number; qtyApproved?: number; received?: number; pending?: number; receivable?: number; specification?: string };

export function installChallanMock(api: BaseApi) {
  const challans: DeliveryChallan[] = [];
  const printed: string[] = [];
  const warehouses = [{ id: 'w1', code: 'CS', name: 'Central Store', isCentral: true }, { id: 'w2', code: 'BHW', name: 'Bhiwandi Store', isCentral: false }];
  const decisions: unknown[] = [];
  const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
  const fail = (status: number, code: string, message: string, details: unknown[] = []) => ({ ok: false, status, json: async () => ({ success: false, error: { code, message, details } }) });
  const base = api.fetchMock.getMockImplementation()!;

  const createChallan = (body: { requisitionId: string; lines: { lineId: string; qty: number }[]; supplierName?: string; vendorChallanNo?: string; vehicleNo?: string; receivedByName?: string; remarks?: string }) => {
    const req = api.reqs.find((r) => r.id === body.requisitionId);
    const problems = body.lines
      .map((x) => ({ x, l: req.lines.find((l: ReqLine) => l.id === x.lineId) as ReqLine }))
      .filter(({ x, l }) => x.qty > (l.receivable ?? 0))
      .map(({ l }) => ({ field: l.id, message: `S.No ${l.serialNo}: only ${l.receivable} ${l.unit} pending` }));
    if (problems.length) return fail(422, 'OVER_PENDING', 'More than the pending quantity', problems);
    const number = `DC-${String(challans.length + 1).padStart(4, '0')}`;
    const lines = body.lines.filter((x) => x.qty > 0).map((x, i) => {
      const l = req.lines.find((y: ReqLine) => y.id === x.lineId) as ReqLine;
      const approved = l.qtyApproved ?? l.qtyRequested;
      const before = l.received ?? 0;
      Object.assign(l, { received: before + x.qty, pending: approved - before - x.qty, receivable: (l.receivable ?? 0) - x.qty });
      return { id: `dl${i}`, requisitionLineId: l.id, serialNo: l.serialNo, description: l.description, unit: l.unit, specification: l.specification ?? '', billable: true, qtyRequested: l.qtyRequested, qtyApproved: approved, deliveredBefore: before, qty: x.qty, cumulative: before + x.qty, pending: approved - before - x.qty, poQty: 0, directQty: x.qty };
    });
    const at = new Date().toISOString();
    const dc: DeliveryChallan = {
      id: `dc${challans.length + 1}`, number, date: at, status: 'active', projectId: req.projectId, projectName: req.projectName, projectCode: req.projectCode, requisitionId: req.id, requisitionNumber: req.number,
      deliveryAddress: req.deliveryAddress ?? '', vendor: null, supplierName: body.supplierName ?? '', vendorChallanNo: body.vendorChallanNo ?? '', vehicleNo: body.vehicleNo ?? '', remarks: body.remarks ?? '',
      receivedByName: body.receivedByName ?? '', preparedBy: { id: 'u2', name: 'Ravi Kumar' }, cancelledBy: null, cancelledAt: null, cancelReason: '', createdAt: at, attachments: [],
      history: [{ action: 'created', by: { id: 'u2', name: 'Ravi Kumar' }, at, comment: '' }], lines,
    };
    challans.unshift(dc);
    return ok(dc, 201);
  };

  api.fetchMock.mockImplementation(async (url: string, init: Init) => {
    const path = url.replace(/^.*\/api\/v1/, '');
    const [p, query = ''] = path.split('?');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const params = new URLSearchParams(query);
    if (p === '/delivery-challans' && method === 'POST') return createChallan(body);
    if (p === '/delivery-challans') {
      const q = (params.get('q') ?? '').toLowerCase();
      return ok(challans.filter((c) => (!params.get('requisitionId') || c.requisitionId === params.get('requisitionId')) && (!params.get('projectId') || c.projectId === params.get('projectId'))
        && (!q || c.number.toLowerCase().includes(q) || c.vendorChallanNo.toLowerCase().includes(q))));
    }
    const dcM = p.match(/^\/delivery-challans\/([^/]+)(\/[a-z-]+)?$/);
    if (dcM) {
      const dc = challans.find((c) => c.id === dcM[1]);
      if (!dc) return fail(404, 'NOT_FOUND', 'Delivery challan not found');
      if (dcM[2] === '/print-link') { printed.push(dc.id); return ok({ url: `/print/delivery-challans/${dc.id}?exp=1&sig=x` }); }
      if (dcM[2] === '/attachments') { dc.attachments.push({ id: `a${dc.attachments.length + 1}`, name: 'photo.jpg', contentType: 'image/jpeg', size: 2048 }); return ok(dc, 201); }
      if (dcM[2] === '/cancel') Object.assign(dc, { status: 'cancelled', cancelReason: body.reason, cancelledBy: { id: 'u1', name: 'Owner' }, cancelledAt: new Date().toISOString() });
      return ok(dc);
    }
    if (p === '/transfer-targets/warehouses') return ok(warehouses);
    const rtM = p.match(/^\/returns\/([^/]+)\/(print-link\/[a-z]+|decision)$/);
    if (rtM) {
      const r = api.returns.find((x) => x.id === rtM[1]);
      if (rtM[2].startsWith('print-link')) { printed.push(`${r.id}:${rtM[2].split('/')[1]}`); return ok({ url: `/print/returns/${r.id}/${rtM[2].split('/')[1]}?exp=1&sig=x` }); }
      decisions.push(body);
      Object.assign(r, { status: body.decision, decidedBy: { id: 'u9', name: 'Store Keeper' }, decidedAt: new Date().toISOString(), decisionNote: body.note ?? '' });
      for (const g of body.receivedLines ?? []) Object.assign(r.lines.find((l: { id: string }) => l.id === g.lineId), { qtyReceived: g.qtyReceived });
      return ok(r);
    }
    return base(url, init as Parameters<typeof base>[1]);
  });
  return { challans, printed, warehouses, decisions };
}
