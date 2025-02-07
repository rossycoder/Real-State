// routes/bookings.js
require('dotenv').config(); // Ensure environment variables are loaded

const express = require('express');
const router = express.Router();
const Booking = require('../model/book');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Debug log to verify the key is loaded (remove in production)
console.log('Stripe Secret Key:', process.env.STRIPE_SECRET_KEY);

// Endpoint to create a Stripe Checkout Session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { propertyId, checkin, checkout, guests, amount } = req.body;
    
    // Create a Checkout Session with Stripe
   // Create a Checkout Session with Stripe
const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Booking Payment for Property ' + propertyId,
        },
        unit_amount: amount, // amount in cents
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${req.headers.origin}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.origin}/booking-cancelled`,
    metadata: { propertyId, checkin, checkout, guests, amount } // Added amount here if needed
  });
  
    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.sendStatus(400);
    }
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('Payment was successful!', session);
      
      // Extract booking details. Use session.amount_total for the final amount in cents.
      const bookingData = {
        propertyId: session.metadata.propertyId,
        checkin: session.metadata.checkin,
        checkout: session.metadata.checkout,
        guests: session.metadata.guests,
        // You can use either metadata.amount or session.amount_total
        amount: session.amount_total,
        stripeSessionId: session.id,
        paymentStatus: session.payment_status,
      };
      
      try {
        const booking = await Booking.create(bookingData);
        console.log('Booking saved successfully:', booking);
      } catch (dbError) {
        console.error('Error saving booking:', dbError);
      }
    }
    
    res.sendStatus(200);
  });
module.exports = router;
