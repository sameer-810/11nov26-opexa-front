import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BoqItemForm } from '../src/modules/project/components/BoqItemForm';
import { BoqTable, type BoqLine } from '../src/modules/project/components/BoqTable';
import { activityApi } from '../src/modules/activity/activityApi';
import type { BoqColumn } from '../src/modules/project/types';

afterEach(() => jest.restoreAllMocks());

const line: BoqLine = {
  id: 'i1', projectId: 'p1', serialNo: '1', itemCode: 'CU-58', description: 'Copper pipe 5/8"', unit: 'RMT', quantity: 130, rate: 700, amount: 91000,
  approvalStatus: 'approved', originalQty: 100, boqApprovedQty: 130, variationQty: 120, executedQty: 40, remainingQty: 90, approvedQty: 0,
};

test('Phase B - the BOQ table shows original, MD-approved, variation, execution and remaining quantities apart, with the approval', async () => {
  const cols: BoqColumn[] = (['serialNo', 'itemCode', 'originalQty', 'boqApprovedQty', 'variationQty', 'executedQty', 'remainingQty', 'approvalStatus'] as const).map((key, order) => ({ key, label: key, visible: true, order }));
  await render(<BoqTable columns={cols} lines={[line, { ...line, id: 'i2', serialNo: '2', approvalStatus: 'revision_pending' }]} />);
  const row = screen.getByTestId('boq-row-1');
  for (const t of ['CU-58', '100', '130', '120', '40', '90', 'Approved']) expect(row).toHaveTextContent(new RegExp(t));
  expect(screen.getByTestId('boq-row-2')).toHaveTextContent(/Revision awaiting approval/);
});

test('Phase B - editing a line: item code is sent, tracked quantities are shown read-only, and the line history opens', async () => {
  const history = jest.spyOn(activityApi, 'forEntity').mockResolvedValue([
    { id: 'a1', entityType: 'boq_item', entityId: 'i1', entityNumber: 'S.No 1', action: 'revised', projectId: 'p1', project: null, workOrderItemId: 'i1', user: { id: 'u1', name: 'Pooja', role: 'project_manager' }, at: '2026-11-26T06:00:00.000Z', changes: [{ field: 'quantity', old: 100, new: 130 }], approvalStatus: null, approverId: null, remarks: 'BOQ Rev 1: Client added a corridor', documentIds: [] },
  ]);
  const save = jest.fn(async () => undefined);
  await render(<BoqItemForm initial={line} onSave={save} onCancel={jest.fn()} />);
  expect(screen.getByTestId('bi-original-qty')).toHaveTextContent('100');
  expect(screen.getByTestId('bi-approved-qty')).toHaveTextContent('130');
  expect(screen.getByTestId('bi-remaining-qty')).toHaveTextContent('90');
  expect(screen.getByTestId('bi-approval-status')).toHaveTextContent('Approved');
  await fireEvent.press(screen.getByTestId('bi-history'));
  expect(await screen.findByTestId('boq-line-history')).toHaveTextContent(/Pooja.*Client added a corridor/);
  expect(screen.getByTestId('boq-line-history')).toHaveTextContent(/Quantity: 100 → 130/);
  expect(history).toHaveBeenCalledWith('boq_item', 'i1');

  await fireEvent.changeText(screen.getByTestId('bi-item-code'), 'CU-58A');
  await fireEvent.changeText(screen.getByTestId('bi-remarks'), 'per drawing R2');
  await fireEvent.press(screen.getByTestId('bi-save'));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ itemCode: 'CU-58A', remarks: 'per drawing R2' })));
});

test('Phase B - a new line has no tracked quantities yet', async () => {
  await render(<BoqItemForm onSave={jest.fn()} onCancel={jest.fn()} />);
  expect(screen.queryByTestId('bi-original-qty')).toBeNull();
  expect(screen.queryByTestId('bi-history')).toBeNull();
});
