// models/properties.js
const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  location: String,
  bedrooms: Number,
  bathrooms: Number,
  sqft: Number,
  category: { 
    type: String, 
    required: true, 
    enum: ['Villa', 'Apartment', 'Mansion'] 
  },
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: [true, 'Property must have an owner'],
    validate: {
      validator: async function(v) {
        const user = await mongoose.model('User').findById(v);
        return user !== null;
      },
      message: 'Invalid owner reference'
    }
  },
  images: [{
    url: String,
    public_id: String
  }],
  reviews: [{    // Updated field name and ref
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Property', propertySchema);
