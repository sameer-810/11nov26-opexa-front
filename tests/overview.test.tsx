import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';
import { routeForLink } from '../src/navigation/routeForLink';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

describe('Phase 8 - links from notifications / pushes', () => {
  const buyer = { permissions: ['purchase.manage'] } as never;
  const eng = { permissions: ['requisition.create'] } as never;
  test('known links map to screens; unknown or forbidden ones do not', () => {
    expect(routeForLink('/app/requisitions/r1', eng)).toEqual({ name: 'RequisitionDetail', params: { id: 'r1' } });
    expect(routeForLink('/app/projects/p1/lots/l1', eng)).toEqual({ name: 'LotDetail', params: { projectId: 'p1', lotId: 'l1' } });
    expect(routeForLink('/app/projects/p1/stock-counts/c1', eng)).toEqual({ name: 'StockCount', params: { id: 'p1', countId: 'c1' } });
    expect(routeForLink('/app/purchase-orders/po1', buyer)).toEqual({ name: 'PurchaseOrderDetail', params: { id: 'po1' } });
    expect(routeForLink('/app/purchase-orders/po1', eng)).toBeNull();
    expect(routeForLink('https://evil.example/x', eng)).toBeNull();
    expect(routeForLink(null, eng)).toBeNull();
  });
});

describe('Phase 8 - Owner overview', () => {
  test('owner opens the overview and taps an attention item', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.reqs.push({ id: 'r1', number: 'MR-0001', projectId: 'p1', projectName: 'Worli', projectCode: 'P-001', raisedBy: { id: 'u9', name: 'Ravi' }, note: '', neededBy: null, status: 'open', cancelReason: null, createdAt: new Date().toISOString(), overBoq: true, lines: [] });
    Object.assign(api.overview, {
      asOf: new Date().toISOString(),
      projects: { active: 3, closing: 1, closed: 2 },
      month: { purchaseValue: 1250000, purchaseOrders: 4, localPurchaseValue: 5500, localPurchases: 1 },
      material: { requestsAwaitingPo: 2, requestsOverBoq: 1, lotsInTransit: 3, lotsLate: 1, returnsPending: 0, stockShortValue30d: 52000 },
      totals: { boqValue: 32500000, suppliedValue: 8000000, installedValue: 6000000 },
      projectRows: [{ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', boqValue: 600000, suppliedValue: 205000, installedValue: 150000, installedPct: 25, localPurchaseValue: 5500, itemsPending: 1, itemsOverBoq: 0, lotsInTransit: 1, lotsOverdue: 1, openRequests: 2 }],
      attention: [{ kind: 'request.overBoq', title: 'MR-0001 at Worli goes over BOQ', link: '/app/requisitions/r1' }],
    });
    await renderApp({ showLanding: false });
    await fireEvent.changeText(await screen.findByTestId('signin-email'), 'owner@airtech.in');
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'Owner12345');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    await fireEvent.press(await screen.findByTestId('tile-overview'));
    expect(await screen.findByTestId('kpi-boq')).toHaveTextContent(/₹3\.25 Cr/);
    expect(screen.getByTestId('kpi-month')).toHaveTextContent(/₹12\.6 L/);
    expect(screen.getByTestId('kpi-late')).toHaveTextContent(/1 \/ 3/);
    expect(screen.getByTestId('ov-row-P-001')).toHaveTextContent(/25%/);
    await fireEvent.press(screen.getByTestId('attention-0'));
    expect(await screen.findByTestId('requisition-detail-screen')).toHaveTextContent(/MR-0001/);
  });
});
