const db = require('../db/connection');
const { v4: uuid } = require('uuid');

/**
 * Middleware para registrar automáticamente cambios en auditoría
 * Se debe llamar después de cualquier operación que modifique datos
 */

async function logAudit(userId, action, tableName, recordId, oldValues, newValues, req) {
  try {
    const auditId = uuid();
    const ipAddress = req?.ip || req?.connection?.remoteAddress || 'unknown';
    const userAgent = req?.get('user-agent') || 'unknown';

    await db.query(`
      INSERT INTO audit_logs 
      (id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      auditId,
      userId,
      action,
      tableName,
      recordId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent
    ]);

    return auditId;
  } catch (error) {
    console.error('Error registrando auditoría:', error);
    // No fallar la operación principal si la auditoría falla
  }
}

/**
 * Middleware Express que captura cambios automáticamente
 * Úsalo después de cualquier POST/PUT/DELETE
 */
async function auditMiddleware(req, res, next) {
  // Guardar método y body original para comparación posterior
  req.originalBody = JSON.parse(JSON.stringify(req.body));
  req.logAudit = logAudit;

  // Interceptar response para capturar cambios
  const originalJson = res.json;
  res.json = function(data) {
    // Si la respuesta indica éxito y hay datos, registrar auditoria se hará manualmente
    return originalJson.call(this, data);
  };

  next();
}

/**
 * Para usar en un controlador, después de actualizar:
 * 
 * await logAudit(
 *   user_id,
 *   'update',
 *   'products',
 *   product_id,
 *   { precio: 100, stock: 50 },  // valores anteriores
 *   { precio: 120, stock: 45 },   // valores nuevos
 *   req
 * );
 */

module.exports = {
  logAudit,
  auditMiddleware
};
