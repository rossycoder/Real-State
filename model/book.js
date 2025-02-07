// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  propertyId: { type: String, required: true },
  checkin: { type: Date, required: true },
  checkout: { type: Date, required: true },
  guests: { type: Number, required: true },
  amount: { type: Number, required: true }, // stored in cents
  stripeSessionId: { type: String, required: true },
  paymentStatus: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
