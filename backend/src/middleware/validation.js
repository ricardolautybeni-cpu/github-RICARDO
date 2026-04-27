const Joi = require('joi');

// Esquemas de validación centralizados

const saleItemSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).max(999999).required(),
  bonus: Joi.number().integer().min(0).default(0)
});

const createSaleSchema = Joi.object({
  client_id: Joi.string().uuid().allow(null),
  items: Joi.array().items(saleItemSchema).min(1).required(),
  payment_method: Joi.string().valid('cash', 'card', 'transfer', 'credit').default('cash'),
  notes: Joi.string().max(500).allow(''),
  force_pending: Joi.boolean().default(false)
});

const createProductSchema = Joi.object({
  code: Joi.string().alphanum().required(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(500).allow(''),
  category_id: Joi.string().uuid().allow(null),
  price: Joi.number().positive().required(),
  cost: Joi.number().positive().allow(null),
  min_stock: Joi.number().integer().min(0).default(0)
});

const createClientSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  document_type: Joi.string().valid('dni', 'ruc', 'cuit').required(),
  document_number: Joi.string().alphanum().required(),
  email: Joi.string().email().allow(''),
  phone: Joi.string().max(20).allow(''),
  address: Joi.string().max(500).allow(''),
  credit_limit: Joi.number().min(0).default(0)
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/[a-z]/)
    .pattern(/[A-Z]/)
    .pattern(/[0-9]/)
    .required()
    .messages({
      'string.pattern.base': 'Contraseña debe incluir mayúscula, minúscula y número'
    }),
  full_name: Joi.string().min(1).max(255).required(),
  role: Joi.string().valid('seller', 'admin').default('seller')
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50)
});

// Middleware de validación reutilizable
const validate = (schemaName) => {
  return (req, res, next) => {
    const schemas = {
      createSale: createSaleSchema,
      createProduct: createProductSchema,
      createClient: createClientSchema,
      login: loginSchema,
      register: registerSchema,
      pagination: paginationSchema
    };

    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({ error: 'Schema no encontrado' });
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));
      return res.status(400).json({ error: 'Validación fallida', details });
    }

    req.validatedData = value;
    next();
  };
};

module.exports = {
  validate,
  createSaleSchema,
  createProductSchema,
  createClientSchema,
  loginSchema,
  registerSchema,
  paginationSchema
};
