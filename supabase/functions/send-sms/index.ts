// Supabase Edge Function for sending SMS via SMSAPI.pl
// This keeps the API token secure on the server side

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SMSAPI_TOKEN = Deno.env.get('SMSAPI_TOKEN');
const SMSAPI_SENDER_NAME = Deno.env.get('SMSAPI_SENDER_NAME') || 'MAXMASTER';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  phoneNumber: string;
  message: string;
  userId?: string;
  templateCode?: string;
}

interface SMSAPIResponse {
  count: number;
  list: Array<{
    id: string;
    points: number;
    number: string;
    date_sent: number;
    submitted_number: string;
    status: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phoneNumber, message, userId, templateCode }: SMSRequest = await req.json();

    if (!phoneNumber || !message) {
      return new Response(
        JSON.stringify({ error: 'phoneNumber and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SMSAPI_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'SMSAPI_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number (remove spaces, dashes, +)
    const normalizedPhone = phoneNumber.replace(/[\s\-+]/g, '');

    // Ensure phone starts with country code (default to Poland 48)
    const finalPhone = normalizedPhone.startsWith('48') ? normalizedPhone : `48${normalizedPhone}`;

    // Create Supabase client for logging
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create initial log entry
    const { data: logEntry, error: logError } = await supabase
      .from('sms_logs')
      .insert({
        user_id: userId || null,
        phone_number: finalPhone,
        message: message,
        template_code: templateCode || null,
        status: 'pending',
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create SMS log:', logError);
    }

    // Send SMS via SMSAPI.pl API v2
    const smsApiUrl = 'https://api.smsapi.pl/sms.do';
    const params = new URLSearchParams({
      to: finalPhone,
      message: message,
      from: SMSAPI_SENDER_NAME,
      format: 'json',
      encoding: 'utf-8',
    });

    const smsResponse = await fetch(`${smsApiUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SMSAPI_TOKEN}`,
      },
    });

    const responseText = await smsResponse.text();
    let smsData: SMSAPIResponse | null = null;

    try {
      smsData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse SMSAPI response:', responseText);
    }

    if (!smsResponse.ok || !smsData || smsData.count === 0) {
      // Update log with failure
      if (logEntry) {
        await supabase
          .from('sms_logs')
          .update({
            status: 'failed',
            error_message: responseText,
          })
          .eq('id', logEntry.id);
      }

      return new Response(
        JSON.stringify({
          error: 'Failed to send SMS',
          details: responseText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SMS sent successfully
    const smsId = smsData.list[0]?.id;

    // Update log with success
    if (logEntry) {
      await supabase
        .from('sms_logs')
        .update({
          status: 'sent',
          sms_id: smsId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        smsId: smsId,
        phoneNumber: finalPhone,
        message: message,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-sms function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
