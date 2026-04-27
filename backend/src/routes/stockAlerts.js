const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Obtener productos con stock bajo
router.get('/critical', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, 
              (p.min_stock - p.stock) as units_below_minimum,
              c.name as category_name,
              ROUND((p.stock::numeric / NULLIF(p.min_stock, 0)) * 100, 2) as stock_coverage_percent
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = true 
       AND p.stock < p.min_stock
       ORDER BY stock_coverage_percent ASC`,
      []
    );

    res.json({
      criticalProductsCount: result.rows.length,
      products: result.rows,
      totalStockValue: result.rows.reduce((sum, p) => sum + (p.price * p.min_stock), 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear alerta de stock
router.post('/alerts', authMiddleware, async (req, res) => {
  const { product_id, threshold_type = 'minimum', custom_threshold, enabled = true } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: 'product_id requerido' });
  }

  try {
    const result = await db.query(
      `INSERT INTO stock_alerts (id, product_id, threshold_type, custom_threshold, enabled) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [uuidv4(), product_id, threshold_type, custom_threshold || null, enabled]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener alertas activas
router.get('/alerts/active', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sa.*, p.code, p.name, p.stock, p.min_stock 
       FROM stock_alerts sa 
       LEFT JOIN products p ON sa.product_id = p.id 
       WHERE sa.enabled = true 
       ORDER BY sa.created_at DESC`,
      []
    );

    const activeAlerts = result.rows.filter(alert => {
      const threshold = alert.custom_threshold || alert.threshold_type === 'minimum' ? alert.min_stock : 0;
      return alert.stock < threshold;
    });

    res.json({
      activeAlertsCount: activeAlerts.length,
      alerts: activeAlerts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Desactivar alerta
router.post('/alerts/:alertId/disable', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE stock_alerts SET enabled = false WHERE id = $1 RETURNING *`,
      [req.params.alertId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard de inventario (resumen ejecutivo)
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    // Productos con stock bajo
    const criticalResult = await db.query(
      'SELECT COUNT(*) as count FROM products WHERE is_active = true AND stock < min_stock',
      []
    );

    // Valor total de inventario
    const valueResult = await db.query(
      'SELECT COALESCE(SUM(price * stock), 0) as total_value FROM products WHERE is_active = true',
      []
    );

    // Movimientos últimas 24 horas
    const movementsResult = await db.query(
      `SELECT movement_type, COUNT(*) as count 
       FROM inventory_movements 
       WHERE created_at > NOW() - INTERVAL '24 hours' 
       GROUP BY movement_type`,
      []
    );

    // Top 10 productos más vendidos (últimos 7 días)
    const topProductsResult = await db.query(
      `SELECT p.id, p.code, p.name, SUM(si.quantity) as total_qty, SUM(si.subtotal) as revenue 
       FROM products p 
       LEFT JOIN sale_items si ON p.id = si.product_id 
       LEFT JOIN sales s ON si.sale_id = s.id 
       WHERE s.created_at > NOW() - INTERVAL '7 days' 
       GROUP BY p.id, p.code, p.name 
       ORDER BY revenue DESC 
       LIMIT 10`,
      []
    );

    res.json({
      summary: {
        criticalProductsCount: parseInt(criticalResult.rows[0].count),
        totalInventoryValue: parseFloat(valueResult.rows[0].total_value || 0),
        last24hMovements: movementsResult.rows
      },
      topProducts: topProductsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
