/**
 * Stripe Payment Service
 * Handles checkout sessions and webhook processing
 */

import Stripe from 'stripe';

/**
 * Initialize Stripe client
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
  });
}

/**
 * Create a checkout session for Deep Drop upgrade
 */
export async function createCheckoutSession(
  stripe: Stripe,
  options: {
    dropId: string;
    successUrl: string;
    cancelUrl: string;
  }
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: 100, // $1.00
          product_data: {
            name: 'Deep Drop Upgrade',
            description: 'Upgrade to Deep Drop: 4MB max, 90-day lifespan, file uploads',
          },
        },
        quantity: 1,
      },
    ],
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: {
      dropId: options.dropId,
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  stripe: Stripe,
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

/**
 * Extract drop ID from checkout session
 */
export function getDropIdFromSession(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.dropId ?? null;
}

/**
 * Payment result from webhook
 */
export interface PaymentResult {
  dropId: string;
  paymentIntentId: string;
  status: 'succeeded' | 'failed';
}

/**
 * Process checkout session completed event
 */
export function processCheckoutComplete(session: Stripe.Checkout.Session): PaymentResult | null {
  const dropId = getDropIdFromSession(session);
  if (!dropId) return null;

  return {
    dropId,
    paymentIntentId: session.payment_intent as string,
    status: session.payment_status === 'paid' ? 'succeeded' : 'failed',
  };
}
