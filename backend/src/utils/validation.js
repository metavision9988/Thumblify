const Joi = require('joi');

// User validation schemas
const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only letters and numbers',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must be less than 30 characters long',
      'any.required': 'Username is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    })
});

const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

// Capture validation schemas
const captureUrlSchema = Joi.object({
  url: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': 'Please provide a valid URL',
      'any.required': 'URL is required'
    }),
  options: Joi.object({
    format: Joi.string()
      .valid('png', 'jpg', 'jpeg', 'webp')
      .default('png'),
    width: Joi.number()
      .integer()
      .min(100)
      .max(3840)
      .default(1200),
    height: Joi.number()
      .integer()
      .min(100)
      .max(2160)
      .default(800),
    quality: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(90),
    fullPage: Joi.boolean()
      .default(false),
    device: Joi.string()
      .valid('desktop', 'mobile', 'tablet')
      .default('desktop')
  }).default({
    format: 'png',
    width: 1200,
    height: 800,
    quality: 90,
    fullPage: false,
    device: 'desktop'
  })
});

module.exports = {
  registerSchema,
  loginSchema,
  captureUrlSchema
};