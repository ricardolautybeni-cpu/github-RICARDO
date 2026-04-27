const db = require('../db/connection');

/**
 * Predecir cuántos días faltan antes de Stock Out
 * Basado en: Salida promedio diaria vs stock actual
 */
async function predictStockOut(productId, lookbackDays = 30) {
  try {
    // Obtener datos del producto
    const productResult = await db.query(
      'SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new Error('Producto no encontrado');
    }

    const product = productResult.rows[0];
    const currentStock = product.stock;

    // Calcular salida promedio de los últimos X días
    const salesResult = await db.query(
      `SELECT 
        COUNT(DISTINCT DATE(created_at)) as days_with_sales,
        SUM(quantity) as total_sold
       FROM sale_items si
       WHERE si.product_id = $1 
       AND si.created_at >= NOW() - INTERVAL '${lookbackDays} days'
       AND si.deleted_at IS NULL`,
      [productId]
    );

    const { days_with_sales, total_sold } = salesResult.rows[0];
    const totalSold = parseFloat(total_sold || 0);
    const daysWithSales = parseInt(days_with_sales || 1);

    // Si no hay ventas, retornar sin predicción
    if (totalSold === 0) {
      return {
        productId,
        productName: product.name,
        currentStock,
        minStock: product.min_stock,
        prediction: null,
        message: 'Sin datos de venta en el período'
      };
    }

    // Salida diaria promedio
    const avgDailySale = totalSold / daysWithSales;

    // Si salida promedio es 0, no hay riesgo
    if (avgDailySale === 0) {
      return {
        productId,
        productName: product.name,
        currentStock,
        minStock: product.min_stock,
        prediction: null,
        message: 'Sin salidas registradas'
      };
    }

    // Días hasta stock out (llegara a 0)
    const daysUntilStockOut = Math.ceil(currentStock / avgDailySale);

    // Días hasta stock mínimo (llegará a min_stock)
    const stockAboveMinimum = currentStock - product.min_stock;
    const daysUntilMinStock = Math.ceil(stockAboveMinimum / avgDailySale);

    // Generar alerta si es inminente (menos de 7 días)
    const hasAlert = daysUntilStockOut <= 7;

    return {
      productId,
      productName: product.name,
      code: product.code,
      currentStock,
      minStock: product.min_stock,
      avgDailySale: parseFloat(avgDailySale.toFixed(2)),
      lookbackDays,
      prediction: {
        daysUntilStockOut,
        daysUntilMinStock,
        estimatedStockOutDate: calculateFutureDate(daysUntilStockOut),
        estimatedMinStockDate: calculateFutureDate(daysUntilMinStock)
      },
      hasAlert,
      recommendation:
        daysUntilStockOut <= 3
          ? '🚨 URGENTE: Realizar pedido inmediatamente'
          : daysUntilStockOut <= 7
          ? '⚠️ ALERTA: Realizar pedido esta semana'
          : daysUntilMinStock <= 3
          ? '📌 Considerar pedido en próximos días'
          : '✅ Stock normal'
    };
  } catch (error) {
    throw new Error(`Error en predicción: ${error.message}`);
  }
}

/**
 * Análisis de inventario para múltiples productos críticos
 */
async function analyzeInventoryRisk() {
  try {
    // Obtener productos que están bajo min_stock
    const criticalResult = await db.query(
      `SELECT id FROM products 
       WHERE deleted_at IS NULL AND stock < min_stock
       ORDER BY stock ASC
       LIMIT 20`
    );

    const predictions = [];
    for (const row of criticalResult.rows) {
      const prediction = await predictStockOut(row.id);
      if (prediction.hasAlert) {
        predictions.push(prediction);
      }
    }

    // Ordenar por urgencia (días hasta stock out)
    predictions.sort((a, b) => {
      const aDays = a.prediction?.daysUntilStockOut || 999;
      const bDays = b.prediction?.daysUntilStockOut || 999;
      return aDays - bDays;
    });

    return {
      totalAlerts: predictions.length,
      urgentAlerts: predictions.filter(p => p.prediction.daysUntilStockOut <= 3).length,
      predictions
    };
  } catch (error) {
    throw new Error(`Error en análisis: ${error.message}`);
  }
}

/**
 * Calcular fecha futura
 */
function calculateFutureDate(days) {
  const future = new Date();
  future.setDate(future.getDate() + days);
  return future.toISOString().split('T')[0];
}

module.exports = {
  predictStockOut,
  analyzeInventoryRisk
};
