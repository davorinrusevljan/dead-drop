import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Stripe from 'stripe';
import {
  createStripeClient,
  createCheckoutSession,
  verifyWebhookSignature,
  getDropIdFromSession,
  processCheckoutComplete,
} from './payments';

// Mock Stripe
vi.mock('stripe');

describe('Payments Service', () => {
  let mockStripe: {
    checkout: {
      sessions: {
        create: ReturnType<typeof vi.fn>;
      };
    };
    webhooks: {
      constructEvent: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockStripe = {
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    };

    vi.mocked(Stripe).mockReturnValue(mockStripe as unknown as Stripe);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createStripeClient', () => {
    it('should create Stripe client with correct API version', () => {
      const secretKey = 'sk_test_123';
      createStripeClient(secretKey);

      expect(Stripe).toHaveBeenCalledWith(secretKey, {
        apiVersion: '2025-02-24.acacia',
      });
    });

    it('should return Stripe instance', () => {
      const client = createStripeClient('sk_test_123');
      expect(client).toBe(mockStripe);
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session with correct parameters', async () => {
      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test',
      };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const result = await createCheckoutSession(mockStripe as unknown as Stripe, {
        dropId: 'drop-123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: 100,
              product_data: {
                name: 'Deep Drop Upgrade',
                description: 'Upgrade to Deep Drop: 4MB max, 90-day lifespan, file uploads',
              },
            },
            quantity: 1,
          },
        ],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        metadata: {
          dropId: 'drop-123',
        },
      });

      expect(result).toEqual({
        checkoutUrl: 'https://checkout.stripe.com/test',
        sessionId: 'cs_test_123',
      });
    });

    it('should throw error if session URL is null', async () => {
      const mockSession = {
        id: 'cs_test_123',
        url: null,
      };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      await expect(
        createCheckoutSession(mockStripe as unknown as Stripe, {
          dropId: 'drop-123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('Failed to create checkout session');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should call constructEvent with correct parameters', () => {
      const payload = '{"test": "data"}';
      const signature = 'sig_123';
      const secret = 'whsec_123';
      const mockEvent = { type: 'checkout.session.completed' };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = verifyWebhookSignature(
        mockStripe as unknown as Stripe,
        payload,
        signature,
        secret
      );

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(payload, signature, secret);
      expect(result).toEqual(mockEvent);
    });

    it('should work with Buffer payload', () => {
      const payload = Buffer.from('{"test": "data"}');
      const signature = 'sig_123';
      const secret = 'whsec_123';
      const mockEvent = { type: 'checkout.session.completed' };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = verifyWebhookSignature(
        mockStripe as unknown as Stripe,
        payload,
        signature,
        secret
      );

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(payload, signature, secret);
      expect(result).toEqual(mockEvent);
    });
  });

  describe('getDropIdFromSession', () => {
    it('should extract drop ID from metadata', () => {
      const session = {
        metadata: { dropId: 'drop-456' },
      } as unknown as Stripe.Checkout.Session;

      expect(getDropIdFromSession(session)).toBe('drop-456');
    });

    it('should return null if metadata is missing', () => {
      const session = {} as unknown as Stripe.Checkout.Session;
      expect(getDropIdFromSession(session)).toBeNull();
    });

    it('should return null if dropId is not in metadata', () => {
      const session = {
        metadata: { otherField: 'value' },
      } as unknown as Stripe.Checkout.Session;

      expect(getDropIdFromSession(session)).toBeNull();
    });
  });

  describe('processCheckoutComplete', () => {
    it('should return payment result for paid session', () => {
      const session = {
        metadata: { dropId: 'drop-789' },
        payment_intent: 'pi_123',
        payment_status: 'paid',
      } as unknown as Stripe.Checkout.Session;

      const result = processCheckoutComplete(session);

      expect(result).toEqual({
        dropId: 'drop-789',
        paymentIntentId: 'pi_123',
        status: 'succeeded',
      });
    });

    it('should return failed status for unpaid session', () => {
      const session = {
        metadata: { dropId: 'drop-789' },
        payment_intent: 'pi_123',
        payment_status: 'unpaid',
      } as unknown as Stripe.Checkout.Session;

      const result = processCheckoutComplete(session);

      expect(result).toEqual({
        dropId: 'drop-789',
        paymentIntentId: 'pi_123',
        status: 'failed',
      });
    });

    it('should return null if dropId is missing', () => {
      const session = {
        metadata: {},
        payment_intent: 'pi_123',
        payment_status: 'paid',
      } as unknown as Stripe.Checkout.Session;

      expect(processCheckoutComplete(session)).toBeNull();
    });

    it('should return null if metadata is missing', () => {
      const session = {
        payment_intent: 'pi_123',
        payment_status: 'paid',
      } as unknown as Stripe.Checkout.Session;

      expect(processCheckoutComplete(session)).toBeNull();
    });
  });
});
