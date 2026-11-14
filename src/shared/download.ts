import { Platform } from 'react-native';

// Saves a Blob as a file. Web: browser download. Phones: handled in a later phase (share sheet).
export function saveBlob(blob: Blob, filename: string): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
