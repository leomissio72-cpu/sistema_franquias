export interface AddressCoordinates {
  lat: number;
  lng: number;
  displayName?: string;
}

/**
 * Procura o endereço informado pelo usuário no OpenStreetMap/Nominatim.
 * Nunca retorna um ponto aproximado: sem resultado, retorna null.
 */
export async function geocodeAddress(address: string, city: string): Promise<AddressCoordinates | null> {
  const query = `${address}, ${city}, Brasil`.trim();
  if (!address.trim() || !city.trim()) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      countrycodes: "br",
      addressdetails: "1",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const result = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = result[0];
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng, displayName: first?.display_name };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
