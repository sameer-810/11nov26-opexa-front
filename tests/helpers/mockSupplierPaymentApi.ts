// Supplier payment / payables routes for the fake backend, layered on installMockApi (kept separate so mockApi.ts
// does not grow). Requests it does not know go to the base mock.
import type { installMockApi } from './mockApi';
import type { OpenInvoice, Payables, PaymentInput, SupplierPayment } from '../../src/modules/supplierPayment/supplierPaymentApi';

type BaseApi = ReturnType<typeof installMockApi>;
type Init = { method?: string; body?: unknown; headers?: Record<string, string> };

export function installSupplierPaymentMock(api: BaseApi) {
  const vendors = [{ id: 'v1', name: 'Cool Traders' }, { id: 'v2', name: 'Duct Works' }];
  const invoices: OpenInvoice[] = [
    { id: 'i1', number: 'CT/101', invoiceDate: '2026-09-01', dueDate: '2026-10-01', purchaseOrderId: 'po1', vendorId: 'v1', vendorName: 'Cool Traders', total: 10000, payableCap: 8000, heldForShortDelivery: 2000, inProcess: 0, settled: 0, outstanding: 10000, payableNow: 8000, daysOverdue: 53 },
    { id: 'i2', number: 'CT/102', invoiceDate: '2026-11-10', dueDate: '2026-12-10', purchaseOrderId: 'po2', vendorId: 'v1', vendorName: 'Cool Traders', total: 5000, payableCap: 5000, heldForShortDelivery: 0, inProcess: 0, settled: 0, outstanding: 5000, payableNow: 5000, daysOverdue: 0 },
  ];
  const payments: SupplierPayment[] = [];
  const requests: string[] = [];
  const payables = (basis: 'invoice' | 'due'): Payables => ({
    asOf: '2026-11-23', basis,
    vendors: [{ vendorId: 'v1', vendorName: 'Cool Traders', termsDays: 30, invoiced: 15000, paid: 0, tds: 0, advanceUnadjusted: 1000, outstanding: 15000, overdue: 10000, netPayable: 14000, ageing: basis === 'invoice' ? { notDue: 0, d0_30: 5000, d31_60: 0, d61_90: 10000, d90plus: 0 } : { notDue: 5000, d0_30: 0, d31_60: 10000, d61_90: 0, d90plus: 0 } }],
    totals: { invoiced: 15000, paid: 0, tds: 0, advanceUnadjusted: 1000, outstanding: 15000, overdue: 10000, netPayable: 14000, ageing: { notDue: 0, d0_30: 5000, d31_60: 0, d61_90: 10000, d90plus: 0 } },
    overdue: [invoices[0]],
  });
  const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
  const fail = (status: number, code: string, message: string) => ({ ok: false, status, json: async () => ({ success: false, error: { code, message, details: [] } }) });
  const base = api.fetchMock.getMockImplementation()!;
  const build = (id: string, number: string, b: PaymentInput): SupplierPayment => {
    const allocated = b.allocations.reduce((t, a) => t + a.amount, 0);
    const onAccount = b.amount + (b.tds ?? 0) - allocated;
    return {
      id, number, status: 'draft', vendor: { id: b.vendorId, name: vendors.find((v) => v.id === b.vendorId)?.name ?? '?', code: null }, date: b.date, mode: b.mode, reference: b.reference ?? '',
      amount: b.amount, tds: b.tds ?? 0, gross: b.amount + (b.tds ?? 0), allocated, onAccount, isAdvance: onAccount > 0, remarks: b.remarks ?? '', reviewComment: '', approvalRequestId: null,
      allocations: b.allocations.map((a) => ({ supplierInvoiceId: a.supplierInvoiceId, invoiceNumber: invoices.find((i) => i.id === a.supplierInvoiceId)?.number ?? null, invoiceDate: null, invoiceTotal: null, amount: a.amount, adjustedAt: null })),
      submittedAt: null, approvedAt: null, paidAt: null, cancelled: null, attachments: [], createdAt: new Date().toISOString(),
    };
  };

  api.fetchMock.mockImplementation(async (url: string, init: Init) => {
    const [p, query = ''] = url.replace(/^.*\/api\/v1/, '').split('?');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    if (p === '/vendors/names') return ok(vendors);
    if (!p.startsWith('/supplier-payments')) return base(url, init as never);
    requests.push(`${method} ${p}${query ? `?${query}` : ''}`);
    if (p === '/supplier-payments/payables') return ok(payables(new URLSearchParams(query).get('basis') === 'due' ? 'due' : 'invoice'));
    const open = p.match(/^\/supplier-payments\/vendors\/([^/]+)\/open-invoices$/);
    if (open) return ok(invoices.filter((i) => i.vendorId === open[1]));
    if (p === '/supplier-payments' && method === 'GET') return ok(payments);
    if (p === '/supplier-payments' && method === 'POST') {
      const b = body as PaymentInput;
      for (const a of b.allocations) {
        const inv = invoices.find((i) => i.id === a.supplierInvoiceId);
        if (inv && a.amount > inv.payableNow) return fail(422, 'OVER_ALLOCATED', `Invoice ${inv.number}: at most ₹${inv.payableNow} can be paid now`);
      }
      const pay = build(`sp${payments.length + 1}`, `SPAY-${String(payments.length + 1).padStart(4, '0')}`, b);
      payments.unshift(pay);
      return ok(pay, 201);
    }
    const m = p.match(/^\/supplier-payments\/([^/]+)(?:\/([a-z]+))?$/);
    const pay = m ? payments.find((x) => x.id === m[1]) : undefined;
    if (!m || !pay) return fail(404, 'NOT_FOUND', 'Supplier payment not found');
    if (!m[2]) return ok(pay);
    if (m[2] === 'submit') return ok(Object.assign(pay, { status: 'submitted' }));
    if (m[2] === 'pay') return ok(Object.assign(pay, { status: 'paid', date: body.paidDate, reference: body.reference ?? pay.reference }));
    if (m[2] === 'cancel') return ok(Object.assign(pay, { status: 'cancelled', cancelled: { reason: body.reason, at: new Date().toISOString(), fromStatus: pay.status, tallyReversedAt: null } }));
    return fail(404, 'NOT_FOUND', 'Unknown');
  });
  return { vendors, invoices, payments, requests };
}
