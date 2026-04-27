const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Crear devolución (devuelve productos a inventario)
router.post('/', authMiddleware, async (req, res) => {
  const { sale_id, items, reason, notes } = req.body;

  if (!sale_id || !items || items.length === 0) {
    return res.status(400).json({ error: 'sale_id e items requeridos' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const returnId = uuidv4();

    // Crear registro de devolución
    const returnResult = await client.query(
      `INSERT INTO returns (id, sale_id, user_id, reason, notes, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [returnId, sale_id, req.user.id, reason || 'Sin especificar', notes || '', 'pending_approval']
    );

    // Procesar items
    let totalAmount = 0;
    for (const item of items) {
      const { product_id, quantity } = item;

      // Obtener info del producto
      const productResult = await client.query(
        'SELECT price FROM products WHERE id = $1',
        [product_id]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Producto ${product_id} no encontrado`);
      }

      const itemAmount = productResult.rows[0].price * quantity;
      totalAmount += itemAmount;

      // Guardar item de devolución
      await client.query(
        `INSERT INTO return_items (id, return_id, product_id, quantity, unit_price) 
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), returnId, product_id, quantity, productResult.rows[0].price]
      );

      // Aumentar stock
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
        [quantity, product_id]
      );

      // Crear nota de crédito
      const creditNoteId = uuidv4();
      await client.query(
        `INSERT INTO credit_notes (id, return_id, product_id, quantity, unit_price, total_amount) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [creditNoteId, returnId, product_id, quantity, productResult.rows[0].price, itemAmount]
      );
    }

    // Actualizar total
    await client.query(
      'UPDATE returns SET total_amount = $1 WHERE id = $2',
      [totalAmount, returnId]
    );

    await client.query('COMMIT');

    const result = await db.query('SELECT * FROM returns WHERE id = $1', [returnId]);
    res.status(201).json({
      ...result.rows[0],
      total_items: items.length,
      total_amount: totalAmount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Obtener devoluciones
router.get('/', authMiddleware, async (req, res) => {
  const { page = 1, limit = 50, status, sale_id } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * pageSize;

  try {
    let countQuery = 'SELECT COUNT(*) as total FROM returns WHERE 1=1';
    let query = `SELECT r.*, u.full_name as user_name, s.id as sale_id 
                 FROM returns r 
                 LEFT JOIN users u ON r.user_id = u.id 
                 LEFT JOIN sales s ON r.sale_id = s.id 
                 WHERE 1=1`;
    const params = [];

    if (status) {
      countQuery += ` AND status = $${params.length + 1}`;
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (sale_id) {
      countQuery += ` AND sale_id = $${params.length + 1}`;
      query += ` AND sale_id = $${params.length + 1}`;
      params.push(sale_id);
    }

    const totalResult = await db.query(countQuery, params);
    const total = parseInt(totalResult.rows[0].total);

    query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageSize, offset);

    const result = await db.query(query, params);
    res.json({
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: offset + pageSize < total,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener items de una devolución
router.get('/:returnId/items', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ri.*, p.code, p.name 
       FROM return_items ri 
       LEFT JOIN products p ON ri.product_id = p.id 
       WHERE ri.return_id = $1`,
      [req.params.returnId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener notas de crédito asociadas
router.get('/:returnId/credit-notes', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cn.*, p.code, p.name FROM credit_notes cn 
       LEFT JOIN products p ON cn.product_id = p.id 
       WHERE cn.return_id = $1`,
      [req.params.returnId]
    );

    const totalAmount = result.rows.reduce((sum, cn) => sum + parseFloat(cn.total_amount || 0), 0);

    res.json({
      creditNotes: result.rows,
      totalCredits: totalAmount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Aprobar devolución
router.post('/:returnId/approve', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE returns 
       SET status = 'approved', approved_at = NOW(), approved_by = $1
       WHERE id = $2 
       RETURNING *`,
      [req.user.id, req.params.returnId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Devolución no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rechazar devolución
router.post('/:returnId/reject', authMiddleware, async (req, res) => {
  const { reason } = req.body;

  try {
    // Revertir stock si estaba en pending_approval
    const returnData = await db.query('SELECT * FROM returns WHERE id = $1', [req.params.returnId]);
    
    if (returnData.rows[0].status === 'pending_approval') {
      const items = await db.query('SELECT * FROM return_items WHERE return_id = $1', [req.params.returnId]);
      
      for (const item of items.rows) {
        await db.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
    }

    const result = await db.query(
      `UPDATE returns 
       SET status = 'rejected', rejected_at = NOW(), rejection_reason = $1, rejected_by = $2
       WHERE id = $3 
       RETURNING *`,
      [reason || '', req.user.id, req.params.returnId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
