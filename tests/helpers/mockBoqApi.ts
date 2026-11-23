// BOQ format (Q18), BOQ view and column settings (Q19) for the fake backend, layered on installMockApi
// (kept separate so mockApi.ts does not grow). Requests it does not know go to the base mock.
import type { installMockApi } from './mockApi';
import type { BoqColumn, BoqColumnKey, BoqFormat } from '../../src/modules/project/types';

type BaseApi = ReturnType<typeof installMockApi>;
type Init = { method?: string; body?: unknown };
type Line = { id: string; projectId: string; serialNo: string; quantity: number; rate: number; amount: number; [k: string]: unknown };
type Extra = { executedQty?: number; approvedQty?: number; variationQty?: number | null };

const ALL: [BoqColumnKey, string][] = [
  ['serialNo', 'Item no.'], ['description', 'Description'], ['unit', 'Unit'], ['quantity', 'BOQ qty'], ['supplyRate', 'Supply rate'], ['installationRate', 'Installation rate'],
  ['rate', 'SITC rate'], ['variationQty', 'Variation qty'], ['executedQty', 'Execution qty'], ['approvedQty', 'Approved qty'],
  ['supplyAmount', 'Supply amount'], ['installationAmount', 'Installation amount'], ['amount', 'Amount'], ['remarks', 'Remarks'],
];
const SPLIT_ONLY: BoqColumnKey[] = ['supplyRate', 'installationRate', 'supplyAmount', 'installationAmount'];

export function installBoqMock(api: BaseApi) {
  const saved: Record<string, BoqColumn[]> = {};
  const extras: Record<string, Extra> = {};
  const columnSaves: BoqColumn[][] = [];
  const itemBodies: Record<string, unknown>[] = [];
  const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
  const base = api.fetchMock.getMockImplementation()!;
  const formatOf = (projectId: string): BoqFormat => ((api.projects.find((p) => p.id === projectId) as { boqFormat?: BoqFormat } | undefined)?.boqFormat ?? 'sitc');
  const columnsFor = (projectId: string): BoqColumn[] => {
    const split = formatOf(projectId) === 'supply_installation';
    return ALL.filter(([k]) => split || !SPLIT_ONLY.includes(k)).map(([key, label], order) => saved[projectId]?.find((c) => c.key === key) ?? { key, label, visible: true, order }).sort((a, b) => a.order - b.order);
  };
  const boq = api.boq as unknown as Line[];

  api.fetchMock.mockImplementation(async (url: string, init: Init) => {
    const p = url.replace(/^.*\/api\/v1/, '').split('?')[0];
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const m = p.match(/^\/projects\/([^/]+)\/(boq-view|boq-columns|boq)$/);
    if (m && m[2] === 'boq-view') {
      const lines = boq.filter((i) => i.projectId === m[1]).map((i) => {
        const x = extras[i.id] ?? {};
        const peak = Math.max(x.executedQty ?? 0, x.approvedQty ?? 0);
        return { description: `Item ${i.serialNo}`, unit: 'Nos', remarks: '', ...i, variationQty: x.variationQty ?? null, executedQty: x.executedQty ?? 0, approvedQty: x.approvedQty ?? 0, billedQty: 0, overBoq: peak > i.quantity, overBoqQty: Math.max(0, peak - i.quantity) };
      });
      return ok({ projectId: m[1], boqFormat: formatOf(m[1]), boqLocked: false, columns: columnsFor(m[1]), lines, totals: { amount: lines.reduce((s, l) => s + l.amount, 0), supplyAmount: null, installationAmount: null, overBoqLines: lines.filter((l) => l.overBoq).length } });
    }
    if (m && m[2] === 'boq-columns' && method === 'PUT') {
      columnSaves.push(body.columns);
      saved[m[1]] = body.columns;
      return ok(columnsFor(m[1]));
    }
    if (m && m[2] === 'boq' && method === 'POST' && formatOf(m[1]) === 'supply_installation') {
      itemBodies.push(body);
      const rate = body.supplyRate + body.installationRate;
      const item = { id: `i${boq.length + 1}`, projectId: m[1], ...body, rate, amount: body.quantity * rate, supplyAmount: body.quantity * body.supplyRate, installationAmount: body.quantity * body.installationRate };
      boq.push(item);
      return ok(item, 201);
    }
    return base(url, init as never);
  });

  return {
    columnSaves, itemBodies,
    setColumns: (projectId: string, cols: BoqColumn[]) => { saved[projectId] = cols; },
    setQuantities: (itemId: string, x: Extra) => { extras[itemId] = x; },
  };
}
