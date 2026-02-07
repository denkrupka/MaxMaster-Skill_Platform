/**
 * GUS API Integration
 * Fetching company data from Polish GUS (BIR) by NIP
 *
 * Note: Official GUS BIR1 API requires registration at:
 * https://api.stat.gov.pl/Home/RegonApi
 *
 * This module supports:
 * 1. Official GUS BIR1 API (with API key)
 * 2. Fallback simulation for development
 */

export interface GUSCompanyData {
  nip: string;
  regon?: string;
  name: string;
  street: string;
  streetNumber: string;
  apartmentNumber?: string;
  city: string;
  postalCode: string;
  voivodeship?: string;
  county?: string;
  commune?: string;
  country: string;
  phone?: string;
  email?: string;
  startDate?: string;
  mainActivityCode?: string; // PKD
  mainActivityName?: string;
  legalForm?: string;
}

export interface GUSApiResponse {
  success: boolean;
  data?: GUSCompanyData;
  error?: string;
}

// Normalize NIP - remove dashes and spaces
export function normalizeNip(nip: string): string {
  return nip.replace(/[\s-]/g, '');
}

// Validate NIP format (10 digits with checksum)
export function validateNip(nip: string): boolean {
  const normalizedNip = normalizeNip(nip);

  if (!/^\d{10}$/.test(normalizedNip)) {
    return false;
  }

  // NIP checksum validation
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(normalizedNip[i]) * weights[i];
  }

  const checkDigit = sum % 11;
  return checkDigit === parseInt(normalizedNip[9]);
}

// Format NIP with dashes for display
export function formatNip(nip: string): string {
  const normalized = normalizeNip(nip);
  if (normalized.length !== 10) return nip;
  return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6, 8)}-${normalized.slice(8)}`;
}

/**
 * Fetch company data from GUS BIR API
 *
 * @param nip - Company NIP (tax identification number)
 * @param apiKey - Optional API key for official GUS API
 * @returns Company data or error
 */
export async function fetchCompanyByNip(nip: string, apiKey?: string): Promise<GUSApiResponse> {
  const normalizedNip = normalizeNip(nip);

  // Validate NIP format
  if (!validateNip(normalizedNip)) {
    return {
      success: false,
      error: 'Nieprawidłowy format NIP'
    };
  }

  // If API key is provided, use official GUS API
  if (apiKey) {
    return fetchFromOfficialGusApi(normalizedNip, apiKey);
  }

  // Try public proxy services or return simulation for development
  try {
    // Try rejestr.io API (free, limited)
    const rejestrResponse = await fetchFromRejestrIo(normalizedNip);
    if (rejestrResponse.success) {
      return rejestrResponse;
    }
  } catch (e) {
    console.warn('Rejestr.io API failed, trying alternative...');
  }

  // Fallback: Return error suggesting manual entry
  return {
    success: false,
    error: 'Nie udało się pobrać danych z GUS. Wprowadź dane ręcznie.'
  };
}

/**
 * Fetch from official GUS BIR1 API
 */
async function fetchFromOfficialGusApi(nip: string, apiKey: string): Promise<GUSApiResponse> {
  const GUS_API_URL = 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';

  try {
    // Step 1: Login to get session ID
    const loginResponse = await fetch(GUS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8'
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07">
          <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
            <wsa:To>https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc</wsa:To>
            <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj</wsa:Action>
          </soap:Header>
          <soap:Body>
            <ns:Zaloguj>
              <ns:pKluczUzytkownika>${apiKey}</ns:pKluczUzytkownika>
            </ns:Zaloguj>
          </soap:Body>
        </soap:Envelope>`
    });

    if (!loginResponse.ok) {
      throw new Error('GUS API login failed');
    }

    const loginText = await loginResponse.text();
    const sidMatch = loginText.match(/<ZalogujResult>([^<]+)<\/ZalogujResult>/);

    if (!sidMatch || !sidMatch[1]) {
      throw new Error('Could not get session ID from GUS API');
    }

    const sessionId = sidMatch[1];

    // Step 2: Search by NIP
    const searchResponse = await fetch(GUS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'sid': sessionId
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">
          <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
            <wsa:To>https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc</wsa:To>
            <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty</wsa:Action>
          </soap:Header>
          <soap:Body>
            <ns:DaneSzukajPodmioty>
              <ns:pParametryWyszukiwania>
                <dat:Nip>${nip}</dat:Nip>
              </ns:pParametryWyszukiwania>
            </ns:DaneSzukajPodmioty>
          </soap:Body>
        </soap:Envelope>`
    });

    const searchText = await searchResponse.text();

    // Parse the response
    const data = parseGusResponse(searchText);

    if (data) {
      return { success: true, data };
    }

    return {
      success: false,
      error: 'Nie znaleziono firmy o podanym NIP'
    };
  } catch (error: any) {
    console.error('GUS API error:', error);
    return {
      success: false,
      error: `Błąd API GUS: ${error.message}`
    };
  }
}

/**
 * Parse GUS SOAP response to extract company data
 */
function parseGusResponse(xml: string): GUSCompanyData | null {
  try {
    // Extract data from XML (simplified parsing)
    const getValue = (tag: string): string => {
      const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
      return match ? match[1].trim() : '';
    };

    const nip = getValue('Nip');
    if (!nip) return null;

    return {
      nip,
      regon: getValue('Regon'),
      name: getValue('Nazwa'),
      street: getValue('Ulica'),
      streetNumber: getValue('NrNieruchomosci'),
      apartmentNumber: getValue('NrLokalu') || undefined,
      city: getValue('Miejscowosc'),
      postalCode: getValue('KodPocztowy'),
      voivodeship: getValue('Wojewodztwo') || undefined,
      county: getValue('Powiat') || undefined,
      commune: getValue('Gmina') || undefined,
      country: 'Polska'
    };
  } catch (e) {
    return null;
  }
}

/**
 * Fetch from Rejestr.io (free public API)
 * https://rejestr.io/
 */
async function fetchFromRejestrIo(nip: string): Promise<GUSApiResponse> {
  try {
    const response = await fetch(`https://rejestr.io/api/v2/org?nip=${nip}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Nie znaleziono firmy o podanym NIP'
        };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.name) {
      return {
        success: false,
        error: 'Nie znaleziono firmy o podanym NIP'
      };
    }

    // Parse address
    const addressParts = parseAddress(data.address || '');

    return {
      success: true,
      data: {
        nip: data.nip || nip,
        regon: data.regon,
        name: data.name,
        street: addressParts.street,
        streetNumber: addressParts.streetNumber,
        city: addressParts.city,
        postalCode: addressParts.postalCode,
        country: 'Polska',
        email: data.email,
        phone: data.phone,
        mainActivityCode: data.pkd,
        mainActivityName: data.pkd_name
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Błąd pobierania danych: ${error.message}`
    };
  }
}

/**
 * Parse Polish address string into components
 */
function parseAddress(address: string): {
  street: string;
  streetNumber: string;
  city: string;
  postalCode: string;
} {
  const result = {
    street: '',
    streetNumber: '',
    city: '',
    postalCode: ''
  };

  if (!address) return result;

  // Try to extract postal code (XX-XXX format)
  const postalMatch = address.match(/(\d{2}-\d{3})\s+(\w+)/);
  if (postalMatch) {
    result.postalCode = postalMatch[1];
    result.city = postalMatch[2];
  }

  // Try to extract street and number
  const streetMatch = address.match(/^(?:ul\.\s*)?([^,\d]+)\s*(\d+[A-Za-z]?(?:\/\d+)?)?/i);
  if (streetMatch) {
    result.street = streetMatch[1].trim();
    result.streetNumber = streetMatch[2] || '';
  }

  return result;
}

/**
 * Development/testing function - returns mock data
 */
export function getMockCompanyData(nip: string): GUSCompanyData {
  return {
    nip: normalizeNip(nip),
    regon: '123456789',
    name: 'Przykładowa Firma Sp. z o.o.',
    street: 'ul. Testowa',
    streetNumber: '123',
    apartmentNumber: '4A',
    city: 'Warszawa',
    postalCode: '00-001',
    voivodeship: 'mazowieckie',
    country: 'Polska',
    phone: '+48 22 123 45 67',
    email: 'kontakt@firma.pl',
    mainActivityCode: '62.01.Z',
    mainActivityName: 'Działalność związana z oprogramowaniem'
  };
}
