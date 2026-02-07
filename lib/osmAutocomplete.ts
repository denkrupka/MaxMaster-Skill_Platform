/**
 * OpenStreetMap Nominatim API Integration
 * Address autocomplete and geocoding for Polish addresses
 *
 * Uses Nominatim API: https://nominatim.org/
 * Rate limit: 1 request per second (we add debouncing)
 */

export interface OSMAddress {
  displayName: string;
  street: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  country: string;
  lat: number;
  lon: number;
  placeId: number;
  // Additional details
  state?: string;      // Voivodeship
  county?: string;     // Powiat
  suburb?: string;     // District/neighborhood
}

export interface OSMSearchResult {
  success: boolean;
  results: OSMAddress[];
  error?: string;
}

// Nominatim API base URL (use public or self-hosted)
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

// User agent required by Nominatim ToS
const USER_AGENT = 'MaxMaster-Platform/1.0';

/**
 * Search for addresses using Nominatim
 *
 * @param query - Search query (address string)
 * @param countryCode - Limit to specific country (default: 'pl' for Poland)
 * @param limit - Maximum results to return (default: 5)
 */
export async function searchAddress(
  query: string,
  countryCode: string = 'pl',
  limit: number = 5
): Promise<OSMSearchResult> {
  if (!query || query.trim().length < 3) {
    return { success: true, results: [] };
  }

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      addressdetails: '1',
      countrycodes: countryCode,
      limit: String(limit),
      'accept-language': 'pl'
    });

    const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const results: OSMAddress[] = data.map((item: any) => parseNominatimResult(item));

    return {
      success: true,
      results
    };
  } catch (error: any) {
    console.error('OSM search error:', error);
    return {
      success: false,
      results: [],
      error: `Błąd wyszukiwania adresu: ${error.message}`
    };
  }
}

/**
 * Search specifically for street addresses in a city
 */
export async function searchStreet(
  streetQuery: string,
  city?: string,
  countryCode: string = 'pl'
): Promise<OSMSearchResult> {
  const query = city ? `${streetQuery}, ${city}` : streetQuery;
  return searchAddress(query, countryCode);
}

/**
 * Get address details by coordinates (reverse geocoding)
 */
export async function reverseGeocode(lat: number, lon: number): Promise<OSMAddress | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'json',
      addressdetails: '1',
      'accept-language': 'pl'
    });

    const response = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return parseNominatimResult(data);
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return null;
  }
}

/**
 * Parse Nominatim response to our format
 */
function parseNominatimResult(item: any): OSMAddress {
  const addr = item.address || {};

  // Extract street name (can be in different fields)
  let street = addr.road || addr.street || addr.pedestrian || addr.footway || '';

  // Extract street number
  let streetNumber = addr.house_number || '';

  // Extract city (can be in different fields)
  let city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || '';

  // Extract postal code
  let postalCode = addr.postcode || '';

  // Build display name
  const parts: string[] = [];
  if (street) {
    parts.push(streetNumber ? `${street} ${streetNumber}` : street);
  }
  if (city) {
    parts.push(city);
  }
  if (postalCode && !parts.some(p => p.includes(postalCode))) {
    parts.push(postalCode);
  }

  return {
    displayName: item.display_name || parts.join(', '),
    street,
    streetNumber,
    city,
    postalCode,
    country: addr.country || 'Polska',
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    placeId: item.place_id,
    state: addr.state,
    county: addr.county,
    suburb: addr.suburb || addr.neighbourhood || addr.quarter
  };
}

/**
 * Debounce helper for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Create a debounced address search function
 * Recommended delay: 500ms to respect Nominatim rate limits
 */
export function createDebouncedSearch(delay: number = 500) {
  let currentAbortController: AbortController | null = null;

  const search = async (
    query: string,
    onResults: (results: OSMAddress[]) => void,
    onError?: (error: string) => void
  ) => {
    // Cancel previous request
    if (currentAbortController) {
      currentAbortController.abort();
    }

    if (!query || query.trim().length < 3) {
      onResults([]);
      return;
    }

    currentAbortController = new AbortController();

    try {
      const result = await searchAddress(query);

      if (result.success) {
        onResults(result.results);
      } else if (onError) {
        onError(result.error || 'Błąd wyszukiwania');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError' && onError) {
        onError(error.message);
      }
    }
  };

  return debounce(search, delay);
}

/**
 * Format address for display
 */
export function formatAddress(address: OSMAddress): string {
  const parts: string[] = [];

  if (address.street) {
    parts.push(address.streetNumber ? `${address.street} ${address.streetNumber}` : address.street);
  }

  if (address.postalCode && address.city) {
    parts.push(`${address.postalCode} ${address.city}`);
  } else if (address.city) {
    parts.push(address.city);
  }

  if (address.country && address.country !== 'Polska') {
    parts.push(address.country);
  }

  return parts.join(', ');
}

/**
 * Parse user-entered address string to components
 * Useful for populating form fields from pasted address
 */
export function parseAddressString(input: string): Partial<OSMAddress> {
  const result: Partial<OSMAddress> = {};

  if (!input) return result;

  // Try to extract postal code (XX-XXX format for Poland)
  const postalMatch = input.match(/(\d{2}-\d{3})/);
  if (postalMatch) {
    result.postalCode = postalMatch[1];

    // City usually follows postal code
    const cityMatch = input.match(/\d{2}-\d{3}\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ\s-]+?)(?:,|$)/i);
    if (cityMatch) {
      result.city = cityMatch[1].trim();
    }
  }

  // Try to extract street with number
  const streetMatch = input.match(/^(?:ul\.|ulica|al\.|aleja)?\s*([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ\s.-]+?)\s*(\d+[A-Za-z]?(?:\s*\/\s*\d+)?)/i);
  if (streetMatch) {
    result.street = streetMatch[1].trim();
    result.streetNumber = streetMatch[2].replace(/\s/g, '');
  } else {
    // Try without number
    const streetOnlyMatch = input.match(/^(?:ul\.|ulica|al\.|aleja)?\s*([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ\s.-]+?)(?:,|$)/i);
    if (streetOnlyMatch) {
      result.street = streetOnlyMatch[1].trim();
    }
  }

  return result;
}
