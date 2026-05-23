import express from 'express';
import mongoose from 'mongoose';
import verifyuser from '../Middleware/VerifyUser.js';
import OrderSchema from '../Models/OrderSchema.js';
import Address from '../Models/AddressSchema.js';
import User from '../Models/UserSchema.js';
import Stripe from 'stripe';
import { useUserCoupon } from '../Controllers/WalletController.js';

const router = express.Router();

// Helper function to get Stripe instance
const getStripe = () => {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }

  if (!stripeKey.startsWith('sk_test_') && !stripeKey.startsWith('sk_live_')) {
    throw new Error('Invalid STRIPE_SECRET_KEY format. Must start with sk_test_ or sk_live_');
  }

  return new Stripe(stripeKey);
};

// POST /api/payment/create-intent
// Create a payment intent for Stripe
router.post('/create-intent', verifyuser, async (req, res) => {
  try {
    const { amount, currency = 'pkr', cardType } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    // Convert amount to cents for Stripe (Stripe expects amounts in smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    // Create payment intent with Stripe
    const stripe = getStripe();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      payment_method_types: ['card'],
      metadata: {
        cardType: cardType || 'card',
        userId: req.id
      }
    });


    res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        cardType: cardType || 'card'
      },
      clientSecret: paymentIntent.client_secret,
      message: 'Payment intent created successfully'
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    console.error('Error type:', error.type);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    // Handle specific Stripe errors
    if (error.type === 'StripeConnectionError') {
      return res.status(500).json({
        success: false,
        message: 'Stripe connection failed. Please try again.',
        error: 'Connection error'
      });
    }

    if (error.type === 'StripeAuthenticationError') {
      return res.status(500).json({
        success: false,
        message: 'Stripe authentication failed. Check API key.',
        error: 'Authentication error'
      });
    }

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment request parameters.',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
});

// POST /api/payment/confirm
// Confirm a payment with Stripe
router.post('/confirm', verifyuser, async (req, res) => {
  try {
    const { paymentIntentId, paymentMethodId } = req.body;

    // Validate required fields
    if (!paymentIntentId || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID and payment method ID are required'
      });
    }

    // Confirm the payment intent with Stripe
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    res.status(200).json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentMethodId: paymentMethodId
      },
      message: 'Payment confirmed successfully'
    });

  } catch (error) {
    console.error('Error confirming payment:', error);

    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: {
          type: error.type,
          code: error.code,
          decline_code: error.decline_code
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error.message
    });
  }
});

// POST /api/orders/card-payment
// Process card payment for orders
router.post('/card-payment', verifyuser, async (req, res) => {
  try {
    const orderData = req.body;
    const userId = req.id; // From verifyuser middleware

    const customer = await User.findById(userId).select("_id");
    if (!customer) {
      return res.status(403).json({
        success: false,
        message: "Please login with a customer account to place orders.",
      });
    }

    // Validate required fields
    if (!orderData.items || !orderData.payment || !orderData.paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Order items, payment info, and payment intent ID are required'
      });
    }

    // Verify the payment intent was successful
    let paymentIntent;

    // Handle mock payment intents for development
    if (orderData.paymentIntentId.startsWith('pi_mock_')) {
      // Mock payment intent - assume success for development
      paymentIntent = {
        status: 'succeeded',
        amount: 1000, // Mock amount
        id: orderData.paymentIntentId
      };
    } else {
      // Real Stripe payment intent
      const stripe = getStripe();
      paymentIntent = await stripe.paymentIntents.retrieve(orderData.paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: 'Payment was not successful',
          paymentStatus: paymentIntent.status
        });
      }
    }

    // Calculate total amount
    const totalAmount = orderData.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);


    let shippingAddress = null;
    if (orderData.addressId) {
      const addr = await Address.findOne({ _id: orderData.addressId, userId });
      if (addr) {
        shippingAddress = {
          addressId: addr._id,
          fullName: addr.fullName,
          phone: addr.phone,
          line1: addr.line1,
          line2: addr.line2 || "",
          city: addr.city,
          state: addr.state,
          postalCode: addr.postalCode,
          country: addr.country,
          label: addr.label,
        };
      }
    }

    // Create a proper order in the database
    const orderDataToSave = {
      userId: userId,
      items: orderData.items,
      address: shippingAddress,
      subtotal: orderData.subtotal,
      discount: orderData.discount || 0,
      total: orderData.total,
      coupon: orderData.coupon,
      payment: {
        method: 'card',
        status: 'pending'
      },
      status: 'pending',
      paymentIntentId: orderData.paymentIntentId,
      stripePaymentId: paymentIntent.id
    };


    let savedOrder;
    if (OrderSchema) {
      const newOrder = new OrderSchema(orderDataToSave);
      savedOrder = await newOrder.save();

      // Populate the saved order with product details for response
      await savedOrder.populate('items.productId', 'pname pimage1');
      await savedOrder.populate('items.sellerId', 'name');


      // Mark coupon as used if one was applied
      if (orderData.coupon && orderData.coupon.code) {
        try {
          await useUserCoupon(userId, orderData.coupon.code, savedOrder._id);
        } catch (couponError) {
          console.error('Error marking coupon as used:', couponError);
          // Don't fail the order if coupon marking fails, just log it
        }
      }
    } else {
      console.error('OrderSchema not available');
      return res.status(500).json({
        success: false,
        message: 'Order schema not available'
      });
    }

    res.status(200).json({
      success: true,
      order: savedOrder,
      message: 'Order placed successfully with card payment'
    });

  } catch (error) {
    console.error('Error processing card payment:', error);
    console.error('Error details:', error.stack);

    // Handle Stripe-specific errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: {
          type: error.type,
          code: error.code,
          decline_code: error.decline_code
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process card payment',
      error: error.message
    });
  }
});

export default router;
