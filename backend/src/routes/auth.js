const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Generar tokens (acceso y refresh)
function generateTokens(userId, email, role) {
  const accessToken = jwt.sign(
    { id: userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }  // Token corto (15 minutos)
  );

  const refreshToken = jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }  // Refresh token largo (7 días)
  );

  return { accessToken, refreshToken };
}

// ...existing code...

// Registro
router.post('/register', validate('register'), async (req, res) => {
  const { email, password, full_name, role } = req.validatedData;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.query(
      'INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role',
      [uuidv4(), email, hashedPassword, full_name, role]
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

    // Guardar refresh token en BD
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    res.status(201).json({ 
      user, 
      accessToken,
      refreshToken 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', validate('login'), async (req, res) => {
  const { email, password } = req.validatedData;

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

    // Guardar refresh token en BD
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }, 
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh Token con Token Rotation (Seguridad mejorada)
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token requerido' });
  }

  try {
    // Verificar que el refresh token sea válido
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Verificar en BD
    const tokenResult = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW()',
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      // Token revocado o expirado - ATACADO POTENCIAL
      // Desloguear todas las sesiones del usuario
      await db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [decoded.id]
      );

      return res.status(401).json({
        error: 'Refresh token inválido. Intento de acceso sospechoso detectado. Todas las sesiones han sido cerradas.',
        securityAlert: true
      });
    }

    // Obtener datos del usuario
    const userResult = await db.query(
      'SELECT id, email, role FROM users WHERE id = $1 AND deleted_at IS NULL',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.email, user.role);

    // TOKEN ROTATION: Invalidar token anterior e insertar nuevo
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // En una transacción: revocar viejo + crear nuevo
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Revocar token anterior
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1',
        [refreshToken]
      );

      // Crear nuevo token
      await client.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, newRefreshToken, expiresAt]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: '15m',
      refreshExpiresIn: '7d'
    });
  } catch (error) {
    res.status(401).json({ error: error.message || 'Token refresh fallido' });
  }
});


// Logout (revocar refresh token)
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token requerido' });
  }

  try {
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1',
      [refreshToken]
    );

    res.json({ message: 'Logout exitoso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
