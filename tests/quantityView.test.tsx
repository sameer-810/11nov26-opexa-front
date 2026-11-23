import { render, screen } from '@testing-library/react-native';
import * as RN from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QuantityViewScreen, type QuantityLine } from '../src/modules/project/screens/QuantityViewScreen';

const pipe: QuantityLine = { key: 'i1', workOrderItemId: 'i1', materialId: null, boq: true, serialNo: '1', description: 'Copper pipe', unit: 'Rmt', boqQty: 2000, requested: 1000, approved: 1000, ordered: 600, received: 400, supplierInvoiced: 300, issued: 0, consumed: 250, returned: 20, executed: 250, billed: 200 };
const copper: QuantityLine = { key: 'm:c1', workOrderItemId: null, materialId: 'c1', boq: false, serialNo: '2', description: 'Copper 3/8 package', unit: 'Rmt', boqQty: null, requested: 100, approved: 100, ordered: 100, received: 100, supplierInvoiced: 0, issued: 50, consumed: 30, returned: 0, executed: null, billed: null };

function mockFetch() {
  globalThis.fetch = jest.fn(async (url: string) => {
    expect(url).toMatch(/\/projects\/p1\/quantities$/);
    return { ok: true, status: 200, json: async () => ({ success: true, data: { projectId: 'p1', code: 'P-001', name: 'Worli', lines: [pipe, copper] } }) };
  }) as unknown as typeof fetch;
}
const props = { navigation: { navigate: jest.fn() }, route: { key: 'q', name: 'ProjectQuantities', params: { id: 'p1' } } } as unknown as Parameters<typeof QuantityViewScreen>[0];
const start = RN.Dimensions.get('window');
const setWidth = (width: number) => { const w = { ...start, width }; RN.Dimensions.set({ window: w, screen: w }); };

afterEach(() => RN.Dimensions.set({ window: start, screen: start }));

test('X1 - web: one table row per line with all ten quantities; non-BOQ material shows no billing', async () => {
  mockFetch();
  setWidth(1280);
  await render(<NavigationContainer><QuantityViewScreen {...props} /></NavigationContainer>);
  expect(await screen.findByTestId('qty-table')).toBeTruthy();
  const want: Record<string, string> = { requested: '1000', approved: '1000', ordered: '600', received: '400', supplierInvoiced: '300', issued: '0', consumed: '250', returned: '20', executed: '250', billed: '200' };
  for (const [f, v] of Object.entries(want)) expect(screen.getByTestId(`qty-i1-${f}`)).toHaveTextContent(v);
  expect(screen.getByTestId('qty-row-m:c1')).toHaveTextContent(/Non-BOQ · Copper 3\/8 package/);
  expect(screen.getByTestId('qty-m:c1-issued')).toHaveTextContent('50');
  expect(screen.getByTestId('qty-m:c1-billed')).toHaveTextContent('—');
});

test('X1 - phone: a card per line instead of the table', async () => {
  mockFetch();
  setWidth(390);
  await render(<NavigationContainer><QuantityViewScreen {...props} /></NavigationContainer>);
  expect(await screen.findByTestId('qty-card-i1')).toHaveTextContent(/BOQ 2000/);
  expect(screen.queryByTestId('qty-table')).toBeNull();
  expect(screen.getByTestId('qty-i1-received')).toHaveTextContent('400');
});
