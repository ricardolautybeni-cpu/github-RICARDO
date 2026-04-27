const express = require('express');
const db = require('../db/connection');
const { v4: uuid } = require('uuid');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/settlements/submit-daily
 * Vendedor envía su rendición del día
 */
router.post('/submit-daily', authMiddleware, async (req, res) => {
  try {
    const { settlement_date, total_collected_cash = 0, total_collected_transfer = 0, notes } = req.body;
    const user_id = req.user.id;

    if (!settlement_date) {
      return res.status(400).json({ error: 'settlement_date requerido' });
    }

    // Obtener datos del día
    const salesResult = await db.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(total_cost), 0) as total_cost
      FROM sales 
      WHERE user_id = $1 
        AND DATE(created_at) = $2
        AND deleted_at IS NULL
    `, [user_id, settlement_date]);

    const salesData = salesResult.rows[0];
    const total_sales = parseFloat(salesData.total_sales);
    const total_cost = parseFloat(salesData.total_cost);
    const total_margin = total_sales - total_cost;

    // Obtener gastos del día
    const expenseResult = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses 
      WHERE user_id = $1 
        AND expense_date = $2
        AND deleted_at IS NULL
    `, [user_id, settlement_date]);

    const total_expenses = parseFloat(expenseResult.rows[0].total_expenses);
    const total_collected = parseFloat(total_collected_cash) + parseFloat(total_collected_transfer);
    const net_amount = total_collected - total_expenses;

    // Verificar si ya existe liquidación para este día
    const existingCheck = await db.query(`
      SELECT id FROM daily_settlements 
      WHERE user_id = $1 
        AND settlement_date = $2
    `, [user_id, settlement_date]);

    let settlementId;
    if (existingCheck.rows.length > 0) {
      // Actualizar existente
      settlementId = existingCheck.rows[0].id;
      await db.query(`
        UPDATE daily_settlements 
        SET total_sales = $1,
            total_cost = $2,
            total_margin = $3,
            total_collected_cash = $4,
            total_collected_transfer = $5,
            total_expenses = $6,
            net_amount = $7,
            notes = $8,
            updated_at = NOW()
        WHERE id = $9
      `, [
        total_sales, total_cost, total_margin,
        total_collected_cash, total_collected_transfer,
        total_expenses, net_amount, notes,
        settlementId
      ]);
    } else {
      // Crear nuevo
      settlementId = uuid();
      await db.query(`
        INSERT INTO daily_settlements 
        (id, user_id, settlement_date, total_sales, total_cost, total_margin, 
         total_collected_cash, total_collected_transfer, total_expenses, net_amount, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        settlementId, user_id, settlement_date,
        total_sales, total_cost, total_margin,
        total_collected_cash, total_collected_transfer,
        total_expenses, net_amount, notes
      ]);
    }

    res.status(201).json({
      settlementId,
      status: 'pending',
      summary: {
        total_sales: parseFloat(total_sales.toFixed(2)),
        total_cost: parseFloat(total_cost.toFixed(2)),
        total_margin: parseFloat(total_margin.toFixed(2)),
        total_collected_cash: parseFloat(total_collected_cash),
        total_collected_transfer: parseFloat(total_collected_transfer),
        total_expenses: parseFloat(total_expenses.toFixed(2)),
        net_amount: parseFloat(net_amount.toFixed(2))
      }
    });

  } catch (error) {
    console.error('Error en liquidación:', error);
    res.status(500).json({ error: 'Error al procesar liquidación' });
  }
});

/**
 * GET /api/settlements/daily/:settlement_id
 * Ver detalles de una liquidación
 */
router.get('/daily/:settlement_id', authMiddleware, async (req, res) => {
  try {
    const { settlement_id } = req.params;

    const result = await db.query(`
      SELECT 
        ds.*,
        u.full_name as seller_name,
        (SELECT count(*) FROM sales WHERE user_id = ds.user_id AND DATE(created_at) = ds.settlement_date) as sale_count,
        (SELECT count(*) FROM client_payments WHERE registered_by = ds.user_id AND DATE(created_at) = ds.settlement_date) as payment_count
      FROM daily_settlements ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = $1
    `, [settlement_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener liquidación' });
  }
});

/**
 * GET /api/settlements/pending
 * Admin: ver todas las liquidaciones pendientes
 */
router.get('/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        ds.*,
        u.full_name as seller_name,
        u.email
      FROM daily_settlements ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.status = 'pending'
      ORDER BY ds.settlement_date DESC
      LIMIT 50
    `);

    res.json(result.rows);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener liquidaciones' });
  }
});

/**
 * POST /api/settlements/:settlement_id/approve
 * Admin: aprobar liquidación
 */
router.post('/:settlement_id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { settlement_id } = req.params;
    const admin_id = req.user.id;

    await db.query(`
      UPDATE daily_settlements 
      SET status = 'approved',
          approved_by = $1,
          approved_at = NOW()
      WHERE id = $2
    `, [admin_id, settlement_id]);

    res.json({ status: 'approved', message: 'Liquidación aprobada' });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al aprobar' });
  }
});

/**
 * POST /api/settlements/:settlement_id/reject
 * Admin: rechazar liquidación con motivo
 */
router.post('/:settlement_id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { settlement_id } = req.params;
    const { rejection_reason } = req.body;
    const admin_id = req.user.id;

    if (!rejection_reason) {
      return res.status(400).json({ error: 'rejection_reason requerido' });
    }

    await db.query(`
      UPDATE daily_settlements 
      SET status = 'rejected',
          rejection_reason = $1,
          approved_by = $2,
          approved_at = NOW()
      WHERE id = $3
    `, [rejection_reason, admin_id, settlement_id]);

    res.json({ status: 'rejected', message: 'Liquidación rechazada' });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al rechazar' });
  }
});

module.exports = router;
