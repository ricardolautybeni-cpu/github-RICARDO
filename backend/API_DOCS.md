# 📱 Distribuidora Multi-Rubro POS - Backend API

Sistema de punto de venta para distribuidora con gestión de inventario, ventas, geolocalización y reportes.

---

## 🚀 QUICK START

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales BD

# 3. Ejecutar migraciones (crear tablas)
npm run migrate

# 4. Ejecutar seed (datos iniciales, opcional)
npm run seed

# 5. Iniciar servidor
npm run dev  # desarrollo con nodemon
npm start    # producción
```

**Servidor disponible en**: `http://localhost:3001`

---

## 📚 ENDPOINTS PRINCIPALES

### 🔐 AUTENTICACIÓN

#### POST `/api/auth/register`
Registrar nuevo usuario
```json
{
  "email": "vendedor@example.com",
  "password": "Seguro123",
  "full_name": "Juan García",
  "role": "seller"
}
```
**Respuesta**: `{ user, accessToken, refreshToken }`

#### POST `/api/auth/login`
Iniciar sesión
```json
{
  "email": "vendedor@example.com",
  "password": "Seguro123"
}
```
**Respuesta**: `{ user, accessToken, refreshToken }`

#### POST `/api/auth/refresh`
Renovar token de acceso
```json
{
  "refreshToken": "eyJhbGc..."
}
```
**Respuesta**: `{ accessToken, refreshToken }`

#### POST `/api/auth/logout`
Cerrar sesión (revoca token)
```json
{
  "refreshToken": "eyJhbGc..."
}
```

---

### 📦 PRODUCTOS

#### GET `/api/products`
Obtener catálogo de productos con paginación
```
?page=1&limit=50&search=arroz&category_id=uuid&in_stock=true
```
**Respuesta**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 500,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### GET `/api/products/code/:code`
Obtener producto por código

#### POST `/api/products`
Crear nuevo producto (validación Joi)
```json
{
  "code": "ARZ-001",
  "name": "Arroz Integral 5kg",
  "description": "Grano seleccionado",
  "category_id": "uuid",
  "price": 450.00,
  "cost": 280.00,
  "min_stock": 20
}
```

---

### 🧾 VENTAS

#### POST `/api/sales`
Crear venta
```json
{
  "client_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 5,
      "bonus": 1
    }
  ],
  "payment_method": "cash",
  "notes": "Entrega a domicilio",
  "force_pending": false
}
```
**Respuesta especial (202)** si stock es insuficiente:
```json
{
  "status": "pending_approval",
  "stock_issues": [
    {
      "product_id": "uuid",
      "requested": 10,
      "available": 5
    }
  ]
}
```

#### GET `/api/sales`
Obtener ventas con filtros
```
?page=1&limit=50&user_id=uuid&client_id=uuid&start_date=2024-01-01&end_date=2024-12-31
```

#### GET `/api/sales/:saleId`
Obtener detalles de una venta

---

### 🗺️ GEOLOCALIZACIÓN

#### POST `/api/geolocation/location`
Registrar ubicación actual
```json
{
  "latitude": -34.6037,
  "longitude": -58.3816,
  "accuracy": 10.5
}
```

#### GET `/api/geolocation/location/current`
Obtener ubicación actual del vendedor

#### GET `/api/geolocation/routes/:userId/today`
Ver trayecto del día

#### GET `/api/geolocation/clients/nearby`
Obtener clientes cercanos
```
?latitude=-34.6037&longitude=-58.3816&radiusKm=5
```

---

### 🛣️ RUTAS DE VISITA

#### POST `/api/geolocation/routes`
Crear ruta de visitas
```json
{
  "name": "Zona Centro",
  "description": "Clientes centro de ciudad",
  "client_ids": ["uuid1", "uuid2", "uuid3"]
}
```

#### GET `/api/geolocation/routes`
Obtener rutas del vendedor

#### GET `/api/geolocation/routes/:routeId/stops`
Ver paradas de una ruta

#### POST `/api/geolocation/routes/:routeId/stops/:stopId/visited`
Marcar parada como visitada

---

### ↩️ DEVOLUCIONES

#### POST `/api/returns`
Crear devolución
```json
{
  "sale_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2
    }
  ],
  "reason": "Producto defectuoso",
  "notes": "Se observó daño en embalaje"
}
```
**Respuesta**: Estado `pending_approval` (requiere aprobación admin)

#### GET `/api/returns`
Obtener devoluciones
```
?page=1&status=pending_approval&sale_id=uuid
```

#### GET `/api/returns/:returnId/items`
Items devueltos

#### GET `/api/returns/:returnId/credit-notes`
Notas de crédito asociadas

#### POST `/api/returns/:returnId/approve`
Aprobar devolución (solo admin)

#### POST `/api/returns/:returnId/reject`
Rechazar devolución
```json
{
  "reason": "No aplica cambio"
}
```

---

### 📊 ALERTAS DE STOCK

#### GET `/api/stock-alerts/critical`
Productos con stock bajo
**Respuesta**:
```json
{
  "criticalProductsCount": 12,
  "products": [
    {
      "id": "uuid",
      "name": "Arroz",
      "stock": 5,
      "min_stock": 20,
      "units_below_minimum": 15,
      "stock_coverage_percent": 25.0
    }
  ]
}
```

#### GET `/api/stock-alerts/alerts/active`
Alertas activas configuradas

#### POST `/api/stock-alerts/alerts`
Crear alerta de stock
```json
{
  "product_id": "uuid",
  "threshold_type": "custom",
  "custom_threshold": 30
}
```

#### GET `/api/stock-alerts/dashboard`
Dashboard ejecutivo
```json
{
  "summary": {
    "criticalProductsCount": 5,
    "totalInventoryValue": 125000.50,
    "last24hMovements": [...]
  },
  "topProducts": [...]
}
```

---

### 💳 CUENTAS CORRIENTES

#### GET `/api/accounts/:clientId/statement`
Estado de cuenta cliente
```
?startDate=2024-01-01&endDate=2024-12-31
```
**Respuesta**:
```json
{
  "client": {...},
  "creditLimit": 10000,
  "currentDebt": 2500,
  "availableCredit": 7500,
  "transactions": [
    {
      "id": "uuid",
      "type": "sale",
      "amount": 500,
      "running_balance": 2500,
      "created_at": "2024-01-15"
    }
  ]
}
```

#### POST `/api/accounts/:clientId/payments`
Registrar pago
```json
{
  "amount": 1000,
  "payment_method": "transfer",
  "reference": "TRF-001",
  "notes": "Pago parcial"
}
```

#### GET `/api/accounts`
Listar clientes con deuda
```
?hasDebt=true&page=1&limit=50
```

#### PATCH `/api/accounts/:clientId/credit-limit`
Actualizar límite de crédito
```json
{
  "creditLimit": 15000
}
```

#### GET `/api/accounts/summary/all`
Resumen de cuentas corrientes
```json
{
  "summary": {
    "total_clients": 150,
    "clients_with_debt": 45,
    "total_receivable": 125000,
    "avg_debt_per_client": 2777.78
  },
  "topDebtors": [...]
}
```

---

### 📄 INVOICES & REPORTES

#### POST `/api/invoices/:saleId/generate`
Generar factura en PDF

#### GET `/api/invoices/:filename`
Descargar factura

#### POST `/api/invoices/reports/generate`
Generar reporte de ventas
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "format": "pdf"
}
```

---

## 🔌 WEBSOCKET (Tiempo Real)

Conexión WebSocket para dashboard en tiempo real

```javascript
const socket = io('http://localhost:3001', {
  auth: { token: 'accessToken' }
});

// Escuchar eventos
socket.on('sale:notification', (data) => console.log('Nueva venta:', data));
socket.on('stock:alert', (data) => console.log('Stock bajo:', data));
socket.on('seller:location', (data) => console.log('Ubicación:', data));

// Emitir eventos
socket.emit('sale:created', saleData);
socket.emit('stock:critical', productData);
socket.emit('location:update', { latitude, longitude });
```

---

## 🛡️ AUTENTICACIÓN

Todos los endpoints (excepto `/register` y `/login`) requieren:

```
Authorization: Bearer <accessToken>
```

Los tokens tienen corta duración:
- **accessToken**: 15 minutos
- **refreshToken**: 7 días (almacenado en BD)

---

## 🧪 VALIDACIONES (Joi)

Todas las solicitudes se validan automáticamente:

```json
{
  "error": "Validación fallida",
  "details": [
    {
      "field": "email",
      "message": "\"email\" debe ser un email válido"
    }
  ]
}
```

---

## 📱 CLIENTES (Futuros)

- **Mobile**: React Native + Expo (con SQLite local)
- **Web**: React Dashboard (Recharts, Zustand)

---

## �️ MEJORAS DE PRODUCCIÓN (Blindaje del Sistema)

### Sincronización con Batch Processing

#### POST `/api/sync/batch-sales`
Procesar múltiples ventas en una transacción atómica (previene duplicados)

```json
{
  "batch_id": "mobile_30042026_134525",
  "sales": [
    {
      "client_id": "uuid",
      "items": [{"product_id": "uuid", "quantity": 5, "bonus": 1}],
      "payment_method": "cash"
    }
  ]
}
```

**Respuesta**: Status `202 (pending_approval)` o `201 (completado)`
- `batchId`: ID único del móvil
- `status`: processing | completed | failed
- `processedSales`: Array de ventas procesadas
- **PREVIENE DUPLICADOS**: Si envías el mismo batch_id dos veces, el servidor lo detecta

#### GET `/api/sync/batch-status/:batchId`
Ver estado del batch procesado

---

### 🧮 Cobranzas y Logística

#### POST `/api/collections/check-in`
Registrar check-in en cliente (inicio de visita)

```json
{
  "client_id": "uuid",
  "latitude": -34.6037,
  "longitude": -58.3816,
  "notes": "Cliente en casa"
}
```

**Respuesta**:
```json
{
  "checkInId": "uuid",
  "client": {
    "creditLimit": 10000,
    "currentDebt": 2500,
    "canProceedWithSale": true,
    "warning": null
  }
}
```

#### POST `/api/collections/check-out/:checkInId`
Marcar fin de visita

```json
{
  "notes": "Visitado, pago parcial",
  "signature_data": "data:image/png;base64,..."
}
```

**Respuesta**: Duración de visita en minutos

#### POST `/api/collections/payment`
Registrar cobro en cliente

```json
{
  "client_id": "uuid",
  "amount": 500.50,
  "payment_method": "cash",
  "reference": "TRF-001",
  "notes": "Pago parcial"
}
```

**Respuesta**: Recibo con deuda actualizada

#### GET `/api/collections/daily-summary`
Resumen del día: cobros, visitas, deudores

**Respuesta**:
```json
{
  "visits": {"total": 8, "avgDurationMinutes": 35},
  "payments": {"total": 4, "collectedAmount": 2500},
  "sales": {"total": 12, "amount": 45000},
  "topClients": [...]
}
```

#### GET `/api/collections/overdue-clients`
Clientes con facturas vencidas (>30 días)

---

### 📄 Firma Digital y Recibos

#### POST `/api/receipts/generate-payment`
Generar recibo PDF CON FIRMA DIGITAL incr ustada

```json
{
  "payment_id": "uuid",
  "signature_base64": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Respuesta**: URL de PDF con firma

#### POST `/api/receipts/save-signature`
Guardar firma sin generar recibo (preview)

---

### 🔮 Predicción de Stock Out

#### GET `/api/predictions/product/:productId`
Predecir cuántos días faltan antes de agotar stock

```
?lookbackDays=30
```

**Respuesta**:
```json
{
  "currentStock": 45,
  "minStock": 50,
  "avgDailySale": 3.5,
  "prediction": {
    "daysUntilStockOut": 13,
    "daysUntilMinStock": 8,
    "estimatedStockOutDate": "2026-05-04",
    "estimatedMinStockDate": "2026-04-29"
  },
  "hasAlert": true,
  "recommendation": "📌 Considerar pedido en próximos días"
}
```

#### GET `/api/predictions/risk-analysis`
Análisis de todos los productos en riesgo

**Respuesta**:
```json
{
  "analysis": {
    "totalAlerts": 8,
    "urgentAlerts": 2,
    "predictions": [...]
  },
  "summary": {
    "message": "🚨 2 producto(s) en riesgo CRÍTICO",
    "actionRequired": true
  }
}
```

---

### 🔐 Token Rotation (Seguridad Mejorada)

El endpoint `/api/auth/refresh` ahora implementa **Token Rotation**:

1. **Antes**: Cada refresh generaba un nuevo token pero se guardaban todos
2. **Ahora**: Cada refresh INVALIDA el token anterior automáticamente

Si alguien intenta usar un token antiguo (después de refresh), el sistema detecta intento de robo y cierra TODAS las sesiones del usuario:

```json
{
  "error": "Refresh token inválido. Todas las sesiones han sido cerradas.",
  "securityAlert": true
}
```

---

## 🗄️ Soft Deletes (Historial Indestructible)

**Nunca se borran datos**. Todas las tablas principales ahora tienen columna `deleted_at`:

```sql
-- Soft delete (no destructivo)
UPDATE products SET deleted_at = NOW() WHERE id = '...'

-- Todas las queries automáticamente filtran:
WHERE deleted_at IS NULL
```

**Beneficio**: Tus reportes históricos NUNCA se rompen, incluso si borras un producto.

---

## 🐳 DOCKER (Opcional)

```bash
docker-compose up -d
# PostgreSQL en localhost:5432
```

---

## 📝 NOTAS

- Todas las operaciones de BD usan UUIDs para evitar colisiones
- Stock se valida ANTES de procesar ventas
- Las tasas están en moneda local (sin conversión)
- Los PDFs se guardan en `/backend/pdfs/`
- WebSocket requiere HTTPS en producción
- **Soft Deletes**: Todas las tablas guardan historial permanente
- **Batch Processing**: Evita duplicados en sincronización
- **Token Rotation**: Detecta intentos de robo de tokens
- **Check-in/Check-out**: GPS + firma digital en visitas

---

## ⚙️ Variables de Entorno

Ver `.env.example` para configuración completa.

**Secreto JWT en producción**: Cambiar `JWT_SECRET` por valor seguro.
**DISTRIBUTOR_NAME**: Nombre de tu distribuidora (para recibos)

---

**Última actualización**: 2024 | Autor: Ricardo | Mejoras: Blind aje + Cobranzas + Predicciones
