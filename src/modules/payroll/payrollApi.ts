import { api, apiBlob } from '../../shared/api/apiClient';

export type PayType = 'monthly' | 'daily' | 'hourly';
export type Profile = { employeeCode: string; payType: PayType; rate: number; otRatePerHour: number; fixedAllowance: number; tallyLedger: string };
export type Employee = { user: { id: string; name: string; role: string }; profile: Profile | null; advanceOutstanding: number };
export type Line = {
  id: string; userId: string; name: string; employeeCode: string; payType: PayType; rate: number; otRatePerHour: number;
  daysPresent: number; workedMinutes: number; otMinutes: number; workingDays: number; flaggedDays: number;
  basePay: number; otPay: number; allowance: number; adjustment: number; gross: number;
  advanceOutstanding: number; advanceDeduction: number; otherDeduction: number; net: number; note: string; edited: boolean;
};
export type Totals = { gross: number; advanceDeduction: number; otherDeduction: number; net: number };
export type Run = { id: string; month: string; status: 'draft' | 'finalized'; totals: Totals; calculatedAt: string; finalizedAt: string | null; reopenReason: string | null; lines: Line[] };
export type RunSummary = { id: string; month: string; status: 'draft' | 'finalized'; totals: Totals; people: number; finalizedAt: string | null };
export type Settings = { tallyCompany: string; salaryLedger: string; advanceLedger: string; deductionLedger: string; payableLedger: string };
export type Payslip = { month: string; daysPresent: number; workedMinutes: number; otMinutes: number; basePay: number; otPay: number; allowance: number; adjustment: number; gross: number; advanceDeduction: number; otherDeduction: number; net: number; note: string };

export const payrollApi = {
  employees: () => api<Employee[]>('/payroll/employees'),
  setProfile: (userId: string, body: Omit<Profile, 'employeeCode' | 'tallyLedger'> & { employeeCode?: string; tallyLedger?: string }) => api<Employee>(`/payroll/employees/${userId}`, { method: 'PUT', body }),
  addAdvance: (body: { userId: string; date: string; amount: number; note?: string }) => api<unknown>('/payroll/advances', { method: 'POST', body }),
  runs: () => api<RunSummary[]>('/payroll/runs'),
  createRun: (month: string) => api<Run>('/payroll/runs', { method: 'POST', body: { month } }),
  run: (id: string) => api<Run>(`/payroll/runs/${id}`),
  recalculate: (id: string) => api<Run>(`/payroll/runs/${id}/recalculate`, { method: 'POST' }),
  editLine: (id: string, lineId: string, body: Partial<Pick<Line, 'adjustment' | 'advanceDeduction' | 'otherDeduction' | 'note'>>) => api<Run>(`/payroll/runs/${id}/lines/${lineId}`, { method: 'PATCH', body }),
  finalize: (id: string) => api<Run>(`/payroll/runs/${id}/finalize`, { method: 'POST' }),
  reopen: (id: string, reason: string) => api<Run>(`/payroll/runs/${id}/reopen`, { method: 'POST', body: { reason } }),
  excel: (id: string) => apiBlob(`/payroll/runs/${id}/export.xlsx`),
  tally: (id: string) => apiBlob(`/payroll/runs/${id}/tally.xml`),
  settings: () => api<Settings>('/payroll/settings'),
  setSettings: (body: Settings) => api<Settings>('/payroll/settings', { method: 'PUT', body }),
  myPayslips: () => api<{ advanceOutstanding: number; payslips: Payslip[] }>('/payroll/my-payslips'),
};

export const PAY_TYPE_LABEL: Record<PayType, string> = { monthly: 'Monthly salary', daily: 'Daily wage', hourly: 'Per hour' };
export const hours = (mins: number) => Math.round((mins / 60) * 10) / 10;
