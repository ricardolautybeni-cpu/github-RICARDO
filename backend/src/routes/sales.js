const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');
const { validate, paginationSchema } = require('../middleware/validation');

const router = express.Router();

// Crear venta con validación de stock y estado
router.post('/', authMiddleware, validate('createSale'), async (req, res) => {
  const { client_id, items, payment_method, notes, force_pending } = req.validatedData;
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    if (items.some(i => !i.product_id || i.quantity < 1)) {
      throw new Error('Productos inválidos: falta product_id o quantity es menor a 1');
    }

    const sales_id = uuidv4();
    let total_amount = 0;
    let total_cost = 0;
    let has_stock_issue = false;
    const stock_issues = [];

    // Validar stock disponible ANTES de actualizar
    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, name, price, cost, stock FROM products WHERE id = $1 AND is_active = true',
        [item.product_id]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Producto ${item.product_id} no encontrado o inactivo`);
      }

      const product = productResult.rows[0];
      
      if (product.stock < item.quantity) {
        has_stock_issue = true;
        stock_issues.push({
          product_id: product.id,
          product_name: product.name,
          requested: item.quantity,
          available: product.stock
        });
      }
    }

    // Si hay problemas de stock y no se fuerza, retornar como pending_approval
    if (has_stock_issue && !force_pending) {
      await client.query('ROLLBACK');
      return res.status(202).json({
        status: 'pending_approval',
        message: 'Hay productos sin stock suficiente',
        stock_issues,
        suggestion: 'Usar force_pending=true para crear venta en estado "pending_approval"'
      });
    }

    // Procesá items y descuenta stock (si hay stock disponible)
    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, name, price, cost, stock FROM products WHERE id = $1',
        [item.product_id]
      );

      const product = productResult.rows[0];
      const qty_to_deduct = Math.min(item.quantity, product.stock); // Descontar solo lo disponible

      const subtotal = (item.quantity * product.price); // Cobrar cantidad solicitada
      total_amount += subtotal;
      total_cost += (item.quantity * (product.cost || 0));

      // Insertar item
      await client.query(
        'INSERT INTO sale_items (id, sale_id, product_id, quantity, bonus, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [uuidv4(), sales_id, item.product_id, item.quantity, item.bonus || 0, product.price, subtotal]
      );

      // Descontar stock (parcial si no hay completo)
      if (qty_to_deduct > 0) {
        await client.query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2',
          [qty_to_deduct, item.product_id]
        );

        // Registrar movimiento
        await client.query(
          'INSERT INTO inventory_movements (id, product_id, movement_type, quantity, reason, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [uuidv4(), item.product_id, 'salida', qty_to_deduct, 'Venta', req.user.id]
        );
      }
    }

    // Crear registro de venta con estado correcto
    const sale_status = has_stock_issue ? 'pending_approval' : 'completed';
    const saleResult = await client.query(
      'INSERT INTO sales (id, user_id, client_id, total_amount, total_cost, payment_method, status, notes, synced_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *',
      [sales_id, req.user.id, client_id || null, total_amount, total_cost, payment_method, sale_status, notes]
    );

    await client.query('COMMIT');
    
    const response = {
      ...saleResult.rows[0],
      stock_issues: has_stock_issue ? stock_issues : null
    };
    
    res.status(has_stock_issue ? 202 : 201).json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Obtener ventas con filtros y paginación
router.get('/', authMiddleware, async (req, res) => {
  const { error, value } = paginationSchema.validate(req.query);
  const { user_id, client_id, start_date, end_date, page, limit } = error ? { ...req.query, page: 1, limit: 50 } : value;
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * pageSize;

  try {
    let countQuery = 'SELECT COUNT(*) as total FROM sales s WHERE 1=1';
    let query = 'SELECT s.*, u.full_name, c.name as client_name FROM sales s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN clients c ON s.client_id = c.id WHERE 1=1';
    const params = [];

    if (user_id) {
      countQuery += ` AND s.user_id = $${params.length + 1}`;
      query += ` AND s.user_id = $${params.length + 1}`;
      params.push(user_id);
    }

    if (client_id) {
      countQuery += ` AND s.client_id = $${params.length + 1}`;
      query += ` AND s.client_id = $${params.length + 1}`;
      params.push(client_id);
    }

    if (start_date) {
      countQuery += ` AND s.created_at >= $${params.length + 1}`;
      query += ` AND s.created_at >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      countQuery += ` AND s.created_at <= $${params.length + 1}`;
      query += ` AND s.created_at <= $${params.length + 1}`;
      params.push(end_date);
    }

    query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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

// Obtener detalles de venta
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const sale = await db.query(
      'SELECT * FROM sales WHERE id = $1',
      [req.params.id]
    );

    if (sale.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const items = await db.query(
      'SELECT si.*, p.code, p.name FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id = $1',
      [req.params.id]
    );

    res.json({
      ...sale.rows[0],
      items: items.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
