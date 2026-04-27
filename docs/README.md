# 📱 Distribuidora Multi-Rubro - Aplicación Completa

Una aplicación profesional para distribuidoras que incluye:
- **Backend**: Node.js + Express + PostgreSQL
- **Mobile**: React Native (iOS/Android) + SQLite offline
- **Web**: React + Dashboard de reportes
- **Características**: Sincronización en tiempo real, IA para sugerencias, offline-first

## 🎯 Características Principales

✅ **Portal de Ventas (Móvil)**
- Búsqueda de productos por código/descripción
- Teclado numérico para cantidad y bonificación
- Carrito de compras con descuento automático
- Historial de últimas 3 ventas por cliente
- Sugerencias inteligentes basadas en historial
- Funcionalidad offline con sincronización automática

✅ **Gestión de Clientes**
- Crear y buscar clientes
- Historial de compras
- Límite de crédito y deuda actual
- Reporte de últimas 3 ventas

✅ **Inventario**
- Gestión de productos por categoría
- Stock en tiempo real
- Alertas de stock bajo
- Movimientos de entrada/salida

✅ **Dashboard Admin (Web)**
- Reportes de ventas por período
- Top 10 productos vendidos
- Gráficos interactivos
- Gestión de usuarios (vendedores)

✅ **Sincronización**
- Sincronización automática al guardar
- Funcionalidad offline completa
- Cola de ventas pendientes
- Actualización de stock en tiempo real

---

## 🚀 Instalación y Configuración

### Requisitos Previos
- Node.js v16+
- PostgreSQL 12+
- npm o yarn
- Expo CLI (para desarrollo móvil)

### 1️⃣ Backend Setup

```bash
cd backend
npm install
```

**Configurar base de datos:**

```bash
# Crear base de datos
createdb distribuidora_db

# Ejecutar migraciones
npm run migrate

# (Opcional) Insertar datos de prueba
npm run seed
```

**Archivo .env:**

```env
# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=distribuidora_db
DB_USER=postgres
DB_PASSWORD=tu_password_aqui

# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=tu_secreto_super_seguro_aqui

# URLs
FRONTEND_URL=http://localhost:3000
```

**Iniciar servidor:**

```bash
npm run dev  # Modo desarrollo con nodemon
npm start    # Modo producción
```

El servidor estará disponible en: `http://localhost:3001`

### 2️⃣ Frontend Móvil Setup

```bash
cd frontend-mobile
npm install
```

**Configurar URL de API:**

Edit `src/services/api.js` y actualiza `API_URL` con tu servidor backend.

**Ejecutar en dispositivo:**

```bash
# Android
npm run android

# iOS
npm run ios

# Web (pruebas)
npm run web
```

### 3️⃣ Frontend Web Setup

```bash
cd frontend-web
npm install
```

**Iniciar desarrollo:**

```bash
npm start
```

Abrirá automáticamente en: `http://localhost:3000`

---

## 📡 Arquitectura de APIs

### Autenticación
```
POST /api/auth/login
POST /api/auth/register
```

### Productos
```
GET    /api/products              # Listar con búsqueda
GET    /api/products/code/:code   # Por código
POST   /api/products              # Crear
```

### Ventas
```
POST   /api/sales                 # Crear venta
GET    /api/sales                 # Listar con filtros
GET    /api/sales/:id             # Detalles
```

### Clientes
```
GET    /api/clients               # Listar
POST   /api/clients               # Crear
GET    /api/clients/:id/last-sales # Últimas 3 ventas
```

### Inventario
```
GET    /api/inventory             # Estado
POST   /api/inventory/entry       # Entrada
```

---

## 💾 Base de Datos

### Tablas Principales

**users** - Vendedores/Administradores
```sql
id (UUID)
email
password_hash
full_name
role (seller, admin)
```

**products** - Catálogo
```sql
id (UUID)
code (UNIQUE)
name
price
cost
stock
min_stock
```

**sales** - Ventas
```sql
id (UUID)
user_id → users
client_id → clients
total_amount
created_at
```

**clients** - Clientes
```sql
id (UUID)
name
document_number
email
credit_limit
current_debt
```

**sale_items** - Items por venta
```sql
sale_id → sales
product_id → products
quantity
bonus
unit_price
```

---

## 🔄 Sistema de Sincronización

### Offline-First
1. Todas las transacciones se guardan localmente primero (SQLite)
2. Cuando hay conexión, se sincronizan automáticamente
3. Los datos se marcan como "synced" una vez completados
4. Si hay error, quedan pendientes para reintentar

### Flujo de Venta
```
1. Usuario crea venta local ❌ Sin conexión
2. Se guarda en SQLite → Estado: synced = 0
3. Se recupera conexión
4. App intenta sincronizar automáticamente
5. Se envía al servidor → POST /api/sales
6. Si OK → synced = 1
7. Stock se descuenta en servidor (tiempo real)
```

---

## 🤖 Sistema de Sugerencias (IA)

### Algoritmo Simple Basado en Historial

```javascript
// Analiza las últimas 3 ventas del cliente
// Identifica productos más frecuentes
// Sugiere aquellos que no aparecer en la venta actual
// Ordena por frecuencia de compra anterior
```

**Ejemplo:**
- Cliente compró 5 veces: Aceite, Harina, Azúcar
- Hace 3 días compró: Aceite, Harina
- Sugerencia: ⭐ Azúcar (falta en esta venta)

---

## 📱 UI/UX - Teclado Numérico

Las pantallas de Cantidad y Bonificación usan:
- `keyboardType="numeric"` nativo del dispositivo
- Botones de acceso rápido para valores comunes
- Validación en tiempo real
- Cálculo automático de subtotales

---

## 🔐 Seguridad

- ✅ JWT para autenticación
- ✅ Contraseñas hasheadas con bcrypt
- ✅ Validación en servidor
- ✅ CORS configurado
- ✅ Tokens con expiración (7 días)

---

## 📊 Reportes Disponibles

### Dashboard (Web)
- Ventas totales por período
- Gráfico de ventas diarias (30 días)
- Top 10 productos vendidos
- Promedio de venta por transacción
- Tabla de ventas recientes

### Inventario
- Stock actual de todos los productos
- Productos con stock bajo
- Categoría por producto
- Historia de movimientos

### Clientes
- Últimas 3 ventas por cliente
- Total gastado
- Productos favoritos
- Deuda/Crédito actual

---

## 🛠️ Troubleshooting

### "No se conecta a BD"
```bash
# Verificar servicio PostgreSQL
sudo systemctl status postgresql

# Verificar credenciales en .env
```

### "Error de CORS"
```
Asegúrate que FRONTEND_URL en .env coincida con donde accedes
```

### "App se cierra al sincronizar"
```
- Verificar que el servidor está corriendo
- Ver logs: npm run dev
- Revisar credenciales en api.js
```

### "Stock no se actualiza"
```
- Verificar que la venta se sincronizó (synced = 1)
- Revisar logs del servidor
```

---

## 📚 Stack Tecnológico

| Capa | Tecnología | Descripción |
|------|-----------|-------------|
| **Backend** | Node.js + Express | API REST |
| **BD Principal** | PostgreSQL | Datos centralizados |
| **BD Local** | SQLite | Cache offline |
| **Mobile** | React Native + Expo | iOS/Android |
| **Web** | React + Recharts | Dashboard |
| **Autenticación** | JWT + bcrypt | Seguridad |
| **Sync** | Axios + Queue | Sincronización |

---

## 🚀 Deployment

### Heroku/Railway (Backend)
```bash
git push heroku main
```

### Vercel (Frontend Web)
```bash
vercel deploy
```

### Expo Go (Mobile)
```bash
expo publish
```

---

## 📞 Soporte

Para reportar bugs o sugerencias:
- Email: support@distribuidora.app
- GitHub Issues: github.com/ricardolautybeni-cpu/github-RICARDO

---

**Creado con ❤️ para distribuidoras modernas**
