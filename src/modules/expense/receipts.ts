import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { PickedFile } from '../requisition/api/requisitionApi';

export class ReceiptError extends Error {}

// A receipt photo from the camera or the gallery, as a file ready to upload (PDFs use pickAttachment).
export async function pickReceiptPhoto(source: 'camera' | 'gallery'): Promise<PickedFile | null> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') throw new ReceiptError(`Allow ${source === 'camera' ? 'camera' : 'photo'} access to add the receipt.`);
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: false };
  const shot = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (shot.canceled || !shot.assets?.[0]) return null;
  const a = shot.assets[0];
  const name = a.fileName ?? `receipt-${Date.now()}.jpg`;
  const type = a.mimeType ?? 'image/jpeg';
  if (Platform.OS === 'web') return { name, file: await (await fetch(a.uri)).blob() };
  return { name, file: { uri: a.uri, name, type } };
}
