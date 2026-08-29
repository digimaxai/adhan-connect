import { supabase } from '../supabase';

export type MosqueSearchRow = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  distance_km?: number | null;
  is_live?: boolean | null;
  lat?: number | null;
  lng?: number | null;
};

export type MosqueSearchLocation = {
  latitude: number;
  longitude: number;
};

export const MOSQUE_SEARCH_SELECT = 'id,name,city,country,lat,lng';

const toRadians = (degrees: number) => degrees * (Math.PI / 180);

export function calculateDistanceKm(from: MosqueSearchLocation, mosque: MosqueSearchRow): number | null {
  if (mosque.lat == null || mosque.lng == null) return null;
  const lat = Number(mosque.lat);
  const lng = Number(mosque.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat - from.latitude);
  const dLng = toRadians(lng - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function withDistances(rows: MosqueSearchRow[], userLocation: MosqueSearchLocation | null): MosqueSearchRow[] {
  if (!userLocation) return rows.map((row) => ({ ...row, distance_km: row.distance_km ?? null }));
  return rows.map((row) => ({ ...row, distance_km: calculateDistanceKm(userLocation, row) }));
}

export function sortMosques(rows: MosqueSearchRow[], userLocation: MosqueSearchLocation | null): MosqueSearchRow[] {
  return [...rows].sort((a, b) => {
    if (userLocation) {
      if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
      if (a.distance_km != null) return -1;
      if (b.distance_km != null) return 1;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

export function escapePostgrestSearchTerm(term: string): string {
  return term.replace(/[,%]/g, ' ').trim();
}

export async function attachMissingCoordinates(rows: MosqueSearchRow[]): Promise<MosqueSearchRow[]> {
  const missingIds = rows
    .filter((row) => row.id && (row.lat == null || row.lng == null))
    .map((row) => row.id);

  if (!missingIds.length) return rows;

  const { data, error } = await supabase
    .from('mosques')
    .select('id,lat,lng')
    .in('id', Array.from(new Set(missingIds)));

  if (error || !Array.isArray(data)) return rows;

  const coordinateMap = new Map(
    (data as Pick<MosqueSearchRow, 'id' | 'lat' | 'lng'>[]).map((row) => [row.id, { lat: row.lat ?? null, lng: row.lng ?? null }])
  );

  return rows.map((row) => ({ ...row, ...coordinateMap.get(row.id) }));
}

export async function fetchMosqueFallback(term: string): Promise<MosqueSearchRow[]> {
  const safeTerm = escapePostgrestSearchTerm(term);
  const buildQuery = (select: string) => {
    let request = supabase
      .from('mosques')
      .select(select)
      .order('name', { ascending: true })
      .limit(100);

    if (safeTerm) {
      request = request.or(`name.ilike.%${safeTerm}%,city.ilike.%${safeTerm}%,country.ilike.%${safeTerm}%`);
    }

    return request;
  };

  const { data, error } = await buildQuery(MOSQUE_SEARCH_SELECT);
  if (!error) return ((data as unknown as MosqueSearchRow[]) ?? []);

  const { data: basicData, error: basicError } = await buildQuery('id,name,city,country');
  if (basicError) throw basicError;
  return ((basicData as unknown as MosqueSearchRow[]) ?? []);
}

export async function searchMosques(
  term: string,
  userLocation?: MosqueSearchLocation | null
): Promise<MosqueSearchRow[]> {
  const trimmed = term.trim();
  const { data, error } = await supabase.rpc('search_mosques', { term: trimmed === '' ? null : trimmed });
  let rows: MosqueSearchRow[];

  if (!error && Array.isArray(data)) {
    rows = data as MosqueSearchRow[];
  } else {
    rows = await fetchMosqueFallback(trimmed);
  }

  const activeLocation = userLocation ?? null;
  if (activeLocation) rows = await attachMissingCoordinates(rows);

  return sortMosques(withDistances(rows, activeLocation), activeLocation);
}
