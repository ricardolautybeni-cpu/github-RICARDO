const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

/**
 * POST /api/sync/batch-sales
 * Procesar múltiples ventas en una transacción atómica
 * Previene duplicados usando batch_id (sync_id del móvil)
 */
router.post('/batch-sales', authMiddleware, async (req, res) => {
  const { batch_id, sales } = req.body;

  if (!batch_id || !Array.isArray(sales) || sales.length === 0) {
    return res.status(400).json({
      error: 'batch_id (string) y sales (array) son requeridos'
    });
  }

  const client = await db.connect();

  try {
    // Verificar si batch ya fue procesado (prevenir duplicados)
    const existingBatch = await db.query(
      'SELECT * FROM sync_batches WHERE batch_id = $1 AND user_id = $2',
      [batch_id, req.user.id]
    );

    if (existingBatch.rows.length > 0 && existingBatch.rows[0].status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Batch ya fue procesado previamente',
        batch: existingBatch.rows[0],
        skipProcessing: true
      });
    }

    // Iniciar transacción
    await client.query('BEGIN');

    // Registrar batch como "processing"
    const batchRecord = await client.query(
      `INSERT INTO sync_batches (id, user_id, batch_id, sales_count, status) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (batch_id) DO UPDATE SET status = 'processing'
       RETURNING *`,
      [uuidv4(), req.user.id, batch_id, sales.length, 'processing']
    );

    const procesedSales = [];
    const errors = [];

    // Procesar cada venta
    for (const sale of sales) {
      try {
        const { items, client_id, payment_method, notes, force_pending } = sale;

        if (!items || items.length === 0) {
          throw new Error('Sale debe tener items');
        }

        // Validar stock
        let hasStockIssue = false;
        const stockIssues = [];

        for (const item of items) {
          const productResult = await client.query(
            'SELECT stock FROM products WHERE id = $1 AND deleted_at IS NULL',
            [item.product_id]
          );

          if (productResult.rows.length === 0) {
            throw new Error(`Product ${item.product_id} not found`);
          }

          const available = productResult.rows[0].stock;
          if (item.quantity > available && !force_pending) {
            hasStockIssue = true;
            stockIssues.push({
              product_id: item.product_id,
              requested: item.quantity,
              available
            });
          }
        }

        // Crear venta
        const saleId = uuidv4();
        let totalAmount = 0;
        let totalCost = 0;

        for (const item of items) {
          const productResult = await client.query(
            'SELECT price, cost FROM products WHERE id = $1 AND deleted_at IS NULL',
            [item.product_id]
          );

          const { price, cost } = productResult.rows[0];
          const itemTotal = price * item.quantity;
          totalAmount += itemTotal;
          totalCost += (cost || price * 0.6) * item.quantity;

          // Insertar sale item
          await client.query(
            `INSERT INTO sale_items (id, sale_id, product_id, quantity, bonus, unit_price, subtotal) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [uuidv4(), saleId, item.product_id, item.quantity, item.bonus || 0, price, itemTotal]
          );

          // Deducir stock (parcial si es necesario)
          const deductQty = Math.min(item.quantity, (await client.query(
            'SELECT stock FROM products WHERE id = $1',
            [item.product_id]
          )).rows[0].stock);

          await client.query(
            'UPDATE products SET stock = stock - $1 WHERE id = $2',
            [deductQty, item.product_id]
          );
        }

        // Insertar venta
        const saleStatus = hasStockIssue ? 'pending_approval' : 'completed';
        await client.query(
          `INSERT INTO sales (id, user_id, client_id, total_amount, total_cost, payment_method, status, notes, synced_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [saleId, req.user.id, client_id || null, totalAmount, totalCost, payment_method || 'cash', saleStatus, notes || '']
        );

        procesedSales.push({
          saleId,
          status: saleStatus,
          amount: totalAmount,
          stockIssues: hasStockIssue ? stockIssues : null
        });
      } catch (error) {
        errors.push({
          sale,
          error: error.message
        });
      }
    }

    // Actualizar estado del batch
    let finalStatus = errors.length === 0 ? 'completed' : 'failed';
    if (errors.length > 0 && procesedSales.length > 0) {
      finalStatus = 'completed'; // Parcial
    }

    await client.query(
      `UPDATE sync_batches 
       SET status = $1, error_message = $2 
       WHERE batch_id = $3`,
      [finalStatus, errors.length > 0 ? JSON.stringify(errors) : null, batch_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      batchId: batch_id,
      status: finalStatus,
      totalSalesProcessed: procesedSales.length,
      totalErrors: errors.length,
      processedSales,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/sync/batch-status/:batchId
 * Verificar estado del batch
 */
router.get('/batch-status/:batchId', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM sync_batches WHERE batch_id = $1 AND user_id = $2',
      [req.params.batchId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const batch = result.rows[0];
    res.json({
      batchId: batch.batch_id,
      status: batch.status,
      salesCount: batch.sales_count,
      syncedAt: batch.synced_at,
      errorMessage: batch.error_message ? JSON.parse(batch.error_message) : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
