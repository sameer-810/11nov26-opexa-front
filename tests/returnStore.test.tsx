import { Linking } from 'react-native';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { installChallanMock } from './helpers/mockChallanApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const sup = api.addUser({ email: 'sunil@airtech.in', password: 'Sunil12345', role: 'supervisor', name: 'Sunil Site' });
  api.addUser({ email: 'store@airtech.in', password: 'Store12345', role: 'store_incharge', name: 'Store Keeper' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [sup.id] });
  api.materialRows.push({ workOrderItemId: 'i1', serialNo: '1', description: 'Split AC', unit: 'Nos', atSite: 6, rate: 52000 });
  return { api, extra: installChallanMock(api) };
}

async function signIn(email: string, password: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
}

describe('1E - Return to store', () => {
  test('site sends material back to a chosen store as returnable, with vehicle no.', async () => {
    const { api } = setup();
    await signIn('sunil@airtech.in', 'Sunil12345');
    await fireEvent.press(await screen.findByTestId('tile-projects'));
    await fireEvent.press(await screen.findByTestId('project-P-001'));
    await fireEvent.press(await screen.findByTestId('project-returns'));
    await fireEvent.press(await screen.findByTestId('return-new'));
    await screen.findByTestId('new-return-screen');
    // Central store is the default; choose Bhiwandi.
    await waitFor(() => expect(screen.getByTestId('rt-warehouse-w1')).toHaveProp('accessibilityState', { selected: true }));
    await fireEvent.press(screen.getByTestId('rt-warehouse-w2'));
    await fireEvent.press(screen.getByTestId('rt-returnable-yes'));
    await fireEvent.changeText(screen.getByTestId('rt-search'), '1');
    await fireEvent.press(screen.getByTestId('rt-search-pick-1'));
    await fireEvent.changeText(screen.getByTestId('rt-qty-1'), '7');
    await fireEvent.changeText(screen.getByTestId('rt-reason'), 'Floor 6 deferred');
    await fireEvent.changeText(screen.getByTestId('rt-vehicle'), 'MH04XY9876');
    await fireEvent.press(screen.getByTestId('rt-save'));
    expect(screen.getByText('Only 6 Nos at site')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('rt-qty-1'), '3');
    await fireEvent.press(screen.getByTestId('rt-save'));
    expect(await screen.findByTestId('return-status')).toHaveTextContent('Waiting to confirm');
    expect(api.returns[0]).toMatchObject({ type: 'store', warehouseId: 'w2', returnable: true, vehicleNo: 'MH04XY9876', reason: 'Floor 6 deferred', lines: [{ workOrderItemId: 'i1', qty: 3 }] });
    expect(screen.queryByTestId('return-accept')).toBeNull();
  });

  test('store team prints the gate pass and confirms with the quantity that arrived', async () => {
    const { api, extra } = setup();
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    api.returns.push({
      id: 'rt1', number: 'RTN-0001', type: 'store', projectId: 'p1', projectName: 'Worli', vendor: null, toProject: null, reason: 'Extra', challanNo: null, status: 'pending',
      warehouseId: 'w2', warehouseName: 'Bhiwandi Store', returnable: true, gatePassNo: 'GP-00001', vehicleNo: 'MH04XY9876', attachments: [],
      decidedBy: null, decidedAt: null, decisionNote: '', createdBy: { id: 'u2', name: 'Sunil Site' }, createdAt: new Date().toISOString(),
      lines: [{ id: 'l1', workOrderItemId: 'i1', serialNo: '1', description: 'Split AC', unit: 'Nos', qty: 3, toWorkOrderItemId: null, toSerialNo: null }],
    });
    await signIn('store@airtech.in', 'Store12345');
    await fireEvent.press(await screen.findByTestId('tile-returns'));
    await fireEvent.press(await screen.findByTestId('return-RTN-0001'));
    expect(await screen.findByTestId('return-store-info')).toHaveTextContent('Returnable · gate pass GP-00001 · vehicle MH04XY9876');
    await fireEvent.press(screen.getByTestId('return-print-gatepass'));
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/print\/returns\/rt1\/gatepass\?/)));
    await fireEvent.press(screen.getByTestId('return-print-challan'));
    await waitFor(() => expect(extra.printed).toEqual(['rt1:gatepass', 'rt1:challan']));

    await fireEvent.changeText(screen.getByTestId('return-got-1'), '4');
    await fireEvent.press(screen.getByTestId('return-accept'));
    expect(screen.getByTestId('return-error')).toHaveTextContent(/0 to 3 Nos/);
    await fireEvent.changeText(screen.getByTestId('return-got-1'), '2');
    await fireEvent.changeText(screen.getByTestId('return-note'), 'One box short');
    await fireEvent.press(screen.getByTestId('return-accept'));
    expect(await screen.findByTestId('return-decided')).toHaveTextContent(/Confirmed by Store Keeper/);
    expect(extra.decisions[0]).toEqual({ decision: 'accepted', note: 'One box short', receivedLines: [{ lineId: 'l1', qtyReceived: 2 }] });
    expect(screen.getByTestId('return-line-1')).toHaveTextContent(/received 2/);
    open.mockRestore();
  });
});
