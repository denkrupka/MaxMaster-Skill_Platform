/**
 * Email Service
 *
 * Wrapper for sending emails via Edge Function
 */

import { supabase } from './supabase';

export type EmailTemplate =
  | 'MODULE_ACTIVATED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SKILL_CONFIRMED'
  | 'TRIAL_ENDING'
  | 'USER_INVITATION'
  | 'GENERIC';

interface SendEmailParams {
  template: EmailTemplate;
  to: string | string[];
  data?: Record<string, any>;
  subject?: string; // Override default subject
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email using the send-email Edge Function
 */
export const sendEmail = async (params: SendEmailParams): Promise<SendEmailResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: params
    });

    if (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Email service error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
};

/**
 * Send module activation email
 */
export const sendModuleActivatedEmail = async (
  to: string,
  data: {
    userName: string;
    moduleName: string;
    companyName: string;
    seats: number;
    price: number;
    dashboardUrl: string;
  }
) => {
  return sendEmail({
    template: 'MODULE_ACTIVATED',
    to,
    data
  });
};

/**
 * Send payment success email
 */
export const sendPaymentSuccessEmail = async (
  to: string,
  data: {
    userName: string;
    invoiceNumber: string;
    amount: number;
    date: string;
    invoiceUrl?: string;
  }
) => {
  return sendEmail({
    template: 'PAYMENT_SUCCESS',
    to,
    data
  });
};

/**
 * Send payment failed email
 */
export const sendPaymentFailedEmail = async (
  to: string,
  data: {
    userName: string;
    amount: number;
    portalUrl: string;
  }
) => {
  return sendEmail({
    template: 'PAYMENT_FAILED',
    to,
    data
  });
};

/**
 * Send skill confirmed email
 */
export const sendSkillConfirmedEmail = async (
  to: string,
  data: {
    userName: string;
    skillName: string;
    salaryBonus: number;
    dashboardUrl: string;
  }
) => {
  return sendEmail({
    template: 'SKILL_CONFIRMED',
    to,
    data
  });
};

/**
 * Send trial ending reminder email
 */
export const sendTrialEndingEmail = async (
  to: string,
  data: {
    userName: string;
    companyName: string;
    daysLeft: number;
    endDate: string;
    dashboardUrl: string;
  }
) => {
  return sendEmail({
    template: 'TRIAL_ENDING',
    to,
    data
  });
};

/**
 * Send user invitation email
 */
export const sendUserInvitationEmail = async (
  to: string,
  data: {
    userName: string;
    companyName: string;
    roleName: string;
    email: string;
    inviteUrl: string;
  }
) => {
  return sendEmail({
    template: 'USER_INVITATION',
    to,
    data
  });
};

/**
 * Send generic notification email
 */
export const sendGenericEmail = async (
  to: string | string[],
  data: {
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
  },
  customSubject?: string
) => {
  return sendEmail({
    template: 'GENERIC',
    to,
    data,
    subject: customSubject
  });
};
