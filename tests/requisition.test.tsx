import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const eng = api.addUser({ email: 'ravi@airtech.in', password: 'Ravi12345', role: 'engineer', name: 'Ravi Kumar' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [eng.id] });
  api.boq.push({ id: 'i1', projectId: 'p1', serialNo: '1', quantity: 8, rate: 52000, amount: 416000 });
  return api;
}

async function openNewRequest() {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'ravi@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Ravi12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
  await fireEvent.press(await screen.findByTestId('project-new-requisition'));
  await screen.findByTestId('new-requisition-screen');
}

describe('Phase 4 - Material request (engineer)', () => {
  test('within the balance: sent and shown with its number', async () => {
    const api = setup();
    await openNewRequest();
    expect(screen.getByTestId('req-item-1')).toHaveTextContent(/balance 8/);
    await fireEvent.changeText(screen.getByTestId('req-qty-1'), '5');
    await fireEvent.press(screen.getByTestId('req-submit'));
    expect(await screen.findByTestId('req-created')).toBeTruthy();
    expect(screen.getByTestId('req-line-1')).toHaveTextContent(/5/);
    expect(api.reqs[0].lines[0]).toMatchObject({ qtyRequested: 5, overBy: 0 });
  });

  test('nothing entered: asks for a quantity and sends nothing', async () => {
    const api = setup();
    await openNewRequest();
    await fireEvent.press(screen.getByTestId('req-submit'));
    expect(screen.getByTestId('req-error')).toHaveTextContent(/at least one item/);
    expect(api.reqs).toHaveLength(0);
  });

  test('over BOQ: shows the numbers, needs a reason, then sends with Yes', async () => {
    const api = setup();
    await openNewRequest();
    await fireEvent.changeText(screen.getByTestId('req-qty-1'), '10');
    expect(screen.getByTestId('req-item-1')).toHaveTextContent(/2 extra/);
    await fireEvent.press(screen.getByTestId('req-submit'));
    const warn = await screen.findByTestId('over-boq-warning');
    expect(warn).toHaveTextContent(/BOQ 8, already requested 0, now 10/);
    expect(api.reqs).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('over-confirm'));
    expect(screen.getByTestId('over-reason-error')).toHaveTextContent(/Say why/);

    await fireEvent.changeText(screen.getByTestId('over-reason'), 'Client approved 2 extra on call');
    await fireEvent.press(screen.getByTestId('over-confirm'));
    expect(await screen.findByTestId('req-over-chip')).toBeTruthy();
    expect(api.reqs[0].lines[0]).toMatchObject({ overBy: 2, overrideReason: 'Client approved 2 extra on call' });
  });

  test('over BOQ: "No" goes back to editing without sending', async () => {
    const api = setup();
    await openNewRequest();
    await fireEvent.changeText(screen.getByTestId('req-qty-1'), '10');
    await fireEvent.press(screen.getByTestId('req-submit'));
    await screen.findByTestId('over-boq-warning');
    await fireEvent.press(screen.getByTestId('over-cancel'));
    expect(screen.queryByTestId('over-boq-warning')).toBeNull();
    expect(screen.getByTestId('req-submit')).toBeTruthy();
    expect(api.reqs).toHaveLength(0);
  });
});
