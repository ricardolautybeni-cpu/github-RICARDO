const db = require('../db/connection');

/**
 * Servicio para manejar transacciones con BEGIN/COMMIT/ROLLBACK
 * Garantiza que múltiples operaciones ocurran todas o ninguna
 */

class TransactionService {
  /**
   * Crear una venta con actualización atomic de stock
   * Si falla descuento de stock, toda la venta se revierte
   */
  static async createSaleWithStockUpdate(saleData, saleItems, userId) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // 1. Validar que todo el stock está disponible ANTES de crear venta
      for (const item of saleItems) {
        const productResult = await client.query(
          `SELECT stock FROM products WHERE id = $1 AND deleted_at IS NULL`,
          [item.product_id]
        );

        if (productResult.rows.length === 0) {
          throw new Error(`Producto ${item.product_id} no existe`);
        }

        const currentStock = parseFloat(productResult.rows[0].stock);
        if (currentStock < parseFloat(item.quantity)) {
          throw new Error(
            `Stock insuficiente para ${item.product_id}. Disponible: ${currentStock}, Solicitado: ${item.quantity}`
          );
        }
      }

      // 2. Crear la venta
      const saleId = require('uuid').v4();
      const totalAmount = saleItems.reduce((sum, item) => 
        sum + (parseFloat(item.quantity) * parseFloat(item.unit_price)), 0
      );

      const saleResult = await client.query(`
        INSERT INTO sales (id, user_id, client_id, total_amount, total_cost, payment_method, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'completed', NOW())
        RETURNING id
      `, [saleId, userId, saleData.client_id, totalAmount, saleData.total_cost, saleData.payment_method]);

      // 3. Crear items de venta
      for (const item of saleItems) {
        await client.query(`
          INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [saleId, item.product_id, item.quantity, item.unit_price, 
            parseFloat(item.quantity) * parseFloat(item.unit_price)]);
      }

      // 4. Actualizar stock
      for (const item of saleItems) {
        // Reducir stock
        await client.query(`
          UPDATE products 
          SET stock = stock - $1,
              updated_at = NOW()
          WHERE id = $2
        `, [item.quantity, item.product_id]);

        // Registrar movimiento de inventario
        await client.query(`
          INSERT INTO inventory_movements 
          (product_id, movement_type, quantity, reason, user_id, created_at)
          VALUES ($1, 'salida', $2, $3, $4, NOW())
        `, [item.product_id, item.quantity, `Venta ${saleId}`, userId]);
      }

      // 5. Actualizar deuda del cliente si se vendió a crédito
      if (saleData.is_credit) {
        await client.query(`
          UPDATE clients 
          SET current_debt = current_debt + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [totalAmount, saleData.client_id]);
      }

      // Confirmar transacción
      await client.query('COMMIT');

      return {
        saleId: saleId,
        status: 'completed',
        totalAmount: totalAmount,
        itemsCount: saleItems.length
      };

    } catch (error) {
      // Revertir TODO si algo falla
      await client.query('ROLLBACK');
      throw new Error(`Transacción fallida: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Procesar devolución atómicamente
   * Revierte stock, crea crédito, actualiza deuda
   */
  static async processReturn(returnData, returnItems, userId) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const returnId = require('uuid').v4();

      // 1. Crear registro de devolución
      const returnResult = await client.query(`
        INSERT INTO returns 
        (id, sale_id, user_id, reason, status, total_amount, created_at)
        VALUES ($1, $2, $3, $4, 'approved', $5, NOW())
        RETURNING id
      `, [returnId, returnData.sale_id, userId, returnData.reason, returnData.total_amount]);

      // 2. Crear items de devolución
      for (const item of returnItems) {
        await client.query(`
          INSERT INTO return_items (return_id, product_id, quantity, unit_price, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [returnId, item.product_id, item.quantity, item.unit_price]);
      }

      // 3. Restaurar stock
      for (const item of returnItems) {
        await client.query(`
          UPDATE products 
          SET stock = stock + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [item.quantity, item.product_id]);

        // Registrar movimiento de inventario
        await client.query(`
          INSERT INTO inventory_movements 
          (product_id, movement_type, quantity, reason, user_id, created_at)
          VALUES ($1, 'entrada', $2, $3, $4, NOW())
        `, [item.product_id, item.quantity, `Devolución ${returnId}`, userId]);
      }

      // 4. Crear nota de crédito
      for (const item of returnItems) {
        await client.query(`
          INSERT INTO credit_notes 
          (return_id, product_id, quantity, unit_price, total_amount, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [returnId, item.product_id, item.quantity, item.unit_price,
            parseFloat(item.quantity) * parseFloat(item.unit_price)]);
      }

      // 5. Reducir deuda del cliente por crédito
      await client.query(`
        UPDATE clients 
        SET current_debt = GREATEST(0, current_debt - $1),
            updated_at = NOW()
        WHERE id = (SELECT client_id FROM sales WHERE id = $2)
      `, [returnData.total_amount, returnData.sale_id]);

      await client.query('COMMIT');

      return {
        returnId: returnId,
        status: 'approved',
        crediteAmount: returnData.total_amount
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Devolución fallida: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Procesar pago de cliente atómicamente
   * Reduce deuda, registra pago, actualiza cliente
   */
  static async processClientPayment(paymentData, userId) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const paymentId = require('uuid').v4();

      // 1. Validar que la deuda es suficiente
      const clientResult = await client.query(`
        SELECT current_debt FROM clients WHERE id = $1
      `, [paymentData.client_id]);

      if (clientResult.rows.length === 0) {
        throw new Error('Cliente no existe');
      }

      const currentDebt = parseFloat(clientResult.rows[0].current_debt);
      if (parseFloat(paymentData.amount) > currentDebt) {
        throw new Error(`Monto ${paymentData.amount} excede deuda actual ${currentDebt}`);
      }

      // 2. Registrar pago
      await client.query(`
        INSERT INTO client_payments 
        (id, client_id, amount, payment_method, reference, registered_by, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'registered', NOW())
      `, [paymentId, paymentData.client_id, paymentData.amount, 
          paymentData.payment_method, paymentData.reference, userId]);

      // 3. Reducir deuda del cliente
      await client.query(`
        UPDATE clients 
        SET current_debt = current_debt - $1,
            updated_at = NOW()
        WHERE id = $2
      `, [paymentData.amount, paymentData.client_id]);

      await client.query('COMMIT');

      return {
        paymentId: paymentId,
        status: 'registered',
        amountPaid: paymentData.amount,
        newDebt: currentDebt - parseFloat(paymentData.amount)
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Pago fallido: ${error.message}`);
    } finally {
      client.release();
    }
  }
}

module.exports = TransactionService;
