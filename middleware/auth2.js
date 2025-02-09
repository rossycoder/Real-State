const Joi = require('joi');
const Property = require('../model/properties');

// Middleware to ensure the user is logged in
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    // Save the URL the user is trying to access
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  next();
};

// Middleware to check if the logged-in user is the owner of the property
module.exports.isOwner = async (req, res, next) => {
  const property = await Property.findById(req.params.id);
  if (!property) {
    return res.status(404).send('Property not found');
  }
  if (!property.owner.equals(req.user._id)) {
    return res.redirect('/property');
  }
  next();
};

// Joi Validation Schema for Property
// Updated Joi schema with owner field
const propertyValidationSchema = Joi.object({
  title: Joi.string().required().messages({
    'string.empty': 'Title is required',
  }),
  price: Joi.number().required().messages({
    'number.base': 'Price must be a number',
    'any.required': 'Price is required',
  }),
  description: Joi.string().optional(),
  location: Joi.string().optional(),
  bedrooms: Joi.number().optional(),
  bathrooms: Joi.number().optional(),
  sqft: Joi.number().optional(),
  category: Joi.string().valid('Villa', 'Apartment', 'Mansion').required(),
  owner: Joi.string().hex().length(24).required().messages({ // Add owner field
    'string.hex': 'Invalid owner ID format',
    'string.length': 'Owner ID must be 24 characters'
  }), // Explicitly handle owner field
  images: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      public_id: Joi.string().required(),
    })
  ).optional(),
  reviews: Joi.array().items(Joi.string().hex().length(24)).optional(),
}).options({ allowUnknown: false });

// Middleware for Joi Validation
async function validateProperty(req, res, next) {
  const { error } = propertyValidationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
}

module.exports.validateProperty = validateProperty;
