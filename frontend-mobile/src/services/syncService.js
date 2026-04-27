import db from './sqlite';
import { v4 as uuidv4 } from 'uuid';

// Guardar productos en cache local
export const saveProductsLocal = async (products) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      products.forEach(product => {
        tx.executeSql(
          `INSERT OR REPLACE INTO products (id, code, name, description, price, stock, category_name, synced_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.id,
            product.code,
            product.name,
            product.description,
            product.price,
            product.stock,
            product.category_name,
            new Date().toISOString()
          ]
        );
      });
    }, reject, resolve);
  });
};

// Buscar productos locales
export const searchProductsLocal = async (query) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM products WHERE code LIKE ? OR name LIKE ? OR description LIKE ?`,
        [`%${query}%`, `%${query}%`, `%${query}%`],
        (_, result) => resolve(result.rows._array),
        (_, error) => reject(error)
      );
    });
  });
};

// Crear venta local
export const createSaleLocal = async (clientId, items, paymentMethod) => {
  const saleId = uuidv4();
  
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      let totalAmount = 0;
      
      items.forEach(item => {
        totalAmount += item.subtotal;
        tx.executeSql(
          `INSERT INTO sale_items (id, sale_id, product_id, quantity, bonus, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), saleId, item.product_id, item.quantity, item.bonus || 0, item.unit_price, item.subtotal]
        );
        
        // Descontar stock local
        tx.executeSql(
          `UPDATE products SET stock = stock - ? WHERE id = ?`,
          [item.quantity, item.product_id]
        );
        
        // Guardar en historial del cliente
        tx.executeSql(
          `INSERT INTO client_history (id, client_id, product_id, product_name, quantity, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), clientId, item.product_id, item.product_name, item.quantity, new Date().toISOString()]
        );
      });
      
      tx.executeSql(
        `INSERT INTO sales (id, client_id, total_amount, payment_method, synced, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [saleId, clientId, totalAmount, paymentMethod, 0, new Date().toISOString()]
      );
    }, reject, () => resolve(saleId));
  });
};

// Obtener ventas no sincronizadas
export const getUnsyncedSales = async () => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT s.*, GROUP_CONCAT(
          json_object('id', si.id, 'product_id', si.product_id, 'quantity', si.quantity, 'bonus', si.bonus, 'unit_price', si.unit_price, 'subtotal', si.subtotal)
        ) as items_json
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.synced = 0
        GROUP BY s.id`,
        [],
        (_, result) => {
          const sales = result.rows._array.map(sale => ({
            ...sale,
            items: sale.items_json ? JSON.parse(`[${sale.items_json}]`) : []
          }));
          resolve(sales);
        },
        (_, error) => reject(error)
      );
    });
  });
};

// Marcar venta como sincronizada
export const markSaleSynced = async (saleId) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE sales SET synced = 1 WHERE id = ?`,
        [saleId]
      );
    }, reject, resolve);
  });
};

export default {
  saveProductsLocal,
  searchProductsLocal,
  createSaleLocal,
  getUnsyncedSales,
  markSaleSynced
};
