# 🔄 CHECKLIST DE MIGRACIÓN A V2.0

**Fecha**: Abril 2026  
**Objetivo**: Activar todas las mejoras de producción  
**Tiempo estimado**: 15 minutos

---

## ✅ PASO 1: PREPARACIÓN (2 minutos)

- [ ] Hacer backup de BD actual
  ```bash
  pg_dump distribuidora_db > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] Verificar que backend esté corriendo en desarrollo
  ```bash
  cd backend
  npm run dev
  # Debe ver: "Server running on port 3001"
  ```

- [ ] Verificar .env completado
  ```bash
  cat .env
  # Debe tener: DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET
  ```

---

## ✅ PASO 2: EJECUTAR MIGRACIONES (2 minutos)

- [ ] Ejecutar migraciones V2
  ```bash
  npm run migrate
  ```
  
  **Verifica que creó**:
  - ✅ Columna `deleted_at` en 12 tablas
  - ✅ Tabla `sync_batches`
  - ✅ Tabla `seller_checkins`
  - ✅ 15+ índices de performance

- [ ] Conectar a BD y verificar
  ```bash
  psql distribuidora_db
  
  # Dentro de psql:
  \d users
  # Debe mostrar: deleted_at timestamp NULL
  
  \d sync_batches
  # Debe existir tabla
  
  \d seller_checkins
  # Debe existir tabla
  
  \q
  ```

---

## ✅ PASO 3: VERIFICAR ARCHIVOS NUEVOS (3 minutos)

Estos archivos fueron creados con las mejoras:

- [ ] `backend/src/utils/softDelete.js`
  ```bash
  ls -la backend/src/utils/softDelete.js
  # Debe existir
  ```

- [ ] `backend/src/routes/sync.js`
  ```bash
  ls -la backend/src/routes/sync.js
  # Debe existir
  ```

- [ ] `backend/src/routes/collections.js`
  ```bash
  ls -la backend/src/routes/collections.js
  # Debe existir
  ```

- [ ] `backend/src/routes/receipts.js`
  ```bash
  ls -la backend/src/routes/receipts.js
  # Debe existir
  ```

- [ ] `backend/src/services/paymentReceipt.js`
  ```bash
  ls -la backend/src/services/paymentReceipt.js
  # Debe existir
  ```

- [ ] `backend/src/routes/predictions.js`
  ```bash
  ls -la backend/src/routes/predictions.js
  # Debe existir
  ```

- [ ] `backend/src/services/inventoryPredictor.js`
  ```bash
  ls -la backend/src/services/inventoryPredictor.js
  # Debe existir
  ```

---

## ✅ PASO 4: PROBAR ENDPOINTS BATCH PROCESSING (2 minutos)

**Test de prevención de duplicados:**

```bash
# 1️⃣ Obtener token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@distribuidora.test",
    "password": "admin123456"
  }'

# Copiar el accessToken de la respuesta
TOKEN="eyJhbGc..."

# 2️⃣ Hacer una venta con sync batch (primera vez)
curl -X POST http://localhost:3001/api/sync/batch-sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "mobile_20260421_test123",
    "sales": [
      {
        "client_id": "uuid-cliente",
        "items": [
          {"product_id": "uuid-producto", "quantity": 5}
        ],
        "payment_method": "cash",
        "total_amount": 2500
      }
    ]
  }'

# Respuesta esperada: { "status": "completed", "salesCount": 1 }
# ✅ Si retorna "completed" → Funciona

# 3️⃣ Enviar EXACTAMENTE el mismo batch_id otra vez
curl -X POST http://localhost:3001/api/sync/batch-sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "mobile_20260421_test123",
    "sales": [
      {
        "client_id": "uuid-cliente",
        "items": [
          {"product_id": "uuid-producto", "quantity": 5}
        ],
        "payment_method": "cash",
        "total_amount": 2500
      }
    ]
  }'

# Respuesta esperada: { "skipProcessing": true, "reason": "Batch already processed" }
# ✅ Si retorna "skipProcessing": true → ¡DUPLICADOS BLOQUEADOS!
```

- [ ] Batch processing previene duplicados ✅

---

## ✅ PASO 5: PROBAR COBRANZAS (2 minutos)

**Test de check-in/check-out:**

```bash
# 1️⃣ Check-in (inicio de visita)
curl -X POST http://localhost:3001/api/collections/check-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "uuid-cliente",
    "latitude": -34.6037,
    "longitude": -58.3816
  }'

# Respuesta esperada: { "checkInId": "uuid", "canProceed": true }
# Copiar el checkInId

# 2️⃣ Registrar pago
curl -X POST http://localhost:3001/api/collections/payment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "uuid-cliente",
    "amount": 500,
    "payment_method": "cash",
    "reference": "Pago parcial"
  }'

# Respuesta esperada: { "paymentId": "uuid", "newDebt": 1500 }
# ✅ Deuda se redujo

# 3️⃣ Check-out (fin de visita)
curl -X POST http://localhost:3001/api/collections/check-out/uuid-checkInId \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Cobrado $500, saldo $1500",
    "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }'

# Respuesta esperada: { "checkOutId": "uuid", "visitDuration": "15min" }
# ✅ Firma guardada
```

- [ ] Check-in/Check-out funciona ✅
- [ ] Pagos se registran correctamente ✅

---

## ✅ PASO 6: PROBAR PREDICCIONES (1 minuto)

**Test de predicción de stock:**

```bash
# Obtener predicción de producto
curl -X GET http://localhost:3001/api/predictions/product/uuid-producto?lookbackDays=30 \
  -H "Authorization: Bearer $TOKEN"

# Respuesta esperada:
{
  "productId": "uuid",
  "currentStock": 45,
  "avgDailySale": 3.5,
  "prediction": {
    "daysUntilStockOut": 13,
    "estimatedStockOutDate": "2026-05-04"
  },
  "recommendation": "📌 Considerar pedido en próximos días"
}

# ✅ Si retorna daysUntilStockOut → Funciona
```

- [ ] Predicción de stock funciona ✅

---

## ✅ PASO 7: VERIFICAR TOKEN ROTATION (1 minuto)

**Test de seguridad:**

```bash
# 1️⃣ Hacer refresh de token
REFRESH_TOKEN="eyJhbGc..."  # Del login anterior

curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "'$REFRESH_TOKEN'"
  }'

# Respuesta esperada:
{
  "accessToken": "nuevo_token",
  "refreshToken": "nuevo_refresh",
  "expiresIn": "15m",
  "securityAlert": false
}

# ✅ Si retorna securityAlert: false → Token rotation funciona
```

- [ ] Token rotation implementado ✅

---

## ✅ PASO 8: ACTUALIZAR CONFIGURACIÓN (1 minuto)

- [ ] Editar `.env` con variable distribuidor
  ```bash
  # Agregar a backend/.env
  DISTRIBUTOR_NAME="MI DISTRIBUIDORA S.A."
  ```

- [ ] Esto se usa en recibos PDF

---

## ✅ PASO 9: VERIFICAR DOCUMENTACIÓN (1 minuto)

- [ ] Leer [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md)
  ```bash
  ls -la PRODUCTION_IMPROVEMENTS_V2.md
  # Debe existir
  ```

- [ ] Revisar [backend/API_DOCS.md](backend/API_DOCS.md)
  ```bash
  grep -i "batch\|collections\|predictions\|receipts" backend/API_DOCS.md
  # Debe encontrar las secciones nuevas
  ```

---

## ✅ PASO 10: TESTING EN PRODUCCIÓN (Opcional)

Si vas a producción:

- [ ] Backup completo de datos
  ```bash
  pg_dump distribuidora_db > backup_produccion_$(date +%Y%m%d).sql
  ```

- [ ] Ejecutar migraciones en servidor
  ```bash
  npm run migrate
  ```

- [ ] Restart de aplicación
  ```bash
  npm restart
  ```

- [ ] Verificar endpoints responden
  ```bash
  curl https://tu-servidor.com/api/health
  ```

---

## 📊 RESUMEN DE QUÉ CAMBIA

### Base de Datos

**Tablas nuevas:**
- `sync_batches` - Tracking de sincronizaciones
- `seller_checkins` - Check-in/out de visitas

**Cambios en tablas existentes:**
- Agregada columna `deleted_at` a 12 tablas
- Agregados 15+ índices de performance
- Token de refresh ahora se revoca

### Endpoints Nuevos (18)

**Sync:**
- POST /api/sync/batch-sales
- GET /api/sync/batch-status/:batchId

**Collections:**
- POST /api/collections/check-in
- POST /api/collections/check-out/:id
- POST /api/collections/payment
- GET /api/collections/daily-summary
- GET /api/collections/overdue-clients

**Receipts:**
- POST /api/receipts/generate-payment
- POST /api/receipts/save-signature
- GET /api/receipts/:filename

**Predictions:**
- GET /api/predictions/product/:id
- GET /api/predictions/risk-analysis

**Auth (mejorado):**
- POST /api/auth/refresh (con token rotation)

---

## 🐛 TROUBLESHOOTING

### Error: "Tabla sync_batches no existe"
```bash
# Ejecutar migraciones
npm run migrate

# Verificar en BD
psql distribuidora_db
\d sync_batches
```

### Error: "Missing deleted_at column"
```bash
# Ejecutar migraciones completas
npm run migrate

# Verificar columna fue agregada
\d users
# Debe mostrar: deleted_at
```

### Endpoints retornan 404
```bash
# Verificar que server.js tenga los imports
grep "sync\|collections\|receipts\|predictions" backend/src/server.js

# Reiniciar servidor
npm run dev
```

### Batch processing no previene duplicados
```bash
# Verificar unique constraint
psql distribuidora_db
\d sync_batches
# Debe mostrar: Índice unique en batch_id
```

---

## ✨ SIGUIENTE PASO

Una vez completado este checklist:

1. **Integración Mobile**: Implementar Canvas para firma
2. **Integración Web**: Dashboard con predicciones
3. **Testing QA**: Probar casos límite
4. **Deployment**: Subir a ambiente de staging

---

## 📞 SOPORTE

Si algo falla:
1. Revisar el error en `backend/logs/`
2. Consultar [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md)
3. Verificar archivo API_DOCS.md para parámetros correctos

---

**Status**: 🚀 Ready to deploy
**Fecha**: Abril 2026
**Versión**: V2.0 + Mejoras de Producción
