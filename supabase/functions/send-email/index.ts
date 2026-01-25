import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Email templates
const EMAIL_TEMPLATES: Record<string, { subject: string; html: (data: any) => string }> = {
  // Module activation
  MODULE_ACTIVATED: {
    subject: 'Moduł został aktywowany - MaxMaster',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">MaxMaster</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Moduł ${data.moduleName} został aktywowany!</h2>
          <p style="color: #475569;">Witaj ${data.userName},</p>
          <p style="color: #475569;">Informujemy, że moduł <strong>${data.moduleName}</strong> został pomyślnie aktywowany dla firmy <strong>${data.companyName}</strong>.</p>
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #64748b;"><strong>Liczba miejsc:</strong> ${data.seats}</p>
            <p style="margin: 10px 0 0; color: #64748b;"><strong>Cena miesięczna:</strong> ${data.price} PLN</p>
          </div>
          <a href="${data.dashboardUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Przejdź do panelu</a>
        </div>
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>Ten email został wysłany automatycznie. Prosimy nie odpowiadać.</p>
        </div>
      </div>
    `
  },

  // Payment success
  PAYMENT_SUCCESS: {
    subject: 'Płatność zrealizowana - MaxMaster',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">MaxMaster</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Dziękujemy za płatność!</h2>
          <p style="color: #475569;">Witaj ${data.userName},</p>
          <p style="color: #475569;">Potwierdzamy otrzymanie płatności.</p>
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #64748b;"><strong>Numer faktury:</strong> ${data.invoiceNumber}</p>
            <p style="margin: 10px 0 0; color: #64748b;"><strong>Kwota:</strong> ${data.amount} PLN</p>
            <p style="margin: 10px 0 0; color: #64748b;"><strong>Data:</strong> ${data.date}</p>
          </div>
          ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 10px;">Pobierz fakturę</a>` : ''}
        </div>
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>Ten email został wysłany automatycznie. Prosimy nie odpowiadać.</p>
        </div>
      </div>
    `
  },

  // Payment failed
  PAYMENT_FAILED: {
    subject: 'Problem z płatnością - MaxMaster',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">MaxMaster</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Problem z płatnością</h2>
          <p style="color: #475569;">Witaj ${data.userName},</p>
          <p style="color: #475569;">Niestety, nie udało się przetworzyć płatności za Twoją subskrypcję.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b;"><strong>Kwota:</strong> ${data.amount} PLN</p>
            <p style="margin: 10px 0 0; color: #991b1b;">Prosimy o aktualizację metody płatności, aby uniknąć przerwy w dostępie do usług.</p>
          </div>
          <a href="${data.portalUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Zaktualizuj płatność</a>
        </div>
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>Ten email został wysłany automatycznie. Prosimy nie odpowiadać.</p>
        </div>
      </div>
    `
  },

  // Skill confirmed
  SKILL_CONFIRMED: {
    subject: 'Umiejętność potwierdzona - MaxMaster',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">MaxMaster</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Gratulacje! 🎉</h2>
          <p style="color: #475569;">Witaj ${data.userName},</p>
          <p style="color: #475569;">Twoja umiejętność <strong>${data.skillName}</strong> została potwierdzona!</p>
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; color: #065f46; font-size: 18px; font-weight: bold;">+${data.salaryBonus} PLN/h</p>
            <p style="margin: 5px 0 0; color: #047857; font-size: 14px;">Dodatek do stawki godzinowej</p>
          </div>
          <p style="color: #475569;">Nowa stawka zacznie obowiązywać od następnego okresu rozliczeniowego.</p>
          <a href="${data.dashboardUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Zobacz swoje umiejętności</a>
        </div>
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>Ten email został wysłany automatycznie. Prosimy nie odpowiadać.</p>
        </div>
      </div>
    `
  },

  // Trial ending soon
  TRIAL_ENDING: {
    subject: 'Twój okres próbny kończy się - MaxMaster',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">MaxMaster</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Okres próbny kończy się za ${data.daysLeft} dni</h2>
          <p style="color: #475569;">Witaj ${data.userName},</p>
          <p style="color: #475569;">Przypominamy, że Twój okres próbny w firmie <strong>${data.companyName}</strong> kończy się <strong>${data.endDate}</strong>.</p>
          <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">Upewnij się, że masz ukończone wszystkie wymagane testy i szkolenia.</p>
          </div>
          <a href="${data.dashboardUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Sprawdź postępy</a>
        </div>
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>Ten email został wysłany automatycznie. Prosimy nie odpowiadać.</p>
        </div>
      </div>
    `
  },

  // New user invitation
  USER_INVITATION: {
    subject: 'Zaproszenie do MaxMaster',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">MaxMaster</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Witaj w MaxMaster!</h2>
          <p style="color: #475569;">Cześć ${data.userName},</p>
          <p style="color: #475569;">Zostałeś/aś zaproszony/a do dołączenia do firmy <strong>${data.companyName}</strong> w systemie MaxMaster.</p>
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #64748b;"><strong>Rola:</strong> ${data.roleName}</p>
            <p style="margin: 10px 0 0; color: #64748b;"><strong>Email:</strong> ${data.email}</p>
          </div>
          <a href="${data.inviteUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Aktywuj konto</a>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Link jest ważny przez 7 dni.</p>
        </div>
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>Ten email został wysłany automatycznie. Prosimy nie odpowiadać.</p>
        </div>
      </div>
    `
  },

  // Generic notification
  GENERIC: {
    subject: 'Powiadomienie - MaxMaster',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">MaxMaster</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">${data.title}</h2>
          <p style="color: #475569;">${data.message}</p>
          ${data.actionUrl ? `<a href="${data.actionUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">${data.actionText || 'Przejdź'}</a>` : ''}
        </div>
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p>Ten email został wysłany automatycznie. Prosimy nie odpowiadać.</p>
        </div>
      </div>
    `
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'MaxMaster <noreply@maxmaster.pl>'

    if (!RESEND_API_KEY) {
      throw new Error('Email service not configured. Set RESEND_API_KEY in environment.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const body = await req.json()
    const { template, to, data, subject: customSubject } = body

    console.log('Sending email:', { template, to })

    if (!to || !template) {
      throw new Error('Missing required fields: to, template')
    }

    // Get template
    const emailTemplate = EMAIL_TEMPLATES[template] || EMAIL_TEMPLATES.GENERIC
    const subject = customSubject || emailTemplate.subject
    const html = emailTemplate.html(data || {})

    // Send via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Resend error:', errorData)
      throw new Error(errorData.message || 'Failed to send email')
    }

    const result = await response.json()

    // Log email sent
    await supabaseAdmin.from('email_logs').insert({
      recipient: Array.isArray(to) ? to.join(', ') : to,
      template,
      subject,
      status: 'sent',
      provider_id: result.id
    }).catch(err => console.error('Failed to log email:', err))

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Email error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
