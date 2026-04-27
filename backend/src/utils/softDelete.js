// Utilidades para queries con Soft Deletes

const softDeleteFilter = {
  // Filtro para consultas WHERE
  whereClause: (tableName) => `${tableName}.deleted_at IS NULL`,

  // Agregador de filtro a query
  apply: (query, tableName = 'main') => {
    const filter = `${tableName}.deleted_at IS NULL`;
    if (query.includes('WHERE')) {
      return query.replace('WHERE', `WHERE ${filter} AND`);
    }
    return query + ` WHERE ${filter}`;
  },

  // For JOIN queries
  applyFilter: (...tableNames) => {
    return tableNames.map(t => `${t}.deleted_at IS NULL`).join(' AND ');
  }
};

// Soft Delete: Marcar como borrado en lugar de eliminar
const softDelete = async (db, table, id) => {
  const result = await db.query(
    `UPDATE ${table} SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};

// Restaurar soft-deleted item
const restore = async (db, table, id) => {
  const result = await db.query(
    `UPDATE ${table} SET deleted_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};

module.exports = {
  softDeleteFilter,
  softDelete,
  restore
};
