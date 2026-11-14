import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export class CaptureError extends Error {}

// Current GPS position. "mocked" is true when Android reports a fake-location app.
export async function currentPosition() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new CaptureError('Allow location access to mark attendance.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? 9999,
    mocked: Boolean((pos as unknown as { mocked?: boolean }).mocked),
  };
}

// Front-camera selfie, shrunk to ~480 px so it uploads quickly on site networks.
export async function takeSelfie(): Promise<Blob | { uri: string; name: string; type: string }> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== 'granted') throw new CaptureError('Allow camera access to take the attendance selfie.');
  const shot = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.6, allowsEditing: false, mediaTypes: ['images'] });
  if (shot.canceled || !shot.assets?.[0]) throw new CaptureError('Selfie was not taken.');
  const small = await ImageManipulator.manipulateAsync(shot.assets[0].uri, [{ resize: { width: 480 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
  if (Platform.OS === 'web') return (await fetch(small.uri)).blob();
  return { uri: small.uri, name: 'selfie.jpg', type: 'image/jpeg' };
}
