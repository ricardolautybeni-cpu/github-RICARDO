const express = require('express');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Obtener todos los clientes
router.get('/', authMiddleware, async (req, res) => {
  const { search } = req.query;

  try {
    let query = 'SELECT * FROM clients WHERE is_active = true';
    const params = [];

    if (search) {
      query += ` AND (name ILIKE $${params.length + 1} OR document_number = $${params.length + 2} OR email ILIKE $${params.length + 3})`;
      params.push(`%${search}%`, search, `%${search}%`);
    }

    query += ' ORDER BY name';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear cliente
router.post('/', authMiddleware, async (req, res) => {
  const { name, document_type, document_number, email, phone, address } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nombre es requerido' });
  }

  try {
    const result = await db.query(
      'INSERT INTO clients (name, document_type, document_number, email, phone, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, document_type, document_number, email, phone, address]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener últimas 3 ventas de un cliente
router.get('/:id/last-sales', authMiddleware, async (req, res) => {
  try {
    const salesResult = await db.query(
      'SELECT s.id, s.total_amount, s.created_at FROM sales WHERE client_id = $1 ORDER BY created_at DESC LIMIT 3',
      [req.params.id]
    );

    const sales = salesResult.rows;

    // Obtener items de cada venta
    const salesWithItems = await Promise.all(sales.map(async (sale) => {
      const itemsResult = await db.query(
        'SELECT si.*, p.code, p.name FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id = $1',
        [sale.id]
      );
      return {
        ...sale,
        items: itemsResult.rows
      };
    }));

    res.json(salesWithItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
