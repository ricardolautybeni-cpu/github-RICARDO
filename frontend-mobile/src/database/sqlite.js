import SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('distribuidora.db');

export const initDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Tabla de productos (cache local)
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE,
          name TEXT,
          description TEXT,
          price REAL,
          stock INTEGER,
          category_name TEXT,
          synced_at TEXT
        );`
      );

      // Tabla de clientes
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT,
          document_number TEXT,
          email TEXT,
          phone TEXT,
          synced_at TEXT
        );`
      );

      // Tabla de ventas locales
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          client_id TEXT,
          total_amount REAL,
          payment_method TEXT,
          notes TEXT,
          synced INTEGER DEFAULT 0,
          created_at TEXT
        );`
      );

      // Tabla de items de venta
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS sale_items (
          id TEXT PRIMARY KEY,
          sale_id TEXT,
          product_id TEXT,
          quantity INTEGER,
          bonus INTEGER,
          unit_price REAL,
          subtotal REAL,
          FOREIGN KEY(sale_id) REFERENCES sales(id)
        );`
      );

      // Tabla de historial de clientes
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS client_history (
          id TEXT PRIMARY KEY,
          client_id TEXT,
          product_id TEXT,
          product_name TEXT,
          quantity INTEGER,
          created_at TEXT,
          FOREIGN KEY(client_id) REFERENCES clients(id)
        );`
      );
    }, reject, resolve);
  });
};

export default db;
