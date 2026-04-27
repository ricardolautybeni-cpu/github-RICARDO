const express = require('express');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Obtener estado del inventario
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.id,
        p.code,
        p.name,
        p.stock,
        p.min_stock,
        (p.stock <= p.min_stock) as low_stock,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
      ORDER BY p.name
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registrar entrada
router.post('/entry', authMiddleware, async (req, res) => {
  const { product_id, quantity, reason } = req.body;

  if (!product_id || !quantity) {
    return res.status(400).json({ error: 'product_id y quantity son requeridos' });
  }

  try {
    await db.query(
      'UPDATE products SET stock = stock + $1 WHERE id = $2',
      [quantity, product_id]
    );

    await db.query(
      'INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, user_id) VALUES ($1, $2, $3, $4, $5)',
      [product_id, 'entrada', quantity, reason || 'Entrada manual', req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
