# 🏗️ Arquitectura y Diseño

## Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                   CLIENTE/VENDEDOR (Móvil)                      │
│                                                                  │
│  1. Escanea código producto  →  2. Ingresa cantidad/bonificación
│  3. Agrega al carrito        →  4. Selecciona cliente
│  5. Presiona "Guardar Venta"                                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼ (Con conexión)            ▼ (Sin conexión)
    
    📤 POST /api/sales         📝 Guardar en SQLite
    (Servidor)                 (Cola local)
        │                           │
        ▼                           │
    Validación                      │
    ├─ Existencia producto          │
    ├─ Stock disponible             │
    ├─ Autenticación                │
        │                           │
        ▼ (OK)                      │
    
    Transacción:                    │
    ├─ Guardar venta              │
    ├─ Guardar items              │
    ├─ Actualizar stock           │
    ├─ Registrar movimiento       │
    └─ Commit                     │
        │                           │
        ▼ (Éxito)                   │
    
    ✅ Respuesta al cliente    ⏳ Espera conexión
    📊 Dashboard se actualiza       │
    📱 Móvil confirma venta        │
                                    │
                    ┌───────────────┘
                    │
        ▼ (Detecta conexión)
        Sincronización automática
        POST /api/sales (ventas pendientes)
        │
        ▼
        ✅ Se sincroniza exitosamente
        Stock se actualiza
        Dashboard se actualiza
```

## Capas de la Aplicación

### 1. Presentación (UI/UX)

#### Mobile (React Native)
```
PosScreen
├─ SearchBar (código)
├─ ProductCard (detalles)
├─ QuantityInput (teclado numérico)
├─ BonusInput (teclado numérico)
├─ Cart (carrito dinámico)
├─ ClientSelector (cliente)
└─ CheckoutButton (guardar)

ClientHistoryScreen
├─ SalesHistory (últimas 3)
├─ SuggestedProducts (IA)
└─ ProductFrequency (análisis)
```

#### Web (React)
```
LoginScreen
├─ EmailInput
├─ PasswordInput
└─ LoginButton

DashboardScreen (Admin)
├─ KPICards (KPIs)
├─ LineChart (ventas/día)
├─ BarChart (top productos)
└─ SalesTable (recientes)

InventoryScreen
├─ FilterButtons
├─ InventoryTable
└─ StockIndicators
```

### 2. Lógica de Negocio

#### Services (Capa de Servicios)

**Mobile:**
```javascript
// API Service
api.js
├─ login()
├─ getProducts()
├─ getProductByCode()
├─ createSale()
├─ getClients()
└─ getClientLastSales()

// Sync Service
syncService.js
├─ saveProductsLocal()
├─ createSaleLocal()
├─ getUnsyncedSales()
├─ markSaleSynced()
└─ syncQueue()
```

**Web:**
```javascript
// API Service
api.js
├─ login()
├─ getProducts()
├─ getSales()
├─ getClients()
└─ getInventory()

// Auth Store (Zustand)
authStore.js
├─ login()
├─ logout()
└─ hydrate()
```

### 3. Datos

#### PostgreSQL (Principal)
```
users
├─ id (UUID)
├─ email (UNIQUE)
├─ password_hash
├─ full_name
└─ role

products
├─ id (UUID)
├─ code (UNIQUE)
├─ name
├─ price
├─ stock
└─ category_id

clients
├─ id (UUID)
├─ name
├─ document_number
├─ email
└─ credit_limit

sales
├─ id (UUID)
├─ user_id → users
├─ client_id → clients
├─ total_amount
└─ created_at

sale_items
├─ id (UUID)
├─ sale_id → sales
├─ product_id → products
├─ quantity
└─ unit_price
```

#### SQLite (Local/Móvil)
```
products (cache)
sales (queue)
sale_items (queue)
clients (cache)
client_history (análisis)
```

## API REST Design

### Estructura de Requests

```javascript
// Auth
POST /api/auth/login
{
  "email": "user@company.com",
  "password": "password"
}

// Products
GET /api/products?search=aceite&category_id=cat-123
GET /api/products/code/AC-001

// Sales
POST /api/sales
{
  "client_id": "cli-123",
  "items": [
    {
      "product_id": "prod-123",
      "quantity": 5,
      "bonus": 1
    }
  ],
  "payment_method": "cash"
}

GET /api/sales?user_id=user-123&start_date=2024-01-01

// Clients
GET /api/clients?search=juan
GET /api/clients/cli-123/last-sales
```

### Estructura de Responses

```javascript
// Success (200)
{
  "id": "uuid",
  "name": "Juan",
  "email": "juan@empresa.com",
  "created_at": "2024-01-20T10:30:00Z"
}

// Error (400)
{
  "error": "Mensaje descriptivo del error"
}

// Auth Error (401)
{
  "error": "No autorizado"
}

// Server Error (500)
{
  "error": "Error interno del servidor"
}
```

## Flujo de Autenticación

```
1. Login
   ├─ Usuario ingresa email/password
   ├─ POST /api/auth/login
   ├─ Server hashea contraseña y compara
   ├─ Si OK → genera JWT
   └─ Responde con token

2. Token Almacenado
   ├─ Mobile: SecureStore (encriptado)
   ├─ Web: localStorage
   └─ Válido por 7 días

3. Requests Subsecuentes
   ├─ Header: Authorization: Bearer <token>
   ├─ Server verifica JWT
   ├─ Si válido → procesa request
   └─ Si inválido → 401

4. Logout
   ├─ Elimina token localmente
   ├─ Session termina
   └─ Login requerido nuevamente
```

## Flujo de Sincronización

```
┌────────────────────────────────────────────┐
│     MÓDULO DE SINCRONIZACIÓN               │
├────────────────────────────────────────────┤

Estado: SYNC_IDLE
    │
    ▼ (Nueva venta guardada localmente)

Estado: SYNC_PENDING
    ├─ Venta guardada en SQLite
    ├─ ID generado localmente
    └─ synced = 0

    ▼ Chequea conexión cada 30 segundos

Estado: SYNC_CHECKING
    ├─ Verifica conectividad
    └─ GET http://api-server/health

    ├─ ✅ Conectado
    │   └─ Estado: SYNC_UPLOADING
    │
    └─ ❌ Sin conexión
        └─ Estado: SYNC_PENDING (espera)

Estado: SYNC_UPLOADING
    ├─ Obtiene ventas no sincronizadas
    ├─ POST /api/sales (por cada una)
    └─ Espera respuesta

    ├─ ✅ OK
    │   ├─ Marca como synced = 1
    │   ├─ Actualiza stock local
    │   └─ Estado: SYNC_IDLE
    │
    └─ ❌ Error
        ├─ Reintentar en 1 minuto
        └─ Estado: SYNC_PENDING

Estado: SYNC_IDLE
    └─ Espera nueva venta
```

## Algoritmo de Sugerencias (IA)

```javascript
function getSuggestedProducts(clientId, lastSales, currentCart) {
  // 1. Recopilar historial
  const allPurchases = [];
  lastSales.forEach(sale => {
    sale.items.forEach(item => {
      allPurchases.push({
        productId: item.product_id,
        productName: item.name,
        quantity: item.quantity
      });
    });
  });

  // 2. Contar frecuencia
  const frequency = {};
  allPurchases.forEach(p => {
    frequency[p.productId] = {
      count: (frequency[p.productId]?.count || 0) + 1,
      name: p.productName
    };
  });

  // 3. Filtrar productos en carrito actual
  const currentIds = new Set(currentCart.map(i => i.product_id));
  const available = Object.entries(frequency)
    .filter(([id]) => !currentIds.has(id))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)  // Top 5
    .map(([id, data]) => ({ id, ...data }));

  return available;
}

// Ejemplo:
// Input:  clientId='cli-123', lastSales=[...], currentCart=[aceite, harina]
// Output: [
//   { id: 'prod-az', count: 2, name: 'Azúcar' },
//   { id: 'prod-lech', count: 1, name: 'Leche' }
// ]
```

## Gestión del Estado (Móvil)

```
Context: App State
├─ user (auth)
├─ isOnline (conectividad)
├─ products (caché)
├─ cart (venta actual)
├─ clients (clientes)
└─ syncQueue (ventas pendientes)

Updates:
├─ Login → user = { id, email, role }
├─ Network change → isOnline = true/false
├─ Fetch products → products = [...]
├─ Add to cart → cart.push(item)
├─ Save sale → syncQueue.push(sale)
└─ Sync success → syncQueue = syncQueue.filter(s => s.id !== id)
```

## Gestión del Estado (Web)

```
Zustand Stores:
├─ authStore
│   ├─ user
│   ├─ token
│   ├─ isAuthenticated
│   ├─ login(user, token)
│   ├─ logout()
│   └─ hydrate()
│
└─ uiStore (opcional)
    ├─ isLoading
    ├─ error
    └─ setError(error)
```

## Monitoreo y Alertas

```
Eventos a Monitorear:
├─ Ventas completadas: log
├─ Errores de sincronización: alert
├─ Stock bajo: notificación
├─ Cambios de usuario: audit log
├─ Fallo de BD: critical alert
└─ Solicitud rechazada: error log
```

---

**Próximo paso → Ver [Guide de Implementación](IMPLEMENTATION.md)**
