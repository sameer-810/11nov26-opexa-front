// Expense voucher routes for the fake backend, layered on installMockApi (kept separate so mockApi.ts does not
// grow). Requests it does not know go to the base mock.
import type { installMockApi } from './mockApi';
import type { Expense, ExpenseCategory } from '../../src/modules/expense/expenseApi';

type BaseApi = ReturnType<typeof installMockApi>;
type Init = { method?: string; body?: unknown; headers?: Record<string, string> };

export function installExpenseMock(api: BaseApi) {
  const categories: ExpenseCategory[] = [
    { id: 'c1', name: 'Travel', receiptRequired: true, tallyLedger: 'Travel', isActive: true },
    { id: 'c2', name: 'Conveyance', receiptRequired: false, tallyLedger: 'Conveyance', isActive: true },
  ];
  const vouchers: Expense[] = [];
  const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
  const fail = (status: number, code: string, message: string) => ({ ok: false, status, json: async () => ({ success: false, error: { code, message, details: [] } }) });
  const base = api.fetchMock.getMockImplementation()!;
  const project = (id: string | null) => api.projects.find((p) => p.id === id) ?? null;
  const fill = (e: Expense, body: { categoryId: string; amount: number; date: string; projectId: string | null; note: string; billNo?: string }) => {
    const p = project(body.projectId);
    Object.assign(e, { categoryId: body.categoryId, category: categories.find((c) => c.id === body.categoryId)?.name ?? '?', amount: body.amount, date: body.date, note: body.note, billNo: body.billNo ?? '', projectId: p?.id ?? null, projectCode: p?.code ?? null, projectName: p?.name ?? null });
    return e;
  };

  api.fetchMock.mockImplementation(async (url: string, init: Init) => {
    const [p, query = ''] = url.replace(/^.*\/api\/v1/, '').split('?');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    if (!p.startsWith('/expenses')) return base(url, init as never);
    if (p === '/expenses/categories') return ok(categories);
    if (p === '/expenses/mine') return ok(vouchers);
    if (p === '/expenses/report') {
      const status = new URLSearchParams(query).get('status');
      const rows = vouchers.filter((v) => !status || v.status === status);
      return ok({ rows, total: { count: rows.length, amount: rows.reduce((s, r) => s + r.amount, 0) }, byCategory: [], byProject: [] });
    }
    if (p === '/expenses' && method === 'POST') {
      const e = fill({ id: `e${vouchers.length + 1}`, number: `EXP-${String(vouchers.length + 1).padStart(4, '0')}`, status: 'draft', direct: false, employee: { id: 'u2', name: 'Ravi Kumar' }, attachments: [], reviewComment: '', approvalRequestId: null, submittedAt: null, payment: null, voided: null, createdAt: new Date().toISOString() } as unknown as Expense, body);
      vouchers.unshift(e);
      return ok(e, 201);
    }
    const m = p.match(/^\/expenses\/([^/]+)(?:\/([a-z]+))?/);
    const e = m ? vouchers.find((v) => v.id === m[1]) : undefined;
    if (!m || !e) return fail(404, 'NOT_FOUND', 'Expense not found');
    if (!m[2] && method === 'PUT') return ok(fill(e, body));
    if (!m[2]) return ok(e);
    if (m[2] === 'attachments') { e.attachments.push({ id: `a${e.attachments.length + 1}`, name: 'receipt.jpg', contentType: 'image/jpeg', size: 2048 }); return ok(e, 201); }
    if (m[2] === 'submit') {
      if (!e.attachments.length && categories.find((c) => c.id === e.categoryId)?.receiptRequired) return fail(422, 'RECEIPT_REQUIRED', 'Attach the receipt (photo or PDF) before submitting');
      return ok(Object.assign(e, { status: 'submitted', reviewComment: '' }));
    }
    if (m[2] === 'pay') {
      if (e.status !== 'approved') return fail(409, 'BAD_STATUS', 'Only an approved voucher can be marked paid');
      return ok(Object.assign(e, { status: 'paid', payment: { mode: body.mode, reference: body.reference ?? '', paidDate: body.paidDate } }));
    }
    return fail(404, 'NOT_FOUND', 'Unknown');
  });
  return { categories, vouchers };
}
