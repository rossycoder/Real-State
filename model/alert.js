const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
  },
  propertyType: {
    type: String,
    required: true,
    enum: ['Villa', 'Penthouse', 'Mansion']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Alert', alertSchema);