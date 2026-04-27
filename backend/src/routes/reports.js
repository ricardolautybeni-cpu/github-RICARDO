const express = require('express');
const db = require('../db/connection');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/reports/profitability-ranking
 * Top 10 productos por margen de ganancia
 */
router.get('/profitability-ranking', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await db.query(`
      SELECT 
        p.id,
        p.code,
        p.name,
        p.price,
        p.cost,
        (p.price - p.cost) as margin_per_unit,
        COUNT(si.id) as total_sold,
        SUM(si.quantity) as total_quantity,
        SUM(si.subtotal) as total_revenue,
        SUM(si.quantity * p.cost) as total_cost,
        (SUM(si.subtotal) - SUM(si.quantity * p.cost)) as total_margin,
        ((SUM(si.subtotal) - SUM(si.quantity * p.cost)) / SUM(si.subtotal) * 100) as margin_percentage
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= NOW() - INTERVAL '1 day' * $1
        AND s.deleted_at IS NULL
        AND p.deleted_at IS NULL
      GROUP BY p.id, p.code, p.name, p.price, p.cost
      ORDER BY total_margin DESC
      LIMIT 10
    `, [days]);

    const ranking = result.rows.map(row => ({
      ...row,
      price: parseFloat(row.price),
      cost: parseFloat(row.cost),
      margin_per_unit: parseFloat(row.margin_per_unit),
      total_revenue: parseFloat(row.total_revenue || 0),
      total_cost: parseFloat(row.total_cost || 0),
      total_margin: parseFloat(row.total_margin || 0),
      margin_percentage: parseFloat(row.margin_percentage || 0)
    }));

    res.json({
      period_days: parseInt(days),
      total_products: ranking.length,
      ranking: ranking
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener ranking' });
  }
});

/**
 * GET /api/reports/inactive-clients
 * Clientes que no han comprado en X días
 */
router.get('/inactive-clients', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.current_debt,
        c.credit_limit,
        MAX(s.created_at) as last_purchase_date,
        NOW() - MAX(s.created_at) as days_since_purchase,
        COUNT(DISTINCT s.id) as total_purchases,
        COALESCE(SUM(s.total_amount), 0) as total_spent
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id AND s.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.email, c.phone, c.current_debt, c.credit_limit
      HAVING MAX(s.created_at) < NOW() - INTERVAL '1 day' * $1
         OR MAX(s.created_at) IS NULL
      ORDER BY MAX(s.created_at) DESC NULLS LAST
      LIMIT 50
    `, [days]);

    const inactiveClients = result.rows.map(row => ({
      ...row,
      current_debt: parseFloat(row.current_debt),
      credit_limit: parseFloat(row.credit_limit),
      total_spent: parseFloat(row.total_spent || 0),
      days_since_purchase: row.days_since_purchase ? Math.floor(row.days_since_purchase.split(' ')[0]) : null,
      alert_level: row.days_since_purchase ? (
        Math.floor(row.days_since_purchase.split(' ')[0]) > 60 ? '🚨 CRÍTICO (>60 días)' :
        Math.floor(row.days_since_purchase.split(' ')[0]) > 45 ? '⚠️ ALTO (>45 días)' :
        '📌 ATENCIÓN (>30 días)'
      ) : '🔴 NUNCA COMPRÓ'
    }));

    res.json({
      days_threshold: parseInt(days),
      total_inactive: inactiveClients.length,
      clients: inactiveClients
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener clientes inactivos' });
  }
});

/**
 * GET /api/reports/seller-performance
 * Rendimiento de cada vendedor (últimos 30 días)
 */
router.get('/seller-performance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await db.query(`
      SELECT 
        u.id,
        u.full_name,
        u.email,
        COUNT(DISTINCT s.id) as total_sales,
        SUM(s.total_amount) as total_revenue,
        SUM(s.total_cost) as total_cost,
        (SUM(s.total_amount) - SUM(s.total_cost)) as total_margin,
        AVG(s.total_amount) as avg_sale,
        COUNT(DISTINCT c.id) as unique_clients,
        COUNT(DISTINCT sc.id) as checkins_count
      FROM users u
      LEFT JOIN sales s ON u.id = s.user_id 
        AND s.created_at >= NOW() - INTERVAL '1 day' * $1
        AND s.deleted_at IS NULL
      LEFT JOIN clients c ON s.client_id = c.id AND c.deleted_at IS NULL
      LEFT JOIN seller_checkins sc ON u.id = sc.user_id
        AND sc.check_in_at >= NOW() - INTERVAL '1 day' * $1
        AND sc.deleted_at IS NULL
      WHERE u.role = 'seller'
        AND u.deleted_at IS NULL
      GROUP BY u.id, u.full_name, u.email
      ORDER BY total_margin DESC
    `, [days]);

    const performance = result.rows.map(row => ({
      ...row,
      total_revenue: parseFloat(row.total_revenue || 0),
      total_cost: parseFloat(row.total_cost || 0),
      total_margin: parseFloat(row.total_margin || 0),
      avg_sale: parseFloat(row.avg_sale || 0),
      productivity: {
        sales_per_day: (row.total_sales / days).toFixed(2),
        clients_per_day: (row.unique_clients / days).toFixed(2),
        avg_transaction_value: parseFloat(row.avg_sale || 0)
      }
    }));

    res.json({
      period_days: parseInt(days),
      total_sellers: performance.length,
      performance: performance
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener performance' });
  }
});

/**
 * GET /api/reports/price-changes
 * Histórico de cambios de precio
 */
router.get('/price-changes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { days = 30, product_id } = req.query;

    let query = `
      SELECT 
        ph.*,
        p.code,
        p.name,
        u.full_name as changed_by_name
      FROM price_history ph
      JOIN products p ON ph.product_id = p.id
      LEFT JOIN users u ON ph.changed_by = u.id
      WHERE ph.created_at >= NOW() - INTERVAL '1 day' * $1
    `;

    let params = [days];

    if (product_id) {
      query += ` AND ph.product_id = $${params.length + 1}`;
      params.push(product_id);
    }

    query += ` ORDER BY ph.created_at DESC LIMIT 100`;

    const result = await db.query(query, params);

    const changes = result.rows.map(row => ({
      ...row,
      price_before: parseFloat(row.price_before),
      price_after: parseFloat(row.price_after),
      price_change: parseFloat(row.price_after) - parseFloat(row.price_before),
      cost_before: parseFloat(row.cost_before || 0),
      cost_after: parseFloat(row.cost_after || 0),
      margin_change: parseFloat(row.margin_change || 0)
    }));

    res.json({
      period_days: parseInt(days),
      total_changes: changes.length,
      changes: changes
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener cambios de precio' });
  }
});

/**
 * GET /api/reports/visit-summary
 * Resumen de visitas (check-in) por vendedor
 */
router.get('/visit-summary', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await db.query(`
      SELECT 
        u.id,
        u.full_name,
        COUNT(DISTINCT sc.id) as total_visits,
        COUNT(DISTINCT CASE WHEN sc.visit_result = 'sale' THEN 1 END) as successful_visits,
        COUNT(DISTINCT CASE WHEN sc.visit_result != 'sale' AND sc.visit_result IS NOT NULL THEN 1 END) as unsuccessful_visits,
        COUNT(DISTINCT sc.client_id) as unique_clients_visited,
        AVG(EXTRACT(EPOCH FROM (sc.check_out_at - sc.check_in_at))/60) as avg_visit_duration_minutes,
        COUNT(DISTINCT CASE WHEN sc.photo_url IS NOT NULL THEN 1 END) as visits_with_photo,
        COUNT(DISTINCT CASE WHEN sc.signature_data IS NOT NULL THEN 1 END) as visits_with_signature
      FROM users u
      LEFT JOIN seller_checkins sc ON u.id = sc.user_id
        AND sc.check_in_at >= NOW() - INTERVAL '1 day' * $1
        AND sc.deleted_at IS NULL
      WHERE u.role = 'seller'
        AND u.deleted_at IS NULL
      GROUP BY u.id, u.full_name
      ORDER BY total_visits DESC
    `, [days]);

    const summary = result.rows.map(row => ({
      ...row,
      avg_visit_duration_minutes: parseFloat(row.avg_visit_duration_minutes || 0).toFixed(1),
      success_rate: row.total_visits > 0 ? 
        ((row.successful_visits / row.total_visits) * 100).toFixed(2) + '%' : 
        'N/A',
      photo_coverage: row.total_visits > 0 ?
        ((row.visits_with_photo / row.total_visits) * 100).toFixed(2) + '%' :
        'N/A'
    }));

    res.json({
      period_days: parseInt(days),
      total_sellers: summary.length,
      summary: summary
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener resumen de visitas' });
  }
});

module.exports = router;
