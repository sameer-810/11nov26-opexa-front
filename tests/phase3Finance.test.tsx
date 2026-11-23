// 3D-3G screens on their own, against a small fake backend: extra materials, BOQ-wise profit, change requests,
// estimate on project create, invoice "Additional items" section, retention release and payment register.
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExtraMaterialsTab } from '../src/modules/projectFinance/ExtraMaterialsTab';
import { BoqProfitTab } from '../src/modules/projectFinance/BoqProfitTab';
import { ChangeRequestsTab } from '../src/modules/projectFinance/ChangeRequestsTab';
import { RetentionTab } from '../src/modules/subcontract/RetentionTab';
import { EstimateSummaryFields, emptyEstimate, estimateBody, type EstimateDraft } from '../src/modules/project/components/EstimateSummaryFields';
import { lineGroups, type InvoiceLine } from '../src/modules/invoice/invoiceApi';

type Route = (method: string, path: string, body: Record<string, unknown>) => unknown;
function installFetch(route: Route) {
  const calls: { method: string; path: string; body: Record<string, unknown> }[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async (url: string, init: { method?: string; body?: unknown } = {}) => {
    const path = url.replace(/^.*\/api\/v1/, '');
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
    calls.push({ method, path, body });
    const data = route(method, path, body);
    if (data instanceof Error) return { ok: false, status: 422, json: async () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: data.message, details: [] } }) };
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  });
  return calls;
}

test('3D - extra material report per BOQ line with billable status', async () => {
  installFetch(() => ({
    totals: { cost: 51000, billableCost: 0, nonBillableCost: 51000 },
    lines: [{ workOrderItemId: 'i11', serialNo: '1.1', description: 'Ductable AC 11 TR', cost: 51000, billableCost: 0, materials: [
      { materialId: 'm1', name: 'Copper pipe 7/8', unit: 'Rmt', requested: 50, billableRequested: 0, ordered: 50, orderedValue: 45000, received: 50, issuedToSubcontractor: 20, consumed: 15, cost: 45000, billableCost: 0, billable: 'non_billable', extraWork: [] },
    ] }],
  }));
  await render(<ExtraMaterialsTab id="p1" canLink={false} />);
  expect(await screen.findByTestId('extras-total')).toHaveTextContent(/Extra material cost ₹51,000.00/);
  expect(screen.getByTestId('extras-line-1.1')).toHaveTextContent(/Copper pipe 7\/8: requested 50 · ordered 50 · received 50 · with subcontractor 20 · used 15 Rmt/);
  expect(screen.getByTestId('extras-line-1.1')).toHaveTextContent(/Non-billable/);
});

test('3D - purchaser marks an extra-material request line billable through an approved extra-work item, or unlinks it', async () => {
  const mat = (extraWorkItemId: string | null) => ({ materialId: 'm1', name: 'Copper pipe 7/8', unit: 'Rmt', requested: 30, billableRequested: extraWorkItemId ? 30 : 0, ordered: 30, orderedValue: 27000, received: 30, issuedToSubcontractor: 0, consumed: 0, cost: 27000, billableCost: extraWorkItemId ? 27000 : 0, billable: extraWorkItemId ? 'billable' : 'non_billable', extraWork: extraWorkItemId ? ['A1'] : [],
    requests: [{ requisitionId: 'r1', number: 'MR-0001', lineId: 'l1', qty: 30, extraWorkItemId, extraWorkSerialNo: extraWorkItemId ? 'A1' : null }] });
  let linked: string | null = null;
  const report = () => ({ totals: { cost: 27000, billableCost: linked ? 27000 : 0, nonBillableCost: linked ? 0 : 27000 }, extraWorkOptions: [{ id: 'a1', serialNo: 'A1', description: 'Extra piping to new FCU' }],
    lines: [{ workOrderItemId: 'i11', serialNo: '1.1', description: 'Ductable AC', cost: 27000, billableCost: 0, materials: [mat(linked)] }] });
  const calls = installFetch((method, path, body) => {
    if (path.endsWith('/extra-materials/link')) linked = (body.extraWorkItemId as string | null) ?? null;
    return report();
  });
  await render(<ExtraMaterialsTab id="p1" canLink />);
  expect(await screen.findByTestId('extras-req-l1')).toHaveTextContent(/MR-0001 · 30 · not billed/);
  await fireEvent.press(screen.getByTestId('extras-mark-l1'));
  await fireEvent.press(screen.getByTestId('extras-pick-l1-a1'));
  expect(await screen.findByTestId('extras-unlink-l1')).toBeTruthy();
  expect(screen.getByTestId('extras-req-l1')).toHaveTextContent(/MR-0001 · 30 · billed via A1/);
  expect(calls.find((c) => c.path === '/projects/p1/extra-materials/link')?.body).toEqual({ requisitionId: 'r1', lineId: 'l1', extraWorkItemId: 'a1' });
  await fireEvent.press(await screen.findByTestId('extras-unlink-l1'));
  expect(await screen.findByTestId('extras-mark-l1')).toBeTruthy();
  expect(calls.filter((c) => c.path.endsWith('/link')).pop()?.body).toEqual({ requisitionId: 'r1', lineId: 'l1', extraWorkItemId: null });
});

test('3D - without the purchase / project permission the link buttons are hidden', async () => {
  installFetch(() => ({ totals: { cost: 1, billableCost: 0, nonBillableCost: 1 }, extraWorkOptions: [{ id: 'a1', serialNo: 'A1', description: 'x' }], lines: [{ workOrderItemId: 'i', serialNo: '1', description: 'AC', cost: 1, billableCost: 0, materials: [{ materialId: 'm', name: 'Pipe', unit: 'Rmt', requested: 1, billableRequested: 0, ordered: 0, orderedValue: 0, received: 0, issuedToSubcontractor: 0, consumed: 0, cost: 1, billableCost: 0, billable: 'non_billable', extraWork: [], requests: [{ requisitionId: 'r', number: 'MR-1', lineId: 'l', qty: 1, extraWorkItemId: null, extraWorkSerialNo: null }] }] }] }));
  await render(<ExtraMaterialsTab id="p1" canLink={false} />);
  await screen.findByTestId('extras-req-l');
  expect(screen.queryByTestId('extras-mark-l')).toBeNull();
});

test('3F - BOQ-wise profitability highlights the overrun line', async () => {
  installFetch(() => ({
    rule: 'Shared by BOQ value.',
    totals: { revenue: 10000000, estimatedCost: 8800000, actualCost: 9400000, billed: 3000000, forecastMargin: 600000, forecastMarginPct: 6, overrunLines: 1 },
    lines: [{ workOrderItemId: 'i1', serialNo: '1', description: 'HVAC works', tendered: true, revenue: 10000000, estimatedCost: 8800000, actualCost: 9400000, billed: 3000000, actual: { material: 5000000, extraMaterial: 51000, subcontract: 2400000, allocated: 2000000 }, forecastMargin: 600000, forecastMarginPct: 6, overrun: true, overrunBy: 600000 }],
  }));
  await render(<BoqProfitTab id="p1" />);
  expect(await screen.findByTestId('profit-total')).toHaveTextContent(/forecast margin ₹6,00,000.00 \(6%\)/);
  expect(screen.getByText(/1 BOQ line\(s\) have cost above the estimate/)).toBeTruthy();
  expect(screen.getByTestId('profit-actual-1')).toHaveTextContent(/extra ₹51,000.*over estimate by ₹6,00,000.00/);
});

test('3E - raise a change request, client approval needs the reference; register shows billed / unbilled', async () => {
  const crs = [{ id: 'c1', number: 'CR-0001', description: 'Two more FCUs', clientReference: '', requestedBy: 'Mr. Shah', requestedOn: '2026-11-10', reason: '', status: 'raised', value: 60000, documents: [], items: [{ id: 'a1', serialNo: 'A1', description: 'FCU 2 TR', unit: 'Nos', quantity: 2, rate: 30000, value: 60000, status: 'approved' }] }];
  const reg = { boqRevision: 0, summary: { excessLines: 0, excessValue: 0, additionalLines: 1, additionalValue: 60000, unconfirmedAdditional: 1, additionalBilled: 30000, additionalUnbilled: 30000 }, rows: [{ workOrderItemId: 'a1', serialNo: 'A1', description: 'FCU 2 TR', unit: 'Nos', tendered: false, boqQty: 2, executed: 1, billed: 1, excess: 0, excessValue: 0, additionalValue: 60000, clientApprovalRef: null, status: 'additional – awaiting client confirmation', billedValue: 30000, unbilledQty: 1, unbilledValue: 30000, changeRequest: 'CR-0001', documents: 0 }] };
  const calls = installFetch((method, path) => {
    if (path.endsWith('/change-requests') && method === 'GET') return crs;
    if (path.endsWith('/boq-regularisation')) return reg;
    return crs[0];
  });
  await render(<ChangeRequestsTab id="p1" pm />);
  expect(await screen.findByTestId('aw-register-total')).toHaveTextContent(/billed ₹30,000.00 · unbilled ₹30,000.00/);
  expect(screen.getByTestId('aw-A1')).toHaveTextContent(/S.No A1 FCU 2 TR · CR-0001/);
  expect(screen.getByTestId('cr-CR-0001')).toHaveTextContent(/Requested by Mr. Shah/);
  await fireEvent.changeText(screen.getByTestId('cr-ref-CR-0001'), 'PMC/112');
  await fireEvent.press(screen.getByTestId('cr-approve-CR-0001'));
  await screen.findByTestId('pf-changes');
  expect(calls.find((c) => c.path === '/projects/p1/change-requests/c1/status')?.body).toEqual({ status: 'client_approved', clientReference: 'PMC/112' });
  await fireEvent.changeText(screen.getByTestId('cr-desc'), 'Extra grilles in corridor');
  await fireEvent.changeText(screen.getByTestId('cr-by'), 'Client PMC');
  await fireEvent.press(screen.getByTestId('cr-save'));
  await screen.findByTestId('pf-changes');
  expect(calls.find((c) => c.method === 'POST' && c.path === '/projects/p1/change-requests')?.body).toMatchObject({ description: 'Extra grilles in corridor', requestedBy: 'Client PMC' });
});

test('3F - estimate summary on project create: total cost, profit and margin', async () => {
  let latest: EstimateDraft = emptyEstimate;
  function Harness() {
    const [v, setV] = useState<EstimateDraft>(emptyEstimate);
    latest = v;
    return <EstimateSummaryFields value={v} onChange={setV} />;
  }
  await render(<Harness />);
  await fireEvent.changeText(screen.getByTestId('pf-est-contract'), '10000000');
  for (const [k, val] of [['material', '5000000'], ['installation', '2000000'], ['subcontract', '1000000'], ['labour', '500000'], ['transport', '200000'], ['other', '100000']]) await fireEvent.changeText(screen.getByTestId(`pf-est-${k}`), val);
  expect(screen.getByTestId('pf-est-result')).toHaveTextContent(/Total cost ₹88,00,000.00 · revenue ₹1,00,00,000.00 · profit ₹12,00,000.00 · margin 12%/);
  expect(estimateBody(latest)).toEqual({ contractValue: 10000000, estimateLumpSum: { material: 5000000, installation: 2000000, subcontract: 1000000, labour: 500000, transport: 200000, other: 100000 } });
  expect(estimateBody(emptyEstimate)).toEqual({});
});

test('3E - invoice lines: extra-work lines in their own "Additional / non-tendered items" section', () => {
  const line = (serialNo: string, additional?: boolean): InvoiceLine => ({ id: serialNo, workOrderItemId: serialNo, serialNo, description: 'x', unit: 'Nos', boqQty: 1, billedBefore: 0, qty: 1, rate: 1, amount: 1, overBoq: false, overBoqChoice: null, additional });
  expect(lineGroups([line('1'), line('A1', true)]).map((g) => [g.title, g.lines.map((l) => l.serialNo)])).toEqual([['BOQ (tendered) items', ['1']], ['Additional / non-tendered items', ['A1']]]);
  expect(lineGroups([line('1'), line('2')])).toEqual([{ key: 'all', title: '', lines: [line('1'), line('2')] }]); // older invoices unchanged
});

test('3G - retention release request and payment register', async () => {
  const calls = installFetch((method, path) => {
    if (path.startsWith('/subcontract/retention-releases') && method === 'GET') return [{ id: 'r1', number: 'RR-0001', agreementId: 'a1', subcontractorId: 's1', amount: 1200, basis: 'dlp_completed', reason: '', status: 'approved', paid: 0, outstanding: 1200, createdAt: '2026-11-20' }];
    if (path.startsWith('/subcontract/payment-register')) return { rows: [{ date: '2026-11-01', type: 'certificate', reference: 'PC-0001', subcontractor: 'Cool Fitters', gross: 24000, deductions: 0, retention: 1200, advanceRecovery: 0, payable: 22800, paid: 0, balance: 22800 }, { date: '2026-11-05', type: 'payment', reference: 'PC-0001 · NEFT 1', subcontractor: 'Cool Fitters', gross: 0, deductions: 0, retention: 0, advanceRecovery: 0, payable: 0, paid: 20000, balance: 2800 }], totals: { gross: 24000, deductions: 0, retention: 1200, advanceRecovery: 0, payable: 22800, paid: 20000, balance: 2800 } };
    if (path.endsWith('/retention')) return { agreementId: 'a1', dlpEndsOn: '2026-11-01', held: 1200, released: 0, available: 1200 };
    return {};
  });
  await render(<RetentionTab agreements={[{ id: 'a1', number: 'SCA-0001', subcontractorId: 's1', projectId: 'p1', title: 'Piping', retentionPct: 5, advanceRecoveryPct: 0, status: 'active', revision: 0 }]} subs={[{ id: 's1', code: 'SC-0001', name: 'Cool Fitters', phone: '', gstin: null, categories: [], isActive: true }]} pm finance />);
  expect(await screen.findByTestId('reg-row-0')).toHaveTextContent(/Certificate PC-0001 · gross ₹24,000.00 − deductions ₹0.00 − retention ₹1,200.00 − advance ₹0.00 = ₹22,800.00 · balance ₹22,800.00/);
  expect(screen.getByTestId('reg-totals')).toHaveTextContent(/Payable ₹22,800.00 · paid ₹20,000.00 · balance ₹2,800.00/);
  await fireEvent.press(screen.getByTestId('ret-agreement-a1'));
  expect(await screen.findByTestId('ret-position')).toHaveTextContent(/Held ₹1,200.00 · released ₹0.00 · available ₹1,200.00/);
  await fireEvent.changeText(screen.getByTestId('ret-amount'), '1200');
  await fireEvent.press(screen.getByTestId('ret-save'));
  await screen.findByTestId('sc-retention');
  expect(calls.find((c) => c.method === 'POST' && c.path === '/subcontract/retention-releases')?.body).toEqual({ agreementId: 'a1', amount: 1200, basis: 'dlp_completed' });
  await fireEvent.changeText(screen.getByTestId('rel-pay-RR-0001'), '1200');
  await fireEvent.press(screen.getByTestId('rel-pay-save-RR-0001'));
  await screen.findByTestId('sc-retention');
  expect(calls.some((c) => c.path === '/subcontract/retention-releases/r1/payments' && c.body.amount === 1200)).toBe(true);
});
