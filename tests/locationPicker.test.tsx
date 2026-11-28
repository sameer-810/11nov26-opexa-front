import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LocationPicker } from '../src/shared/geo/LocationPicker';
import { geoApi } from '../src/shared/geo/geoApi';

afterEach(() => jest.restoreAllMocks());

test('site location: find the typed address and pick a result to fill latitude and longitude', async () => {
  const search = jest.spyOn(geoApi, 'search').mockResolvedValue([{ label: 'Vashi, Navi Mumbai, Maharashtra, India', lat: 19.0632481, lng: 72.9987966 }]);
  const onChange = jest.fn();
  await render(<LocationPicker address="Vashi Navi Mumbai" lat="" lng="" onChange={onChange} testID="loc" />);
  await fireEvent.press(screen.getByTestId('loc-find'));
  await waitFor(() => expect(search).toHaveBeenCalledWith('Vashi Navi Mumbai'));
  expect(await screen.findByTestId('loc-result-0')).toHaveTextContent('Vashi, Navi Mumbai, Maharashtra, India');
  await fireEvent.press(screen.getByTestId('loc-result-0'));
  expect(onChange).toHaveBeenCalledWith('19.063248', '72.998797');
});

test('site location: asks for an address first, and says when nothing is found', async () => {
  jest.spyOn(geoApi, 'search').mockResolvedValue([]);
  const { rerender } = await render(<LocationPicker address="" lat="" lng="" onChange={jest.fn()} testID="loc" />);
  await fireEvent.press(screen.getByTestId('loc-find'));
  expect(await screen.findByTestId('loc-problem')).toHaveTextContent('Type the site address first');
  await rerender(<LocationPicker address="Nowhere place 123" lat="" lng="" onChange={jest.fn()} testID="loc" />);
  await fireEvent.press(screen.getByTestId('loc-find'));
  expect(await screen.findByTestId('loc-problem')).toHaveTextContent(/No place found/);
});
