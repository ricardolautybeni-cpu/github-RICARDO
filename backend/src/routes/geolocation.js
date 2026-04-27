const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Guardar ubicación actual del vendedor
router.post('/location', authMiddleware, async (req, res) => {
  const { latitude, longitude, accuracy } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Latitud y longitud requeridas' });
  }

  try {
    // Validar rango de coordenadas
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Coordenadas inválidas' });
    }

    const result = await db.query(
      'INSERT INTO seller_locations (id, user_id, latitude, longitude, accuracy) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [uuidv4(), req.user.id, latitude, longitude, accuracy || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener ubicación actual del vendedor
router.get('/location/current', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM seller_locations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    res.json(result.rows[0] || { error: 'Sin ubicación registrada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener trayecto del día (todas las ubicaciones registradas)
router.get('/routes/:userId/today', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM seller_locations 
       WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE 
       ORDER BY created_at ASC`,
      [req.params.userId]
    );

    res.json({
      userId: req.params.userId,
      date: new Date().toISOString().split('T')[0],
      locations: result.rows,
      totalLocations: result.rows.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener clientes cercanos (dentro de X km)
router.get('/clients/nearby', authMiddleware, async (req, res) => {
  const { latitude, longitude, radiusKm = 5 } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitud y longitud requeridas' });
  }

  try {
    const result = await db.query(
      `SELECT *, 
              (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))) 
              AS distance_km
       FROM clients 
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL
       HAVING (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))) <= $3
       ORDER BY distance_km ASC
       LIMIT 50`,
      [parseFloat(latitude), parseFloat(longitude), parseFloat(radiusKm)]
    );

    res.json({
      center: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
      radiusKm: parseFloat(radiusKm),
      clientsFound: result.rows.length,
      clients: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear ruta de visitas
router.post('/routes', authMiddleware, async (req, res) => {
  const { name, description, client_ids } = req.body;

  if (!name || !client_ids || client_ids.length === 0) {
    return res.status(400).json({ error: 'nombre y clientes_ids requeridos' });
  }

  try {
    const routeId = uuidv4();
    
    await db.query(
      'INSERT INTO sales_routes (id, user_id, name, description) VALUES ($1, $2, $3, $4)',
      [routeId, req.user.id, name, description || '']
    );

    // Agregar clientes a la ruta
    const stopsData = client_ids.map((cid, idx) => [uuidv4(), routeId, cid, idx + 1]);
    for (const [stopId, rid, cid, seq] of stopsData) {
      await db.query(
        'INSERT INTO route_stops (id, route_id, client_id, sequence) VALUES ($1, $2, $3, $4)',
        [stopId, rid, cid, seq]
      );
    }

    const result = await db.query('SELECT * FROM sales_routes WHERE id = $1', [routeId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener rutas del vendedor
router.get('/routes', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sr.*, COUNT(rs.id) as stops_count 
       FROM sales_routes sr 
       LEFT JOIN route_stops rs ON sr.id = rs.route_id 
       WHERE sr.user_id = $1 AND sr.is_active = true
       GROUP BY sr.id 
       ORDER BY sr.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalles de una ruta con clientes
router.get('/routes/:routeId/stops', authMiddleware, async (req, res) => {
  try {
    const route = await db.query(
      'SELECT * FROM sales_routes WHERE id = $1 AND user_id = $2',
      [req.params.routeId, req.user.id]
    );

    if (route.rows.length === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }

    const stops = await db.query(
      `SELECT rs.*, c.name, c.latitude, c.longitude, c.address 
       FROM route_stops rs 
       LEFT JOIN clients c ON rs.client_id = c.id 
       WHERE rs.route_id = $1 
       ORDER BY rs.sequence ASC`,
      [req.params.routeId]
    );

    res.json({
      route: route.rows[0],
      stops: stops.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Marcar parada como visitada
router.post('/routes/:routeId/stops/:stopId/visited', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE route_stops 
       SET visited_at = NOW()
       WHERE id = $1 
       RETURNING *`,
      [req.params.stopId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parada no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
