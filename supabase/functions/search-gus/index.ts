import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// DataPort.pl API for Polish company lookup by NIP
// API documentation: https://dataport.pl/api
const DATAPORT_API_KEY = Deno.env.get('DATAPORT_API_KEY') || 'ADrz3Fp537DmDwNAANiX72KJmHlqMX8JdGxojXtsgBHRy4zAzmYZeCqMQiF0Ur7d'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { nip } = await req.json()

    if (!nip) {
      throw new Error('NIP jest wymagany')
    }

    // Clean and validate NIP (Polish tax identification number)
    const cleanNip = nip.replace(/[\s-]/g, '')

    if (!/^\d{10}$/.test(cleanNip)) {
      throw new Error('Nieprawidłowy format NIP. NIP musi składać się z 10 cyfr.')
    }

    // Validate NIP checksum
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanNip[i]) * weights[i]
    }
    const checkDigit = sum % 11
    if (checkDigit === 10 || checkDigit !== parseInt(cleanNip[9])) {
      throw new Error('Nieprawidłowy NIP - błędna suma kontrolna')
    }

    console.log('Searching DataPort.pl for NIP:', cleanNip)

    // Call DataPort.pl API
    const response = await fetch(`https://dataport.pl/api/v1/company/${cleanNip}?format=full`, {
      method: 'GET',
      headers: {
        'X-API-Key': DATAPORT_API_KEY,
        'Accept': 'application/json'
      }
    })

    console.log('DataPort.pl response status:', response.status)

    if (response.status === 404) {
      // Company not found in GUS
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Firma o podanym NIP nie została znaleziona w rejestrze GUS',
          data: { found: false }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    if (response.status === 401) {
      throw new Error('Błąd autoryzacji API DataPort.pl - nieprawidłowy klucz API')
    }

    if (response.status === 429) {
      throw new Error('Przekroczono dzienny limit zapytań API. Spróbuj ponownie jutro.')
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('DataPort.pl error:', errorText)
      throw new Error(`Błąd API DataPort.pl: ${response.status}`)
    }

    const data = await response.json()
    console.log('DataPort.pl data received:', JSON.stringify(data).substring(0, 500))

    // Map DataPort.pl response to our format with Polish field names for frontend compatibility
    const companyData = {
      // Polish field names for frontend
      nazwa: data.nazwa || data.nazwa_pelna || '',
      ulica: data.ulica || '',
      nrNieruchomosci: data.nrNieruchomosci || data.nr_nieruchomosci || '',
      nrLokalu: data.nrLokalu || data.nr_lokalu || '',
      kodPocztowy: data.kodPocztowy || data.kod_pocztowy || '',
      miejscowosc: data.miejscowosc || '',
      regon: data.regon || '',
      nip: cleanNip,
      // Additional data
      krs: data.krs || '',
      formaPrawna: data.formaPrawna || data.forma_prawna || '',
      dataRozpoczeciaDzialalnosci: data.dataRozpoczeciaDzialalnosci || data.data_rozpoczecia || '',
      pkdGlowny: data.pkdGlowny || data.pkd_glowny || '',
      email: data.email || '',
      telefon: data.telefon || '',
      www: data.www || '',
      found: true
    }

    console.log('Returning company data:', companyData)

    return new Response(
      JSON.stringify({
        success: true,
        data: companyData,
        source: 'DataPort.pl'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('DataPort search error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        data: { found: false }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
