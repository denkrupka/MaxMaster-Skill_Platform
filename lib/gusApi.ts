/**
 * GUS API Integration
 * Fetching company data from Polish GUS (BIR) by NIP
 *
 * This module uses Supabase Edge Function as proxy to avoid CORS issues.
 */

import { SUPABASE_ANON_KEY } from './supabase';

// Supabase project URL
const SUPABASE_URL = 'https://diytvuczpciikzdhldny.supabase.co';

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
 * Fetch company data from GUS via Supabase Edge Function (to avoid CORS)
 *
 * @param nip - Company NIP (tax identification number)
 * @returns Company data or error
 */
export async function fetchCompanyByNip(nip: string): Promise<GUSApiResponse> {
  const normalizedNip = normalizeNip(nip);

  // Validate NIP format
  if (!validateNip(normalizedNip)) {
    return {
      success: false,
      error: 'Nieprawidłowy format NIP'
    };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/gus-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ nip: normalizedNip })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || 'Nie udało się pobrać danych z GUS'
      };
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('GUS proxy error:', error);
    return {
      success: false,
      error: 'Nie udało się pobrać danych z GUS. Wprowadź dane ręcznie.'
    };
  }
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
