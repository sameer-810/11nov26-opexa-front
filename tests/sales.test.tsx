import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';
import { quoteTotals } from '../src/modules/sales/salesApi';
import { routeForLink } from '../src/navigation/routeForLink';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

const lead = { id: 'l1', number: 'EN-0001', clientName: 'Hiranandani Hospital', contactName: 'Mr Rao', phone: '9820012345', email: '', siteAddress: 'Powai', source: 'referral', requirement: 'VRF for OPD', estValue: 900000, status: 'contacted', lostReason: '', nextFollowUp: '2020-01-01', followUpDue: true, owner: { id: 'x', name: 'Salman' }, projectId: null, notes: [{ at: new Date().toISOString(), byName: 'Salman', text: 'Enquiry received' }], quotedValue: null };

describe('Phase 16 - Sales screens', () => {
  test('live totals match the server maths', () => {
    expect(quoteTotals([{ description: 'a', unit: 'Nos', qty: 2, rate: 350000 }, { description: 'b', unit: 'Rmt', qty: 120, rate: 950 }], 4000, 18)).toEqual({ gross: 814000, taxable: 810000, gst: 145800, total: 955800 });
  });

  test('sales tile only for people with sales access', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.addUser({ email: 'raju@airtech.in', password: 'Raju123456', role: 'staff', name: 'Raju' });
    await renderApp({ showLanding: false });
    await fireEvent.changeText(await screen.findByTestId('signin-email'), 'raju@airtech.in');
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'Raju123456');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    await screen.findByTestId('dashboard-screen');
    expect(screen.queryByTestId('tile-sales')).toBeNull();
    expect(routeForLink('/app/sales/aaaaaaaaaaaaaaaaaaaaaaaa', null)).toBeNull();
  });

  test('owner opens a due enquiry and makes a quotation with live total', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.sales.leads.push(lead);
    await renderApp({ showLanding: false });
    await fireEvent.changeText(await screen.findByTestId('signin-email'), 'owner@airtech.in');
    await fireEvent.changeText(screen.getByTestId('signin-password'), 'Owner12345');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    await screen.findByTestId('dashboard-screen');
    await fireEvent.press(screen.getByTestId('tile-sales'));
    expect(await screen.findByTestId('sl-due')).toHaveTextContent(/1/);
    const row = await screen.findByTestId('sl-row-EN-0001');
    expect(row).toHaveTextContent(/Follow up \(due/);
    await fireEvent.press(row);
    await screen.findByTestId('lead-screen');
    expect(screen.getByTestId('ld-due')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ld-new-quote'));
    await screen.findByTestId('quote-form-screen');
    await fireEvent.changeText(screen.getByTestId('qf-desc-0'), 'VRF outdoor unit');
    await fireEvent.changeText(screen.getByTestId('qf-qty-0'), '2');
    await fireEvent.changeText(screen.getByTestId('qf-rate-0'), '350000');
    await fireEvent.press(screen.getByTestId('qf-add'));
    await fireEvent.changeText(screen.getByTestId('qf-desc-1'), 'Copper piping');
    await fireEvent.changeText(screen.getByTestId('qf-unit-1'), 'Rmt');
    await fireEvent.changeText(screen.getByTestId('qf-qty-1'), '120');
    await fireEvent.changeText(screen.getByTestId('qf-rate-1'), '950');
    await fireEvent.changeText(screen.getByTestId('qf-discount'), '4000');
    expect(screen.getByTestId('qf-total')).toHaveTextContent(/₹9,55,800/);
    await fireEvent.press(screen.getByTestId('qf-save'));
    await screen.findByTestId('lead-screen');
    expect(await screen.findByTestId('ld-quote-QT-0001')).toHaveTextContent(/Draft/);
    expect(api.sales.quotes[0].lines).toHaveLength(2);
    await fireEvent.press(screen.getByTestId('ld-send-QT-0001'));
    await waitFor(() => expect(screen.getByTestId('ld-quote-QT-0001')).toHaveTextContent(/Sent/));
    expect(screen.getByTestId('ld-won-QT-0001')).toBeTruthy();
  });
});
