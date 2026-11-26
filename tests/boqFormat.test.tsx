import * as RN from 'react-native';
import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { installBoqMock } from './helpers/mockBoqApi';
import { renderApp } from './helpers/renderApp';
import { BoqTable } from '../src/modules/project/components/BoqTable';
import { BoqItemForm } from '../src/modules/project/components/BoqItemForm';
import type { BoqColumn } from '../src/modules/project/types';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 19.0176, longitude: 72.8172 } })),
}));

async function signInAsOwner() {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'owner@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Owner12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
}
const project = (extra: Record<string, unknown> = {}) => ({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active' as const, siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [], ...extra });
const headers = () => screen.queryAllByTestId(/^boq-col-/).map((n) => n.props.testID as string);

describe('Q18 - BOQ format choice', () => {
  test('a Supply + Installation project takes split rates and shows the split columns', async () => {
    const api = installMockApi();
    const boqMock = installBoqMock(api);
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    await signInAsOwner();
    await fireEvent.press(screen.getByTestId('tile-projects'));
    await fireEvent.press(await screen.findByTestId('new-project'));
    await fireEvent.changeText(await screen.findByTestId('pf-name'), 'Bandra Mall');
    await fireEvent.changeText(screen.getByTestId('pf-client'), 'Oberoi');
    await fireEvent.press(screen.getByTestId('pf-boq-format-supply_installation'));
    await fireEvent.press(screen.getByTestId('pf-submit'));

    await screen.findByTestId('project-detail-screen');
    expect(api.projects[0]).toMatchObject({ boqFormat: 'supply_installation' });
    expect(screen.getByTestId('fact-boq-format')).toHaveTextContent('Supply + Installation');

    await fireEvent.press(screen.getByTestId('add-boq-item'));
    expect(screen.queryByTestId('bi-rate')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('bi-desc'), 'Ductable AC 8.5 TR');
    await fireEvent.press(screen.getByTestId('bi-unit'));
    await fireEvent.press(screen.getByTestId('bi-unit-Nos'));
    await fireEvent.changeText(screen.getByTestId('bi-qty'), '10');
    await fireEvent.changeText(screen.getByTestId('bi-supply-rate'), '40,000');
    await fireEvent.changeText(screen.getByTestId('bi-installation-rate'), '2,500');
    // The entry row works out the sheet's totals as you type.
    expect(screen.getByTestId('bi-total-supply')).toHaveTextContent(/4,00,000/);
    expect(screen.getByTestId('bi-total-install')).toHaveTextContent(/25,000/);
    expect(screen.getByTestId('bi-total')).toHaveTextContent(/4,25,000/);
    await fireEvent.press(screen.getByTestId('bi-save'));

    expect(await screen.findByTestId('boq-row-1')).toBeTruthy();
    expect(boqMock.itemBodies[0]).toMatchObject({ supplyRate: 40000, installationRate: 2500 });
    expect(boqMock.itemBodies[0]).not.toHaveProperty('rate');
    expect(headers()).toEqual(expect.arrayContaining(['boq-col-supplyRate', 'boq-col-installationRate', 'boq-col-supplyAmount']));
    expect(screen.getByTestId('boq-total')).toHaveTextContent(/4,25,000/);
    expect(screen.getByTestId('boq-total-supplyAmount')).toHaveTextContent(/4,00,000/);
    expect(screen.getByTestId('boq-total-installationAmount')).toHaveTextContent(/25,000/);
  });

  test('SITC is the default; a locked BOQ shows the format as fixed', async () => {
    const api = installMockApi();
    installBoqMock(api);
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.projects.push(project());
    Object.assign(api.projects[0], { boqLocked: true });
    await signInAsOwner();
    await fireEvent.press(screen.getByTestId('tile-projects'));
    await fireEvent.press(await screen.findByTestId('project-P-001'));
    expect(await screen.findByTestId('fact-boq-format')).toHaveTextContent('SITC (one rate) · locked');
    // A locked BOQ changes only through a revision: no import / add on the BOQ itself.
    expect(screen.queryByTestId('import-boq')).toBeNull();
    expect(screen.queryByTestId('add-boq-item')).toBeNull();
    await fireEvent.press(screen.getByTestId('edit-project'));
    expect(await screen.findByTestId('pf-boq-format-locked')).toHaveTextContent(/fixed, the BOQ is locked/);
    expect(screen.queryByTestId('pf-boq-format-sitc')).toBeNull();
  });
});

describe('Q19 - BOQ columns', () => {
  test('renders the saved order, labels and visibility; flags over-BOQ; column settings save', async () => {
    const api = installMockApi();
    const boqMock = installBoqMock(api);
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.projects.push(project());
    api.boq.push({ id: 'i1', projectId: 'p1', serialNo: '1', quantity: 2000, rate: 500, amount: 1000000 });
    boqMock.setQuantities('i1', { executedQty: 1900, approvedQty: 2050 });
    boqMock.setColumns('p1', [
      { key: 'description', label: 'Item', visible: true, order: 0 },
      { key: 'serialNo', label: 'Sr', visible: true, order: 1 },
      { key: 'remarks', label: 'Notes', visible: false, order: 99 },
    ]);
    await signInAsOwner();
    await fireEvent.press(screen.getByTestId('tile-projects'));
    await fireEvent.press(await screen.findByTestId('project-P-001'));

    await screen.findByTestId('boq-over-summary');
    expect(headers().slice(0, 2)).toEqual(['boq-col-description', 'boq-col-serialNo']);
    expect(screen.getByTestId('boq-col-description')).toHaveTextContent('Item');
    expect(screen.queryByTestId('boq-col-remarks')).toBeNull();
    expect(screen.queryByTestId('boq-col-supplyRate')).toBeNull(); // SITC project: no split columns
    const row = within(screen.getByTestId('boq-row-1'));
    expect(row.getByText('2,050')).toBeTruthy();
    expect(row.getByText('1,900')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('boq-columns'));
    await fireEvent.press(await screen.findByTestId('col-toggle-unit'));
    await fireEvent.changeText(screen.getByTestId('col-label-amount'), 'Value');
    await fireEvent.press(screen.getByTestId('col-up-serialNo'));
    await fireEvent.press(screen.getByTestId('boq-columns-save'));

    await screen.findByText('Value');
    const sent = boqMock.columnSaves[0];
    expect(sent.find((c: BoqColumn) => c.key === 'unit')).toMatchObject({ visible: false });
    expect(sent.slice(0, 2).map((c: BoqColumn) => c.key)).toEqual(['serialNo', 'description']);
    expect(sent.map((c: BoqColumn) => c.order)).toEqual(sent.map((_: BoqColumn, i: number) => i));
    expect(screen.queryByTestId('boq-col-unit')).toBeNull();
    expect(headers().slice(0, 2)).toEqual(['boq-col-serialNo', 'boq-col-description']);
  });

  test('phones get one card per line with the visible columns', async () => {
    const wide = RN.Dimensions.get('window');
    const phone = { width: 390, height: 844, scale: 3, fontScale: 1 };
    RN.Dimensions.set({ window: phone, screen: phone });
    const columns: BoqColumn[] = [
      { key: 'description', label: 'Item', visible: true, order: 0 },
      { key: 'quantity', label: 'Qty', visible: true, order: 1 },
      { key: 'installationAmount', label: 'Install amt', visible: true, order: 2 },
      { key: 'amount', label: 'Value', visible: true, order: 3 },
      { key: 'unit', label: 'UOM', visible: false, order: 4 },
    ];
    await render(<BoqTable columns={columns} lines={[{ id: 'a', projectId: 'p', serialNo: '1', description: 'AHU', unit: 'Nos', quantity: 2, rate: 160000, amount: 320000, supplyAmount: 300000, installationAmount: 20000, overBoq: true, overBoqQty: 1, approvedQty: 3 }]} />);
    expect(screen.getByTestId('boq-cards')).toBeTruthy();
    expect(screen.queryByTestId('boq-table')).toBeNull();
    const card = within(screen.getByTestId('boq-row-1'));
    expect(card.getByText('AHU')).toBeTruthy();
    expect(card.getByText('Install amt')).toBeTruthy();
    expect(card.queryByText('UOM')).toBeNull();
    expect(screen.getByTestId('boq-over-1')).toHaveTextContent('Over BOQ by 1 Nos');
    expect(screen.getByTestId('boq-total')).toHaveTextContent(/3,20,000/);
    RN.Dimensions.set({ window: wide, screen: wide });
  });
});

describe('BOQ unit dropdown', () => {
  test('offers the company units, and keeps an imported unit that is not in the list', async () => {
    const item = { id: 'i1', projectId: 'p1', serialNo: '1', description: 'Duct', unit: 'Set', quantity: 1, rate: 10, amount: 10 };
    await render(<BoqItemForm initial={item} onSave={async () => undefined} onCancel={() => undefined} />);
    expect(screen.queryByTestId('bi-unit-menu')).toBeNull();
    await fireEvent.press(screen.getByTestId('bi-unit'));
    for (const u of ['Nos', 'RMT', 'sqmtr', 'Rmtr', 'kg', 'Sq.mtr', 'Lot', 'No', 'Set']) expect(screen.getByTestId(`bi-unit-${u}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('bi-unit-RMT'));
    expect(screen.queryByTestId('bi-unit-menu')).toBeNull();
    expect(screen.getByTestId('bi-unit')).toHaveTextContent(/RMT/);
  });
});
