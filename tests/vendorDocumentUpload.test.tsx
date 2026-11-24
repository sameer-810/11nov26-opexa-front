import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { VendorDocumentUpload } from '../src/modules/vendor/components/VendorDocumentUpload';
import { vendorApi } from '../src/modules/vendor/api/vendorApi';

afterEach(() => jest.restoreAllMocks());
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file://licence.pdf', name: 'licence.pdf', mimeType: 'application/pdf' }] })) }));

test('5F - purchaser uploads a supplier document with its expiry date', async () => {
  const add = jest.spyOn(vendorApi, 'addDocument').mockResolvedValue({ id: 'd1', label: 'Trade licence', name: 'licence.pdf', contentType: 'application/pdf', size: 10, validUntil: '2027-03-31', uploadedAt: '2026-11-24' });
  const onUploaded = jest.fn();
  await render(<VendorDocumentUpload vendorId="v1" onUploaded={onUploaded} />);
  await fireEvent.changeText(screen.getByTestId('vendor-doc-label'), 'Trade licence');
  await fireEvent.changeText(screen.getByTestId('vendor-doc-until'), '2027-03-31');
  await fireEvent.press(screen.getByTestId('vendor-doc-upload'));
  await waitFor(() => expect(onUploaded).toHaveBeenCalled());
  expect(add).toHaveBeenCalledWith('v1', expect.objectContaining({ name: 'licence.pdf' }), 'Trade licence', '2027-03-31');
});

test('5F - a badly typed expiry is refused before any file is picked', async () => {
  const add = jest.spyOn(vendorApi, 'addDocument');
  await render(<VendorDocumentUpload vendorId="v1" onUploaded={jest.fn()} />);
  await fireEvent.changeText(screen.getByTestId('vendor-doc-until'), '31/03/2027');
  await fireEvent.press(screen.getByTestId('vendor-doc-upload'));
  expect(await screen.findByTestId('vendor-doc-problem')).toBeTruthy();
  expect(add).not.toHaveBeenCalled();
});
