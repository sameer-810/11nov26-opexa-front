import { api } from '../api/apiClient';

export type GeoResult = { label: string; lat: number; lng: number };

// Address search for site / project locations (the server asks OpenStreetMap).
export const geoApi = {
  search: (q: string) => api<GeoResult[]>(`/geo/search?q=${encodeURIComponent(q)}`),
};
