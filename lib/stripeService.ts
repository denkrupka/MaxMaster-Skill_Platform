/**
 * Stripe Integration Service
 *
 * This module handles Stripe payment integration for the subscription system.
 * Requires VITE_STRIPE_PUBLISHABLE_KEY environment variable.
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';

// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// Lazy-loaded Stripe instance
let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  if (!stripePromise && STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

// Subscription plan types
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  priceId: string; // Stripe Price ID
  pricePerUser: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

// Checkout session request
export interface CreateCheckoutSessionRequest {
  companyId: string;
  moduleCode: string;
  quantity: number; // Number of user seats
  successUrl: string;
  cancelUrl: string;
}

// Checkout session response
export interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string;
}

// Customer portal request
export interface CreatePortalSessionRequest {
  customerId: string;
  returnUrl: string;
}

// Subscription status
export type StripeSubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing';

// Payment method info
export interface PaymentMethodInfo {
  id: string;
  type: 'card' | 'bank_transfer' | 'other';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

// Invoice info
export interface InvoiceInfo {
  id: string;
  number: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: string;
  dueDate: string | null;
  pdfUrl: string | null;
  hostedInvoiceUrl: string | null;
}

/**
 * Create a Stripe Checkout session for subscription
 */
export const createCheckoutSession = async (
  request: CreateCheckoutSessionRequest
): Promise<CreateCheckoutSessionResponse> => {
  const response = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  return response.json();
};

/**
 * Redirect to Stripe Checkout
 */
export const redirectToCheckout = async (sessionId: string): Promise<void> => {
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error('Stripe not initialized. Check VITE_STRIPE_PUBLISHABLE_KEY.');
  }

  const { error } = await (stripe as any).redirectToCheckout({ sessionId });
  if (error) {
    throw new Error(error.message || 'Failed to redirect to checkout');
  }
};

/**
 * Create a Stripe Customer Portal session for managing subscriptions
 */
export const createPortalSession = async (
  request: CreatePortalSessionRequest
): Promise<{ url: string }> => {
  const response = await fetch('/api/stripe/create-portal-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create portal session');
  }

  return response.json();
};

/**
 * Get payment methods for a customer
 */
export const getPaymentMethods = async (customerId: string): Promise<PaymentMethodInfo[]> => {
  const response = await fetch(`/api/stripe/payment-methods?customerId=${customerId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get payment methods');
  }

  return response.json();
};

/**
 * Get invoices for a customer
 */
export const getInvoices = async (customerId: string, limit = 10): Promise<InvoiceInfo[]> => {
  const response = await fetch(`/api/stripe/invoices?customerId=${customerId}&limit=${limit}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get invoices');
  }

  return response.json();
};

/**
 * Check if Stripe is configured
 */
export const isStripeConfigured = (): boolean => {
  return !!STRIPE_PUBLISHABLE_KEY;
};

/**
 * Format currency amount for display
 */
export const formatCurrency = (amount: number, currency = 'PLN'): string => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
  }).format(amount / 100); // Stripe uses cents
};

/**
 * Get card brand display name
 */
export const getCardBrandName = (brand: string): string => {
  const brands: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };
  return brands[brand.toLowerCase()] || brand;
};
