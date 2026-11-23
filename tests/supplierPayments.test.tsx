import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { installSupplierPaymentMock } from './helpers/mockSupplierPaymentApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  // The real accounts role also verifies supplier invoices (the shared mock's defaults predate that).
  api.addUser({ email: 'meena@airtech.in', password: 'Meena12345', role: 'accounts', name: 'Meena', permissions: ['invoice.create', 'invoice.edit', 'reports.view', 'attendance.self', 'supplierInvoice.verify'] });
  api.addUser({ email: 'buyer@airtech.in', password: 'Buyer12345', role: 'purchaser', name: 'Bala' });
  return { api, sp: installSupplierPaymentMock(api) };
}

async function signIn(email: string, password: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
}

describe('4X - Supplier payables and payments', () => {
  test('payables show outstanding, overdue, advances and ageing by invoice or due date', async () => {
    const { sp } = setup();
    await signIn('meena@airtech.in', 'Meena12345');
    await fireEvent.press(await screen.findByTestId('tile-payables'));
    const card = await screen.findByTestId('payable-Cool Traders');
    expect(card).toHaveTextContent(/Outstanding ₹15,000.*net ₹14,000/);
    expect(card).toHaveTextContent(/Overdue ₹10,000/);
    expect(card).toHaveTextContent(/Advance not adjusted ₹1,000/);
    expect(screen.getByTestId('payables-ageing')).toHaveTextContent(/0-30 days ₹5,000(\.00)? · 61-90 days ₹10,000/);
    expect(screen.getByTestId('overdue-CT/101')).toHaveTextContent(/overdue by 53 days/);
    await fireEvent.press(screen.getByTestId('payables-basis-due'));
    await waitFor(() => expect(sp.requests).toContain('GET /supplier-payments/payables?basis=due'));
    expect(await screen.findByText(/Not due ₹5,000(\.00)? · 31-60 days ₹10,000/)).toBeTruthy();
    expect(screen.getByTestId('new-supplier-payment')).toBeTruthy();
  });

  test('a buyer sees payables but cannot record a payment', async () => {
    setup();
    await signIn('buyer@airtech.in', 'Buyer12345');
    await fireEvent.press(await screen.findByTestId('tile-payables'));
    await screen.findByTestId('payable-Cool Traders');
    expect(screen.queryByTestId('new-supplier-payment')).toBeNull();
    expect(screen.queryByTestId('pay-vendor-Cool Traders')).toBeNull();
  });

  test('payment form: shows the payable cap, refuses more than can be paid, records the rest as an advance and submits', async () => {
    const { sp } = setup();
    await signIn('meena@airtech.in', 'Meena12345');
    await fireEvent.press(await screen.findByTestId('tile-payables'));
    await fireEvent.press(await screen.findByTestId('pay-vendor-Cool Traders'));
    const inv = await screen.findByTestId('spay-inv-CT/101');
    expect(inv).toHaveTextContent(/can pay now ₹8,000/);
    expect(screen.getByTestId('spay-held-CT/101')).toHaveTextContent(/₹2,000(\.00)? held: billed for quantity not received or accepted/);

    await fireEvent.changeText(screen.getByTestId('spay-amount'), '9,000');
    await fireEvent.changeText(screen.getByTestId('spay-alloc-CT/101'), '10000');
    await fireEvent.press(screen.getByTestId('spay-submit'));
    expect(await screen.findByTestId('spay-problem')).toHaveTextContent(/Invoice CT\/101: at most ₹8,000(\.00)? can be paid now/);
    expect(screen.getByTestId('spay-problem-bottom')).toHaveTextContent(/at most ₹8,000(\.00)? can be paid now/);
    expect(sp.payments).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('spay-full-CT/101'));
    await fireEvent.changeText(screen.getByTestId('spay-tds'), '100');
    await fireEvent.press(screen.getByTestId('spay-mode-cheque'));
    await fireEvent.changeText(screen.getByTestId('spay-reference'), 'CHQ-4411');
    expect(screen.getByTestId('spay-summary')).toHaveTextContent(/Against invoices ₹8,000(\.00)? · payment \+ TDS ₹9,100/);
    expect(screen.getByTestId('spay-advance')).toHaveTextContent(/₹1,100(\.00)? will be an advance on account/);
    await fireEvent.press(screen.getByTestId('spay-submit'));

    expect(await screen.findByTestId('supplier-payment-detail')).toBeTruthy();
    await waitFor(() => expect(sp.payments[0]).toMatchObject({ number: 'SPAY-0001', status: 'submitted', amount: 9000, tds: 100, mode: 'cheque', reference: 'CHQ-4411', vendor: { id: 'v1' } }));
    expect(sp.payments[0].allocations).toEqual([expect.objectContaining({ supplierInvoiceId: 'i1', amount: 8000 })]);
    expect(sp.requests).toEqual(expect.arrayContaining(['POST /supplier-payments', 'POST /supplier-payments/sp1/submit']));
    expect(await screen.findByTestId('spay-status')).toHaveTextContent('Waiting for approval');
    expect(screen.getByTestId('spay-advance-chip')).toHaveTextContent(/Advance ₹1,100(\.00)? not adjusted/);
  });
});

test('Q28 - a director reads supplier payables (the dashboard drill) but does not pay', () => {
  const { canSeePayables, canPaySuppliers } = jest.requireActual('../src/modules/supplierPayment/supplierPaymentApi');
  const director = { id: 'd1', name: 'Anil', email: 'anil@x.in', role: 'director', permissions: ['reports.view', 'project.view', 'approval.act'] };
  expect(canSeePayables(director)).toBe(true);
  expect(canPaySuppliers(director)).toBe(false);
  expect(canSeePayables({ ...director, role: 'hod', permissions: ['reports.view', 'approval.act'] })).toBe(false);
});
