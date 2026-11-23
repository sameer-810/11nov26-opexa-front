import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { installStockPlanMock } from './helpers/mockStockPlanApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup(canPlan = true) {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.addUser({ email: 'buyer@airtech.in', password: 'Buyer12345', role: 'purchaser', name: 'Sana Buyer' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] });
  api.reqs.push({
    id: 'r1', number: 'MR-0001', projectId: 'p1', projectName: 'Worli', projectCode: 'P-001', raisedBy: { id: 'u9', name: 'Ravi' }, note: '', neededBy: null,
    status: 'open', cancelReason: null, createdAt: new Date().toISOString(), overBoq: false,
    lines: [{ id: 'rl1', workOrderItemId: 'i1', serialNo: '1', description: 'Copper pipe 5/8"', unit: 'Rmt', boqQty: 100, previouslyRequested: 0, qtyRequested: 8, overBy: 0, overrideReason: null }],
  });
  return { api, stock: installStockPlanMock(api, { canPlan }) };
}

async function openRequest() {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'buyer@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Buyer12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-requisitions'));
  await fireEvent.press(await screen.findByTestId('req-MR-0001'));
  await screen.findByTestId('stock-plan');
}

describe('Phase 2E - stock availability panel on a material request (Q13)', () => {
  test('Scenario 2: shows requested / available per warehouse / issue 5 / buy 3, then reserves and creates the transfer', async () => {
    const { stock } = setup();
    await openRequest();
    expect(screen.getByTestId('stock-plan-line-1')).toHaveTextContent(/Requested 8 Rmt/);
    expect(screen.getByTestId('stock-plan-available-1')).toHaveTextContent('Available 5: Bhiwandi 3, Thane 2');
    expect(screen.getByTestId('stock-plan-issue-1')).toHaveTextContent('To issue 5');
    expect(screen.getByTestId('stock-plan-buy-1')).toHaveTextContent('To purchase 3');
    expect(screen.getByTestId('stock-plan-line-1')).toHaveTextContent(/Other sites \(information only\): P-002 Powai Mall 4/);
    // A BOQ line not linked to a stock material is all to purchase.
    expect(screen.getByTestId('stock-plan-nolink-2')).toHaveTextContent('No stock link');
    expect(screen.getByTestId('stock-plan-buy-2')).toHaveTextContent('To purchase 2');
    expect(screen.queryByTestId('stock-plan-transfer')).toBeNull();

    await fireEvent.press(screen.getByTestId('stock-plan-reserve'));
    expect(await screen.findByTestId('reservation-res1')).toHaveTextContent(/^Reserved 3 at Bhiwandi/);
    expect(screen.getByTestId('reservation-res2')).toHaveTextContent(/^Reserved 2 at Thane/);
    expect(screen.getByTestId('stock-plan-line-1')).toHaveTextContent(/from stock 5/);
    expect(screen.queryByTestId('stock-plan-reserve')).toBeNull();

    await fireEvent.press(screen.getByTestId('stock-plan-transfer'));
    expect(await screen.findByText(/Transfer STR-0001 3 at Bhiwandi/)).toBeTruthy();
    expect(stock.calls.map((c) => `${c.method} ${c.path}`)).toEqual(expect.arrayContaining(['POST /requisitions/r1/stock-plan/reserve', 'POST /requisitions/r1/stock-plan/transfer']));
  });

  test('a reservation is released only with a reason', async () => {
    const { stock } = setup();
    await openRequest();
    await fireEvent.press(screen.getByTestId('stock-plan-reserve'));
    await fireEvent.press(await screen.findByTestId('release-res2'));
    expect(screen.getByTestId('release-confirm')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('release-reason'), 'Kept for AMC');
    await fireEvent.press(screen.getByTestId('release-confirm'));
    expect(await screen.findByText(/Released 2 at Thane · Kept for AMC/)).toBeTruthy();
    expect(stock.calls.find((c) => c.path.endsWith('/release'))?.body).toEqual({ reason: 'Kept for AMC' });
  });

  test('without planning rights the numbers show but no actions', async () => {
    setup(false);
    await openRequest();
    expect(screen.getByTestId('stock-plan-issue-1')).toHaveTextContent('To issue 5');
    expect(screen.queryByTestId('stock-plan-reserve')).toBeNull();
  });
});
