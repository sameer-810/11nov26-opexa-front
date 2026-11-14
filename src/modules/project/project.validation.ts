import { parseNumber } from '../../shared/format';

export type ProjectForm = { name: string; clientName: string; siteAddress: string; clientPoNumber: string; lat: string; lng: string; geofenceRadiusM: string };
export type ProjectFormErrors = Partial<Record<keyof ProjectForm, string>>;

export function validateProjectForm(f: ProjectForm): ProjectFormErrors {
  const e: ProjectFormErrors = {};
  if (f.name.trim().length < 2) e.name = 'Enter the project name';
  if (f.clientName.trim().length < 2) e.clientName = 'Enter the client name';
  const lat = parseNumber(f.lat);
  const lng = parseNumber(f.lng);
  if ((f.lat.trim() || f.lng.trim()) && (lat === null || lng === null)) e.lat = 'Enter both latitude and longitude, or leave both empty';
  if (lat !== null && (lat < -90 || lat > 90)) e.lat = 'Latitude must be between -90 and 90';
  if (lng !== null && (lng < -180 || lng > 180)) e.lng = 'Longitude must be between -180 and 180';
  const r = parseNumber(f.geofenceRadiusM);
  if (r === null || r < 50 || r > 2000 || !Number.isInteger(r)) e.geofenceRadiusM = 'Enter a whole number from 50 to 2000';
  return e;
}

export type ItemForm = { serialNo: string; description: string; unit: string; quantity: string; rate: string };
export type ItemErrors = Partial<Record<keyof ItemForm, string>>;

export function validateItemForm(f: ItemForm): ItemErrors {
  const e: ItemErrors = {};
  if (!f.serialNo.trim()) e.serialNo = 'Required';
  if (f.description.trim().length < 2) e.description = 'Enter a description';
  if (!f.unit.trim()) e.unit = 'Required';
  const q = parseNumber(f.quantity);
  if (q === null || q <= 0) e.quantity = 'More than 0';
  const r = parseNumber(f.rate);
  if (f.rate.trim() && (r === null || r < 0)) e.rate = 'Not negative';
  return e;
}
