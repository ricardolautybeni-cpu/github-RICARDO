const db = require('./connection.js');

const migrations = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de usuarios (vendedores)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'seller', -- 'seller', 'admin'
  image_url VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  stock DECIMAL(12,3) DEFAULT 0,
  min_stock DECIMAL(12,3) DEFAULT 0,
  image_url VARCHAR(255),
  unit_type VARCHAR(50) DEFAULT 'units', -- 'units', 'kilos', 'liters', 'meters'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  document_type VARCHAR(50), -- 'dni', 'ruc', 'cuit'
  document_number VARCHAR(50),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  credit_limit DECIMAL(10,2) DEFAULT 0,
  current_debt DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de ventas
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  client_id UUID REFERENCES clients(id),
  total_amount DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2),
  payment_method VARCHAR(50) DEFAULT 'cash', -- 'cash', 'card', 'transfer'
  status VARCHAR(50) DEFAULT 'completed', -- 'draft', 'completed', 'cancelled'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de items de venta
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity BIGINT NOT NULL,
  bonus BIGINT DEFAULT 0, -- bonificación
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  movement_type VARCHAR(50), -- 'entrada', 'salida', 'ajuste'
  quantity BIGINT NOT NULL,
  reason TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de devoluciones
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id),
  user_id UUID REFERENCES users(id),
  reason VARCHAR(255),
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'rejected'
  total_amount DECIMAL(10,2),
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP,
  rejected_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de items de devolución
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity BIGINT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de notas de crédito
CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id),
  product_id UUID REFERENCES products(id),
  quantity BIGINT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de ubicaciones de vendedores
CREATE TABLE IF NOT EXISTS seller_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  accuracy DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de rutas de visitas
CREATE TABLE IF NOT EXISTS sales_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de paradas en rutas
CREATE TABLE IF NOT EXISTS route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES sales_routes(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  sequence INTEGER NOT NULL,
  visited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de alertas de stock
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  threshold_type VARCHAR(50) DEFAULT 'minimum', -- 'minimum', 'custom'
  custom_threshold BIGINT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de pagos de clientes
CREATE TABLE IF NOT EXISTS client_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50), -- 'cash', 'card', 'transfer'
  reference VARCHAR(255),
  notes TEXT,
  registered_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'registered',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Tabla de documentos generados (facturas, reportes)
CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id),
  document_type VARCHAR(50), -- 'invoice', 'report', 'credit_note'
  filename VARCHAR(255) NOT NULL,
  generated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sincronización de batches (prevención de duplicados)
CREATE TABLE IF NOT EXISTS sync_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  batch_id VARCHAR(255) NOT NULL UNIQUE, -- ID único del móvil
  sales_count INTEGER,
  status VARCHAR(50) DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  error_message TEXT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de check-in/out para logística
CREATE TABLE IF NOT EXISTS seller_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  client_id UUID REFERENCES clients(id),
  check_in_at TIMESTAMP NOT NULL,
  check_out_at TIMESTAMP,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  notes TEXT,
  signature_data TEXT, -- Base64 de firma digital
  visit_result VARCHAR(100), -- 'sale', 'closed', 'no_stock', 'no_money', 'not_interested', 'other'
  visit_reason_notes TEXT, -- Notas sobre por qué no compró
  photo_url VARCHAR(255), -- Foto de prueba de visita
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_deleted ON sales(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_deleted ON sale_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_clients_document ON clients(document_number);
CREATE INDEX IF NOT EXISTS idx_clients_deleted ON clients(deleted_at);
CREATE INDEX IF NOT EXISTS idx_seller_locations_user ON seller_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_deleted ON route_stops(deleted_at);
CREATE INDEX IF NOT EXISTS idx_returns_sale ON returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_deleted ON returns(deleted_at);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_client ON client_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_deleted ON client_payments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_generated_documents_sale ON generated_documents(sale_id);
CREATE INDEX IF NOT EXISTS idx_sync_batches_user_batch ON sync_batches(user_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_seller_checkins_user ON seller_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_checkins_client ON seller_checkins(client_id);
CREATE INDEX IF NOT EXISTS idx_seller_checkins_deleted ON seller_checkins(deleted_at);

-- Tabla de refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Tabla de auditoría (historial de cambios)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'view'
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Tabla de liquidación diaria (rendición)
CREATE TABLE IF NOT EXISTS daily_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  settlement_date DATE NOT NULL,
  total_sales DECIMAL(12,2) DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,
  total_margin DECIMAL(12,2) DEFAULT 0,
  total_collected_cash DECIMAL(12,2) DEFAULT 0,
  total_collected_transfer DECIMAL(12,2) DEFAULT 0,
  total_expenses DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2) DEFAULT 0, -- total_collected - total_expenses
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'submitted', 'approved', 'rejected'
  submitted_at TIMESTAMP,
  submitted_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_settlements_user ON daily_settlements(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_settlements_date ON daily_settlements(settlement_date);
CREATE INDEX IF NOT EXISTS idx_daily_settlements_status ON daily_settlements(status);

-- Tabla de historial de precios
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  price_before DECIMAL(10,2) NOT NULL,
  price_after DECIMAL(10,2) NOT NULL,
  cost_before DECIMAL(10,2),
  cost_after DECIMAL(10,2),
  margin_change DECIMAL(10,2),
  reason VARCHAR(255),
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created ON price_history(created_at);

-- Tabla de gastos de vendedor
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  expense_type VARCHAR(100) NOT NULL, -- 'fuel', 'food', 'repairs', 'supplies', 'other'
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  receipt_url VARCHAR(255),
  expense_date DATE NOT NULL,
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(deleted_at);
`;

async function runMigrations() {
  try {
    const statements = migrations.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await db.query(statement);
      }
    }
    console.log('✅ Migraciones completadas');
  } catch (error) {
    console.error('❌ Error en migraciones:', error);
  }
}

runMigrations().then(() => process.exit(0));
