import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';
import { GstSummary, SlabNotes } from '../src/modules/invoice/components/InvoiceBilling';
import type { Invoice } from '../src/modules/invoice/invoiceApi';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

test('Phase 7 - full high-side slab billed with 1 AHU pending; the true position stays visible', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] });
  api.billing.plan = { id: 'bp1', status: 'approved', retentionPct: 5, slabBase: 'contract_value', baseValue: 1000000, highSideValue: 1000000, highSideItemIds: ['i1'], milestones: [{ id: 'm2', name: 'High-side delivery', stage: 'high_side_delivery', basis: 'percent', percent: 30, fixedAmount: 0, amount: 300000, billed: 0, linkedItemIds: ['i1'] }] };
  api.billing.position = { planStatus: 'approved', slabBase: 'contract_value', baseValue: 1000000, highSideValue: 1000000, remainingObligation: 0, lowSide: [], milestones: [{ id: 'm2', name: 'High-side delivery', stage: 'high_side_delivery', contractPct: 30, computedAmount: 270000, eligible: false, completion: null, remainingObligation: 0, amount: 300000, billed: 0, unbilled: 300000, linkedTotalQty: 10, linkedDoneQty: 9, pendingQty: 1, deliveredPct: 90, billedAheadOfDelivery: false, pending: [{ serialNo: '4', description: 'AHU 10000 CFM', pendingQty: 1, unit: 'Nos' }] },
    { id: 'm3', name: 'Installation', stage: 'installation', contractPct: 25, computedAmount: 0, eligible: false, completion: null, remainingObligation: 50000, amount: 250000, billed: 50000, unbilled: 200000, trackBy: 'installed', linkedTotalQty: 10, linkedDoneQty: 0, pendingQty: 10, deliveredPct: 0, billedAheadOfDelivery: true, pending: [] }] };
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'owner@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Owner12345');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
  await fireEvent.press(await screen.findByTestId('project-billing'));
  const slab = await screen.findByTestId('slab-pos-High-side delivery');
  expect(slab).toHaveTextContent(/delivered 9\/10 \(90%\)/);
  expect(slab).toHaveTextContent(/Pending: S.No 4 AHU 10000 CFM — 1 Nos/);
  expect(slab).toHaveTextContent(/High-side delivery \(30%\)/);
  // An installation slab tracks installed quantity, not delivery.
  const ins = screen.getByTestId('slab-pos-Installation');
  expect(ins).toHaveTextContent(/installed 0\/10 \(0%\)/);
  expect(ins).toHaveTextContent(/Billed ahead of installation/);
  expect(screen.getByTestId('slab-obligation-Installation')).toHaveTextContent(/billed but not yet installed/);
  expect(screen.getByTestId('slab-base-value')).toHaveTextContent(/Slabs on contract value/);
  // Not complete: early-billing warning; the amount defaults to what delivery supports (9/10 of 30%).
  expect(screen.getByTestId('slab-early-High-side delivery')).toHaveTextContent(/needs a reason and approval/);
  expect(screen.getByTestId('slab-amount-High-side delivery').props.value).toBe('270000');
  await fireEvent.changeText(screen.getByTestId('slab-amount-High-side delivery'), '300000');
  expect(screen.getByTestId('slab-above-High-side delivery')).toHaveTextContent(/override record/);
  await fireEvent.changeText(screen.getByTestId('slab-reason-High-side delivery'), 'Contract allows the full 30%');
  await fireEvent.press(screen.getByTestId('slab-bill-High-side delivery'));
  await waitFor(() => expect(api.billing.invoices).toHaveLength(1));
  expect(api.billing.invoices[0]).toMatchObject({ milestoneId: 'm2', amount: 300000, reason: 'Contract allows the full 30%' });
});

const inv = (over: Partial<Invoice>): Invoice => ({
  id: 'i1', number: 'GAT/26-27/0002', draftNo: 2, label: 'GAT/26-27/0002', status: 'issued', basis: 'milestone', project: { id: 'p1' }, lotIds: [], invoiceDate: '2026-11-20',
  client: { name: 'Lodha', gstin: '', address: '', state: '', poNumber: '' }, gstRate: 18, interState: false, lines: [], taxable: 57000, cgst: 7730, sgst: 7730, igst: 0, roundOff: 0, total: 72460,
  totalInWords: '', notes: '', edits: [], attachments: [], issuedAt: null, cancelReason: null, createdAt: '2026-11-20', ...over,
});

test('4D / 4B - GST summary per rate, early billing status, override record and revisions on the invoice', async () => {
  await render(<GstSummary inv={inv({ gstMode: 'line', gstSummary: [{ rate: 18, taxable: 5000, cgst: 450, sgst: 450, igst: 0 }, { rate: 28, taxable: 52000, cgst: 7280, sgst: 7280, igst: 0 }] })} />);
  expect(screen.getByTestId('inv-gst-summary')).toHaveTextContent(/GST 18%.*GST 28%/);
  await render(<SlabNotes inv={inv({ earlyBilling: { status: 'pending', reason: 'Client asked', at: '2026-11-20', approvalRequestId: 'a1' }, overrides: [{ amount: 156000, computedAmount: 140400, reason: 'Full 30% per contract', byName: 'Accounts', at: '2026-11-20' }], revisions: [{ revision: 1, at: '2026-11-21', reason: 'PO ref', snapshot: { total: 72460 } }] })} />);
  expect(screen.getByTestId('inv-early')).toHaveTextContent(/pending.*Client asked.*once the approval is through/);
  expect(screen.getByTestId('inv-override-0')).toHaveTextContent(/₹1,56,000.*₹1,40,400.*Full 30% per contract/);
  expect(screen.getByTestId('inv-revision-1')).toHaveTextContent(/Revision 1.*PO ref/);
});
