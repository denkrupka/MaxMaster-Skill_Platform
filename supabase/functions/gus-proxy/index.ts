// Supabase Edge Function - GUS API Proxy
// This function proxies requests to GUS/rejestr.io API to avoid CORS issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GUSCompanyData {
  nip: string
  regon?: string
  name: string
  street: string
  streetNumber: string
  apartmentNumber?: string
  city: string
  postalCode: string
  country: string
  phone?: string
  email?: string
  mainActivityCode?: string
  mainActivityName?: string
}

// Normalize NIP - remove dashes and spaces
function normalizeNip(nip: string): string {
  return nip.replace(/[\s-]/g, '')
}

// Validate NIP format (10 digits with checksum)
function validateNip(nip: string): boolean {
  const normalizedNip = normalizeNip(nip)

  if (!/^\d{10}$/.test(normalizedNip)) {
    return false
  }

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  let sum = 0

  for (let i = 0; i < 9; i++) {
    sum += parseInt(normalizedNip[i]) * weights[i]
  }

  const checkDigit = sum % 11
  return checkDigit === parseInt(normalizedNip[9])
}

// Parse Polish address string into components
function parseAddress(address: string): {
  street: string
  streetNumber: string
  city: string
  postalCode: string
} {
  const result = {
    street: '',
    streetNumber: '',
    city: '',
    postalCode: ''
  }

  if (!address) return result

  // Try to extract postal code (XX-XXX format)
  const postalMatch = address.match(/(\d{2}-\d{3})\s+(\S+)/)
  if (postalMatch) {
    result.postalCode = postalMatch[1]
    result.city = postalMatch[2]
  }

  // Try to extract street and number
  const streetMatch = address.match(/^(?:ul\.\s*)?([^,\d]+)\s*(\d+[A-Za-z]?(?:\/\d+)?)?/i)
  if (streetMatch) {
    result.street = streetMatch[1].trim()
    result.streetNumber = streetMatch[2] || ''
  }

  return result
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { nip } = await req.json()

    if (!nip) {
      return new Response(
        JSON.stringify({ success: false, error: 'NIP jest wymagany' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const normalizedNip = normalizeNip(nip)

    if (!validateNip(normalizedNip)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nieprawidłowy format NIP' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Try multiple APIs

    // 1. Try rejestr.io (free, may have rate limits)
    try {
      const rejestrResponse = await fetch(`https://rejestr.io/api/v2/org?nip=${normalizedNip}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MaxMaster-Platform/1.0'
        }
      })

      if (rejestrResponse.ok) {
        const data = await rejestrResponse.json()

        if (data && data.name) {
          const addressParts = parseAddress(data.address || '')

          const result: GUSCompanyData = {
            nip: data.nip || normalizedNip,
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

          return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    } catch (e) {
      console.error('rejestr.io error:', e)
    }

    // 2. Try KRS Online API
    try {
      const krsResponse = await fetch(`https://api-krs.ms.gov.pl/api/krs/OdsijS/${normalizedNip}`, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (krsResponse.ok) {
        const data = await krsResponse.json()

        if (data && data.odppisDzialalnosciGospodarczej) {
          const firma = data.odppisDzialalnosciGospodarczej.danePodmiotu || {}
          const adres = firma.adres || {}

          const result: GUSCompanyData = {
            nip: normalizedNip,
            regon: firma.regon,
            name: firma.nazwa || firma.firmaCeidg,
            street: adres.ulica || '',
            streetNumber: adres.nrDomu || '',
            city: adres.miejscowosc || '',
            postalCode: adres.kodPocztowy || '',
            country: 'Polska'
          }

          return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    } catch (e) {
      console.error('KRS API error:', e)
    }

    // 3. Try dane.gov.pl CEIDG API
    try {
      const ceidgResponse = await fetch(
        `https://dane.biznes.gov.pl/api/ceidg/v2/firma?nip=${normalizedNip}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      )

      if (ceidgResponse.ok) {
        const data = await ceidgResponse.json()

        if (data && data.firma && data.firma.length > 0) {
          const firma = data.firma[0]
          const adres = firma.adresDzialalnosci || firma.adresKorespondencyjny || {}

          const result: GUSCompanyData = {
            nip: normalizedNip,
            regon: firma.regon,
            name: firma.nazwa,
            street: adres.ulica || '',
            streetNumber: adres.budynek || '',
            city: adres.miasto || '',
            postalCode: adres.kod || '',
            country: 'Polska',
            email: firma.email,
            phone: firma.telefon
          }

          return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    } catch (e) {
      console.error('CEIDG API error:', e)
    }

    // No data found
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Nie udało się pobrać danych z GUS. Wprowadź dane ręcznie.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('GUS proxy error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Błąd serwera. Wprowadź dane ręcznie.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
