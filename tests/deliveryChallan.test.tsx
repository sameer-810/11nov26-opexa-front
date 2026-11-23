import { Linking } from 'react-native';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { installChallanMock } from './helpers/mockChallanApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const eng = api.addUser({ email: 'ravi@airtech.in', password: 'Ravi12345', role: 'engineer', name: 'Ravi Kumar' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: 'Worli Sea Face', clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [eng.id] });
  api.reqs.push({
    id: 'r1', number: 'MR-0001', projectId: 'p1', projectName: 'Worli', projectCode: 'P-001', raisedBy: { id: eng.id, name: 'Ravi Kumar' }, note: '', deliveryAddress: 'Worli, gate 2', neededBy: null,
    status: 'open', cancelReason: null, createdAt: new Date().toISOString(), overBoq: false, attachments: [], timeline: [],
    lines: [{ id: 'l1', workOrderItemId: 'i1', serialNo: '1', description: 'Split AC 2 TR', unit: 'Nos', boqQty: 10, previouslyRequested: 0, qtyRequested: 10, qtyApproved: 10, overBy: 0, overrideReason: null, status: 'approved', rejectReason: null, received: 0, pending: 10, receivable: 10 }],
  });
  const dc = installChallanMock(api);
  return { api, dc };
}

async function signIn(email: string, password: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
}

async function openRequest() {
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
  await fireEvent.press(await screen.findByTestId('project-requisitions'));
  await fireEvent.press(await screen.findByTestId('req-MR-0001'));
}

describe('1C/1D - Material received and delivery challan', () => {
  test('quantity cannot pass the pending; OK shows the summary; Create challan makes DC-0001 with pending 2', async () => {
    const { dc } = setup();
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await signIn('ravi@airtech.in', 'Ravi12345');
    await openRequest();
    expect(await screen.findByTestId('req-pending-1')).toHaveTextContent('10');
    await fireEvent.press(screen.getByTestId('req-material-received'));

    expect(await screen.findByTestId('mr-recv-line-1')).toHaveTextContent(/Requested 10 · approved 10 · delivered 0 · pending 10 Nos/);
    expect(screen.getByTestId('mr-recv-received-by').props.value).toBe('Ravi Kumar');
    await fireEvent.changeText(screen.getByTestId('mr-recv-qty-1'), '12');
    await fireEvent.press(screen.getByTestId('mr-recv-ok'));
    expect(screen.getByText('Only 10 Nos pending')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('mr-recv-qty-1'), '');
    await fireEvent.press(screen.getByTestId('mr-recv-ok'));
    expect(screen.getByTestId('mr-recv-error')).toHaveTextContent(/at least one item/);

    await fireEvent.changeText(screen.getByTestId('mr-recv-qty-1'), '8');
    await fireEvent.changeText(screen.getByTestId('mr-recv-supplier'), 'Cool Traders');
    await fireEvent.changeText(screen.getByTestId('mr-recv-vendor-challan'), 'VC-771');
    await fireEvent.changeText(screen.getByTestId('mr-recv-vehicle'), 'MH01AB1234');
    await fireEvent.changeText(screen.getByTestId('mr-recv-remarks'), 'Boxes sealed');
    await fireEvent.press(screen.getByTestId('mr-recv-ok'));
    expect(await screen.findByTestId('mr-confirm-1')).toHaveTextContent(/Received now 8 Nos · pending after this 2/);
    await fireEvent.press(screen.getByTestId('mr-recv-create'));

    expect(await screen.findByTestId('dc-created')).toHaveTextContent(/DC-0001/);
    expect(screen.getByTestId('dc-line-1')).toHaveTextContent(/1Split AC 2 TRNos108 ?8 ?2/);
    expect(screen.getByTestId('dc-info')).toHaveTextContent(/Cool Traders · supplier challan VC-771 · vehicle MH01AB1234/);
    expect(dc.challans[0]).toMatchObject({ number: 'DC-0001', vendorChallanNo: 'VC-771', receivedByName: 'Ravi Kumar', remarks: 'Boxes sealed' });

    await fireEvent.press(screen.getByTestId('dc-print'));
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/print\/delivery-challans\/dc1\?/)));
    expect(screen.queryByTestId('dc-cancel')).toBeNull(); // site staff cannot cancel

    // Back on the request: pending 2 and the challan in its delivery history.
    await fireEvent.press(screen.getByTestId('dc-open-mr'));
    expect(await screen.findByTestId('dc-DC-0001')).toBeTruthy();
    expect(screen.getByTestId('req-pending-1')).toHaveTextContent('2');
    open.mockRestore();
  });

  test('a manager cancels with a reason; the challan list searches by number', async () => {
    const { api, dc } = setup();
    await signIn('owner@airtech.in', 'Owner12345');
    await openRequest();
    await fireEvent.press(await screen.findByTestId('req-material-received'));
    await fireEvent.changeText(await screen.findByTestId('mr-recv-qty-1'), '4');
    await fireEvent.press(screen.getByTestId('mr-recv-ok'));
    await fireEvent.press(await screen.findByTestId('mr-recv-create'));
    await screen.findByTestId('dc-created');
    await fireEvent.press(screen.getByTestId('dc-open-mr'));
    await fireEvent.press(await screen.findByTestId('req-material-received'));
    await fireEvent.changeText(await screen.findByTestId('mr-recv-qty-1'), '6');
    await fireEvent.press(screen.getByTestId('mr-recv-ok'));
    await fireEvent.press(await screen.findByTestId('mr-recv-create'));
    expect(await screen.findByTestId('dc-created')).toHaveTextContent(/DC-0002/);
    expect(api.reqs[0].lines[0]).toMatchObject({ received: 10, pending: 0 });

    await fireEvent.press(screen.getByTestId('dc-cancel'));
    await fireEvent.press(screen.getByTestId('dc-cancel-confirm'));
    expect(screen.getByTestId('dc-error')).toHaveTextContent(/reason/);
    await fireEvent.changeText(screen.getByTestId('dc-cancel-reason'), 'Counted twice');
    await fireEvent.press(screen.getByTestId('dc-cancel-confirm'));
    expect(await screen.findByTestId('dc-cancelled')).toHaveTextContent(/Counted twice/);
    expect(dc.challans[0]).toMatchObject({ number: 'DC-0002', status: 'cancelled' });
  });

  test('project challan list, search by DC number', async () => {
    const { api, dc } = setup();
    api.reqs[0].lines[0].receivable = 10;
    await signIn('ravi@airtech.in', 'Ravi12345');
    await openRequest();
    for (const q of ['3', '2']) {
      await fireEvent.press(await screen.findByTestId('req-material-received'));
      await fireEvent.changeText(await screen.findByTestId('mr-recv-qty-1'), q);
      await fireEvent.press(screen.getByTestId('mr-recv-ok'));
      await fireEvent.press(await screen.findByTestId('mr-recv-create'));
      await screen.findByTestId('dc-created');
      await fireEvent.press(screen.getByTestId('dc-open-mr'));
    }
    expect(dc.challans.map((c) => c.number)).toEqual(['DC-0002', 'DC-0001']);
    expect(await screen.findByTestId('dc-DC-0002')).toBeTruthy();
    // MR -> requests -> project -> its challans.
    await fireEvent.press(screen.getByTestId('back'));
    await fireEvent.press(await screen.findByTestId('back'));
    await fireEvent.press(await screen.findByTestId('project-challans'));
    expect(await screen.findByTestId('dc-DC-0001')).toBeTruthy();
    expect(screen.getByTestId('dc-DC-0002')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('dc-search'), 'dc-0001');
    await waitFor(() => expect(screen.queryByTestId('dc-DC-0002')).toBeNull());
    await fireEvent.press(screen.getByTestId('dc-DC-0001'));
    expect(await screen.findByTestId('challan-detail-screen')).toBeTruthy();
    expect(screen.getByTestId('dc-line-1')).toHaveTextContent(/3/);
  });
});
