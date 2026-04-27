const express = require('express');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');
const { validate, paginationSchema } = require('../middleware/validation');

const router = express.Router();

// Obtener todos los productos con paginación
router.get('/', authMiddleware, async (req, res) => {
  const { error, value } = paginationSchema.validate(req.query);
  const { search, category_id, in_stock, page, limit } = error ? { page: 1, limit: 50 } : value;
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * pageSize;

  try {
    let countQuery = 'SELECT COUNT(*) as total FROM products p WHERE is_active = true';
    let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE is_active = true';
    const params = [];

    if (search) {
      const searchParam = `%${search}%`;
      countQuery += ` AND (p.code ILIKE $${params.length + 1} OR p.name ILIKE $${params.length + 1} OR p.description ILIKE $${params.length + 1})`;
      query += ` AND (p.code ILIKE $${params.length + 1} OR p.name ILIKE $${params.length + 1} OR p.description ILIKE $${params.length + 1})`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (category_id) {
      const categoryParam = category_id;
      countQuery += ` AND p.category_id = $${params.length + 1}`;
      query += ` AND p.category_id = $${params.length + 1}`;
      params.push(categoryParam);
    }

    if (in_stock === 'true') {
      countQuery += ` AND p.stock > 0`;
      query += ` AND p.stock > 0`;
    }

    query += ' ORDER BY p.name LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(pageSize, offset);

    const [countResult, result] = await Promise.all([
      db.query(countQuery, params.slice(0, -2)),
      db.query(query, params)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / pageSize);

    res.json({
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener producto por código
router.get('/code/:code', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.code = $1',
      [req.params.code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear producto
router.post('/', authMiddleware, validate('createProduct'), async (req, res) => {
  const { code, name, description, category_id, price, cost, min_stock } = req.validatedData;

  try {
    const result = await db.query(
      'INSERT INTO products (code, name, description, category_id, price, cost, min_stock) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [code, name, description, category_id, price, cost || price * 0.6, min_stock]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
