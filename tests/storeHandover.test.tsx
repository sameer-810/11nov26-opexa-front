import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { HandoverActions } from '../src/modules/inventory/components/HandoverActions';
import { inventoryApi } from '../src/modules/inventory/api/inventoryApi';
import type { Transfer } from '../src/modules/inventory/types';

const me = { id: 'eng', role: 'engineer', permissions: ['receiving.record'] };
jest.mock('../src/shared/store/useAuthStore', () => ({ useAuth: () => ({ user: me }) }));
afterEach(() => jest.restoreAllMocks());

const line = { id: 'l1', materialId: 'm1', name: 'Pipe', unit: 'Rmt', workOrderItemId: 'i1', billable: true, qty: 8, qtyDispatched: 8, qtyReceived: 0, qtyShort: 0, qtyDamaged: 0, qtyDisputed: 0, qtyReturned: 0, resolution: '' as const, inTransit: 8 };
const transfer = (over: Partial<Transfer> = {}): Transfer => ({ id: 't1', number: 'STR-0001', status: 'dispatched', fromWarehouseId: 'w1', to: { kind: 'site', id: 'p1' }, reason: '', challanNo: '', gatePassNo: 'GP-00001', vehicleNo: '', dispatchedAt: null, createdAt: '2026-11-26', lines: [line], issueNo: 'MI-0001', receiverId: 'eng', discrepancy: null, ...over });

test('Phase D - the store issues to a named engineer', async () => {
  jest.spyOn(inventoryApi, 'receivers').mockResolvedValue([{ id: 'eng', name: 'Salman', role: 'engineer', siteEngineer: true }]);
  const send = jest.spyOn(inventoryApi, 'dispatch').mockResolvedValue(transfer());
  await render(<HandoverActions t={transfer({ status: 'approved', receiverId: null, issueNo: '' })} onDone={jest.fn()} />);
  await fireEvent.press(screen.getByTestId('mi-issue-STR-0001'));
  await fireEvent.press(await screen.findByTestId('mi-to-STR-0001-eng'));
  expect(screen.getByTestId('mi-to-STR-0001-eng')).toHaveTextContent('Salman · site engineer');
  await fireEvent.press(screen.getByTestId('mi-send-STR-0001'));
  await waitFor(() => expect(send).toHaveBeenCalledWith('t1', { receiverId: 'eng' }));
});

test('Phase D - the engineer confirms 7 of 8 with 1 short', async () => {
  const confirm = jest.spyOn(inventoryApi, 'confirm').mockResolvedValue(transfer({ status: 'discrepancy' }));
  await render(<HandoverActions t={transfer()} onDone={jest.fn()} />);
  await fireEvent.changeText(screen.getByTestId('mi-accepted-Pipe'), '7');
  expect(screen.getByTestId('mi-left-Pipe')).toHaveTextContent('1 Rmt not accounted for');
  await fireEvent.changeText(screen.getByTestId('mi-short-Pipe'), '1');
  expect(screen.queryByTestId('mi-left-Pipe')).toBeNull();
  await fireEvent.changeText(screen.getByTestId('mi-note-STR-0001'), 'One length missing');
  await fireEvent.press(screen.getByTestId('mi-confirm-STR-0001'));
  await waitFor(() => expect(confirm).toHaveBeenCalledWith('t1', { note: 'One length missing', lines: [{ lineId: 'l1', accepted: 7, damaged: 0, short: 1 }] }));
});

test('Phase D - a discrepancy waits for the project manager', async () => {
  const pending = transfer({ status: 'discrepancy', discrepancy: { raisedAt: '2026-11-26', note: 'One length missing', resolvedAt: null, remarks: '' }, lines: [{ ...line, qtyReceived: 7, qtyDisputed: 1, inTransit: 0 }] });
  const { unmount } = await render(<HandoverActions t={pending} onDone={jest.fn()} />);
  expect(screen.getByTestId('mi-discrepancy-STR-0001')).toHaveTextContent(/Discrepancy pending: One length missing[\s\S]*The project manager resolves this/);
  expect(screen.queryByTestId('mi-resolve-STR-0001')).toBeNull();
  unmount();

  Object.assign(me, { id: 'pm', role: 'project_manager', permissions: ['project.manage'] });
  const resolve = jest.spyOn(inventoryApi, 'resolve').mockResolvedValue(transfer({ status: 'closed' }));
  await render(<HandoverActions t={pending} onDone={jest.fn()} />);
  await fireEvent.press(screen.getByTestId('mi-action-Pipe-write_off'));
  await fireEvent.changeText(screen.getByTestId('mi-remarks-STR-0001'), 'Lost in transit');
  await waitFor(() => expect(screen.getByTestId('mi-remarks-STR-0001').props.value).toBe('Lost in transit'));
  await fireEvent.press(screen.getByTestId('mi-resolve-STR-0001'));
  await waitFor(() => expect(resolve).toHaveBeenCalledWith('t1', { remarks: 'Lost in transit', lines: [{ lineId: 'l1', action: 'write_off' }] }));
});
