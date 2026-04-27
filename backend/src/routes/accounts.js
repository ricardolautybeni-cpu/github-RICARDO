const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Obtener estado de cuenta de un cliente
router.get('/:clientId/statement', authMiddleware, async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    // Info del cliente
    const clientResult = await db.query(
      'SELECT * FROM clients WHERE id = $1',
      [req.params.clientId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const client = clientResult.rows[0];

    // Transacciones (ventas + pagos + devoluciones)
    let query = `
      SELECT s.id, s.created_at, 'sale' as type, s.total_amount as amount, s.status
      FROM sales s
      WHERE s.client_id = $1`;
    const params = [req.params.clientId];

    if (startDate) {
      query += ` AND s.created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND s.created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` UNION ALL
      SELECT p.id, p.created_at, 'payment' as type, -p.amount as amount, p.status
      FROM client_payments p
      WHERE p.client_id = $${params.indexOf(req.params.clientId) + 1}`;

    if (startDate) {
      query += ` AND p.created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND p.created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` UNION ALL
      SELECT r.id, r.created_at, 'return' as type, -r.total_amount as amount, r.status
      FROM returns r
      WHERE r.sale_id IN (SELECT id FROM sales WHERE client_id = $${params.indexOf(req.params.clientId) + 1})
      AND r.status = 'approved'`;

    if (startDate) {
      query += ` AND r.created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND r.created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` ORDER BY created_at DESC`;

    const transactionsResult = await db.query(query, params);

    // Calcular saldo
    let balance = 0;
    const transactions = transactionsResult.rows.map(t => {
      balance += parseFloat(t.amount || 0);
      return { ...t, running_balance: balance };
    });

    res.json({
      client,
      creditLimit: parseFloat(client.credit_limit || 0),
      currentDebt: parseFloat(client.current_debt || 0),
      availableCredit: parseFloat(client.credit_limit || 0) - parseFloat(client.current_debt || 0),
      transactions,
      periodBalance: balance,
      periodStart: startDate || 'inicio',
      periodEnd: endDate || 'hoy'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registrar pago de cliente
router.post('/:clientId/payments', authMiddleware, async (req, res) => {
  const { amount, payment_method, reference, notes } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Monto debe ser mayor a 0' });
  }

  try {
    // Validar cliente existe
    const clientResult = await db.query(
      'SELECT current_debt FROM clients WHERE id = $1',
      [req.params.clientId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const paymentId = uuidv4();
    const newDebt = Math.max(0, parseFloat(clientResult.rows[0].current_debt || 0) - amount);

    // Guardar pago
    const paymentResult = await db.query(
      `INSERT INTO client_payments (id, client_id, amount, payment_method, reference, notes, registered_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [paymentId, req.params.clientId, amount, payment_method || 'cash', reference, notes, req.user.id]
    );

    // Actualizar deuda del cliente
    await db.query(
      'UPDATE clients SET current_debt = $1 WHERE id = $2',
      [newDebt, req.params.clientId]
    );

    res.status(201).json({
      payment: paymentResult.rows[0],
      previousDebt: parseFloat(clientResult.rows[0].current_debt || 0),
      paymentAmount: amount,
      newDebt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener clientes con deuda
router.get('/', authMiddleware, async (req, res) => {
  const { hasDebt = false, page = 1, limit = 50 } = req.query;

  try {
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * pageSize;

    let query = 'SELECT * FROM clients WHERE is_active = true';
    const params = [];

    if (hasDebt === 'true') {
      query += ' AND current_debt > 0';
    }

    query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    params.push(pageSize, offset);

    const result = await db.query(query, params);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM clients WHERE is_active = true' + (hasDebt === 'true' ? ' AND current_debt > 0' : '')
    );

    const total = parseInt(countResult.rows[0].total);

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

// Actualizar límite de crédito
router.patch('/:clientId/credit-limit', authMiddleware, async (req, res) => {
  const { creditLimit } = req.body;

  if (creditLimit === undefined || creditLimit < 0) {
    return res.status(400).json({ error: 'creditLimit debe ser un número positivo' });
  }

  try {
    const result = await db.query(
      'UPDATE clients SET credit_limit = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [creditLimit, req.params.clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resumen de cuentas corrientes
router.get('/summary/all', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN current_debt > 0 THEN 1 END) as clients_with_debt,
        COALESCE(SUM(current_debt), 0) as total_receivable,
        COALESCE(AVG(current_debt), 0) as avg_debt_per_client
       FROM clients 
       WHERE is_active = true`
    );

    const topDebtorsResult = await db.query(
      `SELECT id, name, email, phone, current_debt, credit_limit, 
              ROUND((current_debt::numeric / NULLIF(credit_limit, 0)) * 100, 2) as debt_percentage
       FROM clients 
       WHERE is_active = true 
       AND current_debt > 0 
       ORDER BY current_debt DESC 
       LIMIT 20`
    );

    res.json({
      summary: result.rows[0],
      topDebtors: topDebtorsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
