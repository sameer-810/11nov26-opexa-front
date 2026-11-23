import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MeasurementTab } from '../src/modules/billing/MeasurementTab';
import type { LowSide, Sheet } from '../src/modules/billing/billingApi';
import { installMeasurementMock } from './helpers/mockMeasurementApi';

const drain = (extra: Partial<LowSide> = {}): LowSide => ({
  workOrderItemId: 'i3', serialNo: '3', description: 'Drain pipe 32 mm', unit: 'Rmt', boqQty: 100, variationQty: 105, allowedQty: 105, executedQty: 98, measuredQty: 110,
  clientVerifiedQty: 110, approvedQty: 110, billedQty: 90, unbilledApprovedQty: 20, awaitingClient: 0, overBoq: false, overBoqQty: 0, overBoqHint: null, ...extra,
});
const sheet = (extra: Partial<Sheet> = {}): Sheet => ({
  id: 's1', number: 'MS-0001', workOrderItemId: 'i3', unit: 'Rmt', zone: 'Tower A', department: 'HVAC', floor: 'L3', measuredOn: '2026-11-20', status: 'client_verified', measuredQty: 26, finalQty: 25.5,
  clientEngineer: 'Mr. Shah', invoiceId: null, attachments: [],
  rows: [{ id: 'r1', description: 'Corridor run', nos: 2, length: 13, breadth: null, height: null, qty: 26, correctedQty: 25.5, correctionNote: 'Centre line', deduct: false, formula: '2 x 13' }],
  corrections: [{ rowId: 'r1', oldQty: 26, newQty: 25.5, byName: 'Mr. Shah', role: 'client_engineer', at: '2026-11-23T10:00:00.000Z', reason: 'Centre line', legacy: true }],
  ...extra,
});

test('3C - quantity ladder per BOQ line, with the over-BOQ warning and the way to unblock', async () => {
  installMeasurementMock({ lowSide: [drain({ overBoq: true, overBoqQty: 5, overBoqHint: 'To bill more, get a BOQ revision approved or raise an additional-work item.' })], sheets: [] });
  await render(<MeasurementTab projectId="p1" onInvoice={jest.fn()} />);
  await screen.findByTestId('ladder-3');
  const steps = [['boq', 'BOQ 100'], ['variation', 'Variation 105'], ['executed', 'Execution 98'], ['measured', 'Measured 110'], ['verified', 'Client-verified 110'], ['approved', 'Approved 110'], ['billed', 'Billed 90']];
  for (const [key, text] of steps) expect(screen.getByTestId(`ladder-3-${key}`)).toHaveTextContent(new RegExp(text));
  expect(screen.getByTestId('ladder-3')).toHaveTextContent(/Billing allowed up to 105 Rmt/);
  expect(screen.getByTestId('ladder-3-over')).toHaveTextContent(/Approved 5 Rmt beyond the allowed quantity.*BOQ revision/);
});

test('3C - correction entry needs a reason; every round stays in the history', async () => {
  const api = installMeasurementMock({ lowSide: [drain()], sheets: [sheet()] });
  await render(<MeasurementTab projectId="p1" onInvoice={jest.fn()} />);
  expect(await screen.findByTestId('ms-history-MS-0001')).toHaveTextContent(/Row 1: 26 → 25.5 by Mr. Shah \(client engineer\), 23 Nov 2026 — Centre line/);
  expect(screen.getByTestId('sheet-MS-0001')).toHaveTextContent(/floor L3/);
  expect(screen.getByTestId('sheet-MS-0001')).toHaveTextContent(/2 x 13/);

  await fireEvent.press(screen.getByTestId('ms-role-MS-0001-pm'));
  await fireEvent.changeText(screen.getByTestId('ms-fix-r1'), '25.25');
  await fireEvent.press(screen.getByTestId('ms-correct-MS-0001'));
  expect(await screen.findByTestId('ms-problem')).toHaveTextContent(/Give the reason for the correction/);
  expect(api.actions).toHaveLength(0);

  await fireEvent.changeText(screen.getByTestId('ms-reason-MS-0001'), 'Bend allowance removed');
  await fireEvent.press(screen.getByTestId('ms-correct-MS-0001'));
  await waitFor(() => expect(api.actions).toHaveLength(1));
  expect(api.actions[0]).toEqual({ action: 'correct', role: 'pm', corrections: [{ rowId: 'r1', correctedQty: 25.25, reason: 'Bend allowance removed' }] });
  await waitFor(() => expect(screen.getByTestId('ms-history-MS-0001')).toHaveTextContent(/25.5 → 25.25 by Priya \(project manager\)/));
  expect(screen.getByTestId('ms-history-MS-0001')).toHaveTextContent(/26 → 25.5 by Mr. Shah/);
});

test('Q20 - billing over the BOQ shows the block message with the lines', async () => {
  const api = installMeasurementMock({ lowSide: [drain()], sheets: [sheet({ status: 'approved' })] });
  api.blockOverBoq('Billing goes beyond the BOQ on S.No 3. To bill more, get a BOQ revision approved', [{ field: 'i3', message: 'S.No 3: at most 105 Rmt can be billed; 90 billed before, 25.5 on this bill' }]);
  await render(<MeasurementTab projectId="p1" onInvoice={jest.fn()} />);
  await fireEvent.press(await screen.findByTestId('ms-pick-MS-0001'));
  await fireEvent.press(screen.getByTestId('ms-invoice'));
  expect(await screen.findByTestId('ms-problem')).toHaveTextContent(/beyond the BOQ on S.No 3.*BOQ revision.*at most 105 Rmt/);
  expect(api.invoices).toHaveLength(0);
});
