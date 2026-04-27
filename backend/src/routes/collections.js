const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/collections/check-in
 * Registrar check-in en cliente (inicio de visita)
 */
router.post('/check-in', authMiddleware, async (req, res) => {
  const { client_id, latitude, longitude, notes } = req.body;

  if (!client_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      error: 'client_id, latitude y longitude son requeridos'
    });
  }

  try {
    const checkInId = uuidv4();

    // Crear registro de check-in
    const result = await db.query(
      `INSERT INTO seller_checkins 
       (id, user_id, client_id, check_in_at, latitude, longitude, notes) 
       VALUES ($1, $2, $3, NOW(), $4, $5, $6) 
       RETURNING *`,
      [checkInId, req.user.id, client_id, latitude, longitude, notes || '']
    );

    // Validar si cliente tiene deuda vencida o superó límite
    const clientResult = await db.query(
      `SELECT clients.*, 
              COALESCE(SUM(sales.total_amount), 0) as total_vencido
       FROM clients 
       LEFT JOIN sales ON clients.id = sales.client_id 
       AND sales.created_at < NOW() - INTERVAL '30 days'
       AND sales.status != 'cancelled'
       WHERE clients.id = $1 AND clients.deleted_at IS NULL
       GROUP BY clients.id`,
      [client_id]
    );

    const client = clientResult.rows[0];
    const currentDebt = parseFloat(client.current_debt || 0);
    const totalVencido = parseFloat(client.total_vencido || 0);
    const creditLimit = parseFloat(client.credit_limit || 0);
    const canProceedWithSale = currentDebt + totalVencido <= creditLimit;

    res.status(201).json({
      checkInId,
      timestamp: new Date(),
      client: {
        id: client.id,
        name: client.name,
        creditLimit: parseFloat(client.credit_limit),
        currentDebt: parseFloat(client.current_debt),
        overdueAmount: parseFloat(client.total_vencido),
        canProceedWithSale,
        warning: !canProceedWithSale ? 'Cliente superó límite de crédito o tiene facturas vencidas' : null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collections/check-out/:checkInId
 * Registrar check-out (fin de visita)
 */
router.post('/check-out/:checkInId', authMiddleware, async (req, res) => {
  const { notes, signature_data } = req.body;

  try {
    const result = await db.query(
      `UPDATE seller_checkins 
       SET check_out_at = NOW(), notes = $1, signature_data = $2 
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [notes || '', signature_data || null, req.params.checkInId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    const checkIn = result.rows[0];
    const durationMinutes = Math.round(
      (new Date(checkIn.check_out_at) - new Date(checkIn.check_in_at)) / 60000
    );

    res.json({
      checkOutId: result.rows[0].id,
      timestamp: new Date(),
      duration: `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
      durationMinutes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collections/payment
 * Registrar cobro/pago de cliente
 * Generar recibo automáticamente
 */
router.post('/payment', authMiddleware, async (req, res) => {
  const { client_id, amount, payment_method, reference, notes } = req.body;

  if (!client_id || !amount || amount <= 0) {
    return res.status(400).json({
      error: 'client_id y amount (>0) son requeridos'
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Obtener deuda actual
    const clientDataResult = await client.query(
      'SELECT * FROM clients WHERE id = $1 AND deleted_at IS NULL',
      [client_id]
    );

    if (clientDataResult.rows.length === 0) {
      throw new Error('Cliente no encontrado');
    }

    const clientData = clientDataResult.rows[0];
    const previousDebt = parseFloat(clientData.current_debt || 0);

    // Validar monto no supere deuda
    if (amount > previousDebt + 100) { // Margen de 100 para errores de redondeo
      return res.status(400).json({
        error: `Monto supera deuda actual (${previousDebt}). Verifica el cliente.`
      });
    }

    const paymentId = uuidv4();
    const newDebt = Math.max(0, previousDebt - amount);

    // Registrar pago
    await client.query(
      `INSERT INTO client_payments 
       (id, client_id, amount, payment_method, reference, notes, registered_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [paymentId, client_id, amount, payment_method || 'cash', reference, notes, req.user.id]
    );

    // Actualizar deuda
    await client.query(
      'UPDATE clients SET current_debt = $1, updated_at = NOW() WHERE id = $2',
      [newDebt, client_id]
    );

    // Generar Recibo (datos para PDF)
    const receipt = {
      id: paymentId,
      client: clientData,
      amount,
      previousDebt,
      newDebt,
      paymentMethod: payment_method || 'cash',
      reference,
      registeredBy: req.user.id,
      timestamp: new Date(),
      notes
    };

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      paymentId,
      receipt
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/collections/daily-summary
 * Resumen del día: cobros, visitas, deudores
 */
router.get('/daily-summary', authMiddleware, async (req, res) => {
  try {
    // Visitas totales
    const visitsResult = await db.query(
      `SELECT COUNT(*) as total_visits, AVG(EXTRACT(EPOCH FROM (check_out_at - check_in_at))/60) as avg_duration_minutes
       FROM seller_checkins 
       WHERE user_id = $1 AND DATE(check_in_at) = CURRENT_DATE AND deleted_at IS NULL`,
      [req.user.id]
    );

    // Cobros totales
    const paymentsResult = await db.query(
      `SELECT COUNT(*) as total_payments, COALESCE(SUM(amount), 0) as total_collected
       FROM client_payments 
       WHERE registered_by = $1 AND DATE(created_at) = CURRENT_DATE AND deleted_at IS NULL`,
      [req.user.id]
    );

    // Ventas hoy
    const salesResult = await db.query(
      `SELECT COUNT(*) as total_sales, COALESCE(SUM(total_amount), 0) as sales_amount
       FROM sales 
       WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE AND deleted_at IS NULL`,
      [req.user.id]
    );

    // Top clientes visitados
    const topClientsResult = await db.query(
      `SELECT c.id, c.name, COUNT(sc.id) as visit_count, COALESCE(SUM(s.total_amount), 0) as total_sales_amount
       FROM seller_checkins sc
       LEFT JOIN clients c ON sc.client_id = c.id
       LEFT JOIN sales s ON c.id = s.client_id AND DATE(s.created_at) = CURRENT_DATE
       WHERE sc.user_id = $1 AND DATE(sc.check_in_at) = CURRENT_DATE AND sc.deleted_at IS NULL
       GROUP BY c.id, c.name
       ORDER BY visit_count DESC
       LIMIT 10`,
      [req.user.id]
    );

    res.json({
      date: new Date().toISOString().split('T')[0],
      visits: {
        total: parseInt(visitsResult.rows[0].total_visits),
        avgDurationMinutes: Math.round(parseFloat(visitsResult.rows[0].avg_duration_minutes) || 0)
      },
      payments: {
        total: parseInt(paymentsResult.rows[0].total_payments),
        collectedAmount: parseFloat(paymentsResult.rows[0].total_collected)
      },
      sales: {
        total: parseInt(salesResult.rows[0].total_sales),
        amount: parseFloat(salesResult.rows[0].sales_amount)
      },
      topClients: topClientsResult.rows.map(row => ({
        clientId: row.id,
        clientName: row.name,
        visitCount: row.visit_count,
        salesAmount: parseFloat(row.total_sales_amount)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/collections/overdue-clients
 * Clientes con facturas vencidas
 */
router.get('/overdue-clients', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.name, c.email, c.phone, c.current_debt, c.credit_limit,
              MAX(s.created_at) as last_purchase,
              COALESCE(SUM(CASE WHEN s.created_at < NOW() - INTERVAL '30 days' THEN s.total_amount ELSE 0 END), 0) as overdue_amount
       FROM clients c
       LEFT JOIN sales s ON c.id = s.client_id AND s.deleted_at IS NULL
       WHERE c.deleted_at IS NULL
       AND s.created_at < NOW() - INTERVAL '30 days'
       GROUP BY c.id, c.name, c.email, c.phone, c.current_debt, c.credit_limit
       ORDER BY overdue_amount DESC
       LIMIT 50`,
      []
    );

    res.json({
      overdueClientsCount: result.rows.length,
      clients: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        currentDebt: parseFloat(row.current_debt),
        creditLimit: parseFloat(row.credit_limit),
        lastPurchase: row.last_purchase,
        overdueAmount: parseFloat(row.overdue_amount)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
