import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RoleDashboard } from '../src/modules/dashboard/components/RoleDashboard';
import type { RoleDashboard as Board, RoleKey, RoleList } from '../src/modules/dashboard/api/roleDashboardApi';

const boards: Record<string, Board> = {
  director: {
    role: 'director', label: 'Director', asOf: '2026-11-23T10:00:00.000Z',
    kpis: [
      { key: 'estimatedProfit', label: 'Estimated profit (open jobs)', value: 1520000, format: 'money', drill: { screen: 'Costing' } },
      { key: 'clientOutstanding', label: 'Client outstanding', value: 250000, format: 'money', drill: { screen: 'ClientReceipts' } },
      { key: 'bgExpiring', label: 'Bank guarantees expiring', value: 1, sub: '0 expired, not closed', drill: { screen: 'Commitments' } },
    ],
    projects: [{ id: 'p1', code: 'P-001', name: 'Worli', contract: 1520000, estimatedProfit: 1520000, forecastProfit: 1470000, actualCost: 50000, billed: 300000, overrun: true }],
    cashFlow: [{ days: 30, receipts: 250000, payables: 50000, payroll: 80000, net: 120000 }, { days: 60, receipts: 0, payables: 0, payroll: 80000, net: -80000 }, { days: 90, receipts: 0, payables: 0, payroll: 80000, net: -80000 }],
    notes: ['Client receipts are expected 30 days after the invoice date.'],
  },
  store: { role: 'store', label: 'Store', asOf: '2026-11-23T10:00:00.000Z', kpis: [{ key: 'returns', label: 'Returns to confirm', value: 2, drill: { screen: 'Returns' } }] },
};

function mock(list: RoleList) {
  const asked: string[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async (url: string) => {
    const p = url.replace(/^.*\/api\/v1/, '').split('?')[0];
    asked.push(p);
    const role = p.match(/^\/dashboard\/roles\/(\w+)$/)?.[1];
    const data = p === '/dashboard/roles' ? list : role ? boards[role] : null;
    return data ? { ok: true, status: 200, json: async () => ({ success: true, data }) } : { ok: false, status: 404, json: async () => ({ success: false, error: { code: 'NOT_FOUND', message: 'No mock', details: [] } }) };
  });
  return asked;
}
const all: { key: RoleKey; label: string }[] = [{ key: 'director', label: 'Director' }, { key: 'store', label: 'Store' }, { key: 'hr', label: 'HR' }];

test('5E - director sees their dashboard, cash flow and profit, and switches to another role', async () => {
  const asked = mock({ default: 'director', dashboards: all });
  const onDrill = jest.fn();
  await render(<RoleDashboard onDrill={onDrill} />);
  expect(await screen.findByTestId('role-title')).toHaveTextContent('Director dashboard');
  expect(screen.getByTestId('role-kpi-clientOutstanding')).toHaveTextContent(/₹2\.5 L/);
  expect(screen.getByTestId('role-kpi-bgExpiring')).toHaveTextContent(/0 expired, not closed/);
  expect(screen.getByTestId('cash-30')).toHaveTextContent(/Next 30 days/);
  expect(screen.getByTestId('role-project-P-001')).toHaveTextContent(/over estimate/);

  await fireEvent.press(screen.getByTestId('role-kpi-clientOutstanding'));
  expect(onDrill).toHaveBeenCalledWith({ screen: 'ClientReceipts' });
  await fireEvent.press(screen.getByTestId('role-project-P-001'));
  expect(onDrill).toHaveBeenLastCalledWith({ screen: 'ProjectDetail', params: { id: 'p1' } });

  await fireEvent.press(screen.getByTestId('role-picker-store'));
  await waitFor(() => expect(screen.getByTestId('role-title')).toHaveTextContent('Store dashboard'));
  expect(screen.getByTestId('role-kpi-returns')).toHaveTextContent(/Returns to confirm2/);
  expect(asked).toContain('/dashboard/roles/store');
});

test('5E - a store user sees only their own dashboard, without a picker', async () => {
  mock({ default: 'store', dashboards: [{ key: 'store', label: 'Store' }] });
  await render(<RoleDashboard onDrill={jest.fn()} />);
  expect(await screen.findByTestId('role-title')).toHaveTextContent('Store dashboard');
  expect(screen.queryByTestId('role-picker-director')).toBeNull();
});

test('5E - no dashboard for this user: nothing is shown', async () => {
  mock({ default: null, dashboards: [] });
  await render(<RoleDashboard onDrill={jest.fn()} />);
  await waitFor(() => expect(screen.queryByTestId('role-dashboard')).toBeNull());
});

test('short money puts the minus before the rupee sign', () => {
  const { formatShortMoney } = jest.requireActual('../src/shared/format');
  expect(formatShortMoney(-220000)).toBe('-₹2.2 L');
  expect(formatShortMoney(-31000000)).toBe('-₹3.10 Cr');
  expect(formatShortMoney(450000)).toBe('₹4.5 L');
});
