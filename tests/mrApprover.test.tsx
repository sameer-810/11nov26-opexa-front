import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';
import { BoqLines } from '../src/modules/requisition/components/BoqLines';
import { ForwardApproval } from '../src/modules/approval/components/ForwardApproval';
import { approvalApi } from '../src/modules/approval/api/approvalApi';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));
afterEach(() => jest.restoreAllMocks());

test('Phase C - the engineer sends the material request to the project manager', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const eng = api.addUser({ email: 'salman@airtech.in', password: 'Salman123', role: 'engineer', name: 'Salman' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'ABC Mall', clientName: 'ABC', status: 'active', siteAddress: 'Ground Floor', clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [eng.id] });
  api.boq.push({ id: 'i1', projectId: 'p1', serialNo: '1', quantity: 100, rate: 700, amount: 70000 });
  api.approverOptions.push({ id: 'md', name: 'Ehtesham', role: 'owner', label: 'MD' }, { id: 'pm', name: 'Ahmed', role: 'project_manager', label: 'Project Manager' });

  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'salman@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Salman123');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
  await fireEvent.press(await screen.findByTestId('project-new-requisition'));
  await fireEvent.changeText(await screen.findByTestId('req-qty-1'), '10');
  expect(await screen.findByTestId('req-approver-')).toHaveTextContent('Company approval rules');
  await fireEvent.press(screen.getByTestId('req-approver-pm'));
  await fireEvent.press(screen.getByTestId('req-submit'));
  await waitFor(() => expect(api.reqs).toHaveLength(1));
  expect(api.reqs[0].approverId).toBe('pm');
});

test('Phase C - each BOQ line shows delivered and pending, and the total requested with this request', async () => {
  const row = { workOrderItemId: 'i1', serialNo: '1', description: 'Copper pipe', unit: 'RMT', boqQty: 100, approvedBoqQty: 100, requested: 60, delivered: 45, pending: 15, balance: 40 };
  await render(<BoqLines rows={[row]} value={{ i1: { qty: '50', specification: '' } }} onChange={jest.fn()} />);
  expect(screen.getByTestId('req-progress-1')).toHaveTextContent('delivered 45 · pending 15 · total requested with this 110');
  expect(screen.getByTestId('req-item-1')).toHaveTextContent(/More than the balance: 10 extra/);
});

test('Phase C - the approver forwards to another approver with a reason', async () => {
  jest.spyOn(approvalApi, 'forwardOptions').mockResolvedValue([{ id: 'ravi', name: 'Ravi', label: 'Director' }]);
  const fwd = jest.spyOn(approvalApi, 'forward').mockResolvedValue({} as never);
  const done = jest.fn();
  await render(<ForwardApproval approvalId="a1" onDone={done} />);
  await fireEvent.press(screen.getByTestId('forward-a1'));
  await fireEvent.press(await screen.findByTestId('forward-to-ravi'));
  await fireEvent.press(screen.getByTestId('forward-send'));
  expect(await screen.findByTestId('forward-problem')).toHaveTextContent('Say why you are forwarding it');
  await fireEvent.changeText(screen.getByTestId('forward-reason'), 'On leave tomorrow');
  await fireEvent.press(screen.getByTestId('forward-send'));
  await waitFor(() => expect(fwd).toHaveBeenCalledWith('a1', 'ravi', 'On leave tomorrow'));
  expect(done).toHaveBeenCalled();
});
