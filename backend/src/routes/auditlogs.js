const express = require('express');
const db = require('../db/connection');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/auditlogs
 * Admin: ver historial de auditoría
 */
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { action, table_name, user_id, days = 7, limit = 100 } = req.query;

    let query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= NOW() - INTERVAL '1 day' * $1
    `;

    let params = [days];
    let paramCount = 2;

    if (action) {
      query += ` AND al.action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }

    if (table_name) {
      query += ` AND al.table_name = $${paramCount}`;
      params.push(table_name);
      paramCount++;
    }

    if (user_id) {
      query += ` AND al.user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit) || 100);

    const result = await db.query(query, params);

    res.json({
      total: result.rows.length,
      filters: { action, table_name, user_id, days },
      logs: result.rows
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener auditoría' });
  }
});

/**
 * GET /api/auditlogs/record/:table_name/:record_id
 * Ver historial de cambios de un registro específico
 */
router.get('/record/:table_name/:record_id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { table_name, record_id } = req.params;

    const result = await db.query(`
      SELECT 
        al.*,
        u.full_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.table_name = $1 
        AND al.record_id = $2
      ORDER BY al.created_at DESC
    `, [table_name, record_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No hay auditoría para este registro' });
    }

    // Construir el historial de cambios
    const history = result.rows.map((log, index) => ({
      action: log.action,
      timestamp: log.created_at,
      user: log.user_name,
      changes: {
        from: log.old_values,
        to: log.new_values
      },
      ip: log.ip_address
    }));

    res.json({
      table: table_name,
      record_id: record_id,
      total_changes: history.length,
      history: history
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

/**
 * GET /api/auditlogs/user/:user_id
 * Ver todas las acciones de un usuario
 */
router.get('/user/:user_id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { days = 30 } = req.query;

    const result = await db.query(`
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id = $1
        AND al.created_at >= NOW() - INTERVAL '1 day' * $2
      GROUP BY al.id, u.id, u.full_name, u.email
      ORDER BY al.created_at DESC
      LIMIT 200
    `, [user_id, days]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado o sin auditoría' });
    }

    // Agrupar por tipo de acción
    const actionStats = {};
    result.rows.forEach(log => {
      actionStats[log.action] = (actionStats[log.action] || 0) + 1;
    });

    res.json({
      user: {
        id: user_id,
        name: result.rows[0].user_name,
        email: result.rows[0].email
      },
      period_days: parseInt(days),
      total_actions: result.rows.length,
      action_breakdown: actionStats,
      logs: result.rows
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener historial del usuario' });
  }
});

/**
 * GET /api/auditlogs/search
 * Buscar en auditoría por palabra clave en old/new values
 */
router.get('/search', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { keyword, days = 30 } = req.query;

    if (!keyword || keyword.length < 3) {
      return res.status(400).json({ error: 'Palabra clave mínimo 3 caracteres' });
    }

    const result = await db.query(`
      SELECT 
        al.*,
        u.full_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= NOW() - INTERVAL '1 day' * $1
        AND (
          al.old_values::text ILIKE $2
          OR al.new_values::text ILIKE $2
          OR al.record_id ILIKE $2
        )
      ORDER BY al.created_at DESC
      LIMIT 100
    `, [days, `%${keyword}%`]);

    res.json({
      keyword,
      total_matches: result.rows.length,
      matches: result.rows
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error en búsqueda' });
  }
});

/**
 * GET /api/auditlogs/suspicious-activity
 * Detectar actividades sospechosas (múltiples cambios rápidos, etc)
 */
router.get('/suspicious-activity', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        user_id,
        u.full_name,
        u.email,
        COUNT(*) as action_count,
        MAX(al.created_at) as last_activity,
        ARRAY_AGG(DISTINCT al.action) as actions
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY user_id, u.full_name, u.email
      HAVING COUNT(*) > 20  -- Más de 20 acciones en 1 hora es sospechoso
      ORDER BY action_count DESC
    `);

    const suspicious = result.rows.map(row => ({
      ...row,
      risk_level: row.action_count > 50 ? '🚨 CRÍTICO' : '⚠️ ALTO',
      possible_reason: 'Acciones múltiples en tiempo corto (posible script/automatización)'
    }));

    res.json({
      time_window: 'Last 1 hour',
      suspicious_users: suspicious.length,
      details: suspicious
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al detectar actividades sospechosas' });
  }
});

module.exports = router;
