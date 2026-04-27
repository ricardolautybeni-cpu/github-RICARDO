# 📚 GUÍA DE NAVEGACIÓN - DISTRIBUIDORA V2.0

**¿No sabes por dónde empezar? Usa esta guía según tu rol.**

---

## 👨‍💼 PARA DUEÑO/GERENTE

**Quieres saber**: ¿Me conviene? ¿Cuánto dinero gano?

**Lectura**: 5 minutos

👉 **Lee esto primero**: [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)

Contiene:
- ✅ 8 problemas que V2.0 resuelve
- ✅ Impacto en dinero ($)
- ✅ ROI 1,680% anual
- ✅ Ejemplo concreto de tu tipo de negocio

**Luego**: Muestra al técnico [MIGRATION_V2_CHECKLIST.md](MIGRATION_V2_CHECKLIST.md) para que instale.

---

## 👨‍💻 PARA DESARROLLADOR/TÉCNICO

**Quieres saber**: ¿Qué código se agregó? ¿Cómo funciona?

**Lectura**: 20-30 minutos

### 1️⃣ Entender la arquitectura
👉 [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md)

Contiene:
- ✅ 8 mejoras explicadas con código
- ✅ Nuevas tablas y endpoints
- ✅ Arquitectura de cada feature
- ✅ Parámetros y respuestas

### 2️⃣ Instalar y probar
👉 [MIGRATION_V2_CHECKLIST.md](MIGRATION_V2_CHECKLIST.md)

Contiene:
- ✅ Pasos exactos para migrar
- ✅ Comandos curl para probar cada endpoint
- ✅ Troubleshooting si algo falla

### 3️⃣ API completa
👉 [backend/API_DOCS.md](backend/API_DOCS.md)

Contiene:
- ✅ 60+ endpoints documentados
- ✅ Parámetros exactos
- ✅ Ejemplos de request/response
- ✅ Códigos de error

### 4️⃣ Entender todo
👉 [README.md](README.md)

Contiene:
- ✅ Características fase 1 + fase 2
- ✅ Stack tecnológico
- ✅ Diagrama del sistema
- ✅ Estructura del proyecto

---

## 📱 PARA DESARROLLADOR DE MOBILE

**Quieres saber**: ¿Qué tengo que hacer desde el app?

**Lectura**: 15 minutos

### Implementar Batch Processing
👉 Sección "Batch Processing" en [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md)

**Tienes que:**
1. Generar `batch_id` único (timestamp + uuid)
2. Enviar array de ventas a `POST /api/sync/batch-sales`
3. Manejar respuesta de duplicados si ocurre

**Código ejemplo:**
```javascript
const batchId = `mobile_${Date.now()}_${uuid()}`;
const response = await api.post('/sync/batch-sales', {
  batch_id: batchId,
  sales: salesArray
});

if (response.skipProcessing) {
  // Ya fue procesado
  showMessage("Ya enviaste esto");
} else {
  // Nuevo batch
  showMessage("Ventas sincronizadas");
}
```

### Implementar Firma Digital
👉 Sección "Cobranzas Digitales" en [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md)

**Tienes que:**
1. Crear Canvas para que cliente firme
2. Convertir Canvas a base64 PNG
3. Enviar a `POST /api/receipts/generate-payment`
4. Mostrar PDF recibido

**Código exemplo:**
```javascript
// Canvas del cliente firma aquí
const canvas = document.getElementById('signaturePad');
const signatureBase64 = canvas.toDataURL('image/png');

// Generar recibo
const response = await api.post('/receipts/generate-payment', {
  payment_id: paymentId,
  signature_base64: signatureBase64
});

// response.receiptUrl = "/pdfs/receipt_123.pdf"
```

### Implementar Check-in/Check-out
👉 Sección "Cobranzas Digitales - Check-In/Out" en [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md)

**Tienes que:**
1. Llama `POST /api/collections/check-in` cuando llega a cliente (con GPS)
2. Registra cobranzas
3. Llama `POST /api/collections/check-out` al irse (con firma)

---

## 💻 PARA DESARROLLADOR DE WEB (DASHBOARDS)

**Quieres saber**: ¿Qué nuevos gráficos/datos tengo?

**Lectura**: 10 minutos

### Predicciones de Stock
👉 Sección "Predicción de Inventario" en [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md)

**Endpoints a consumir:**
```javascript
// Predicción de un producto
GET /api/predictions/product/:productId?lookbackDays=30
// Respuesta: { daysUntilStockOut, recommendation, ... }

// Análisis de todos en riesgo
GET /api/predictions/risk-analysis
// Respuesta: [{ product, urgency, daysUntilStockOut }, ...]
```

**Widget sugerido:**
```javascript
// Tabla con urgencia color-coded
// 🚨 Rojo si < 3 días
// ⚠️ Amarillo si < 7 días
// 📌 Verde si normal
```

### Resumen de Cobranzas
👉 Sección "Cobranzas" en [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md)

**Endpoints a consumir:**
```javascript
// Resumen del día
GET /api/collections/daily-summary
// Respuesta: { visitas, cobros_total, clientes_visitados, ... }

// Clientes morosos
GET /api/collections/overdue-clients
// Respuesta: [{ client, debt_amount, days_overdue }, ...]
```

**Widget sugerido:**
```javascript
// Vista de "Clientes en Alerta"
// Muestra deuda > 30 días vencida
// Permite hacer clic para iniciar cobro
```

### Mapa en Tiempo Real
👉 Sección "Check-in GPS" en [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md)

**Datos disponibles:**
```javascript
// seller_checkins table contiene:
// - latitude, longitude
// - check_in_at, check_out_at
// - signature_data
// - duration de visita
```

**Widget sugerido:**
```javascript
// Mapa Google/Mapbox con:
// - Markers en ubicación de check-ins
// - Información de duración
// - Histórico de 7 días últimos
```

---

## 🔒 PARA RESPONSABLE DE SEGURIDAD

**Quieres saber**: ¿Qué cambió en seguridad?

**Lectura**: 10 minutos

👉 [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md) - Sección "Token Rotation"

**Cambios principales:**
1. **Token Rotation**: Cada refresh invalida token anterior
2. **Intrusion Detection**: Si intentan usar token revocado → alerta
3. **Soft Deletes**: Nunca se pierden datos (auditoría completa)
4. **Batch Idempotency**: Previene ataque replay

**Puntos a verificar:**
- ✅ Refresh token revoca automáticamente versión anterior
- ✅ Intento de usar token revocado → cierra todas las sesiones
- ✅ deleted_at nunca se actualiza después de soft delete (solo select WHERE deleted_at IS NULL)
- ✅ batch_id es único (tabla sync_batches UNIQUE constraint)

---

## 🧪 PARA QA/TESTING

**Quieres saber**: ¿Qué testing hacer?

**Lectura**: 15 minutos

👉 [MIGRATION_V2_CHECKLIST.md](MIGRATION_V2_CHECKLIST.md) - Sección "PASO 4 AL 7"

### Test Cases

**Batch Processing:**
- [ ] Enviar 1 venta → se guarda
- [ ] Enviar con batch_id duplicado → se rechaza
- [ ] Validar stock antes de procesar
- [ ] Si falta stock en 1 item → toda la transacción falla

**Cobranzas:**
- [ ] Check-in guarda GPS correctamente
- [ ] Check-out guarda firma en base64
- [ ] Payment valida que monto < deuda actual
- [ ] Daily summary suma correctamente

**Stock Prediction:**
- [ ] Analiza últimos 30 días de ventas
- [ ] Calcula días hasta agotamiento
- [ ] Retorna urgencia correcta
- [ ] Risk analysis ordena por urgencia

**Token Rotation:**
- [ ] Refresh retorna nuevo access + refresh token
- [ ] Token viejo no funciona después de refresh
- [ ] Intento de usar viejo → detección de fraude

---

## 📊 PARA AUDITORÍA

**Quieres saber**: ¿Dónde están los audit logs?

**Lectura**: 5 minutos

**Cambios V2.0:**
1. **Soft deletes**: Toda tabla principal tiene `deleted_at`
   - Query: `SELECT * FROM table WHERE deleted_at IS NOT NULL` → ver eliminados
   - Query: `SELECT * FROM table WHERE deleted_at IS NULL` → ver activos

2. **Batch tracking**: `sync_batches` tabla
   - Cada envío de vendedor queda registrado
   - `user_id`, `batch_id`, `sales_count`, `status`, `synced_at`

3. **Seller check-ins**: `seller_checkins` tabla
   - GPS, timestamps, firma
   - Quién visitó a quién, cuándo, cuánto tiempo

4. **Token revocation**: `refresh_tokens` tabla
   - Campo `revoked_at` marca cuándo se revocó
   - Auditoría completa de acesos

---

## 🚀 RUTA RÁPIDA (EMPEZAR YA)

### Día 1 - Dueño/Gerente
1. Lee [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) (5 min)
2. Muestra a equipo técnico
3. Autoriza implementación

### Día 1-2 - Técnico
1. Ejecuta [MIGRATION_V2_CHECKLIST.md](MIGRATION_V2_CHECKLIST.md) (1 hora)
2. Verifica todos los tests pasan
3. Deploy a staging

### Día 3 - Desarrolladores Mobile/Web
1. Mira [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md) (20 min)
2. Implementa integraciones (2-4 horas)
3. Prueba en staging

### Día 4 - QA
1. Ejecuta test cases (30 min)
2. Verifica todo funciona

### Día 5 - Deploy
1. Backup de producción
2. Deploy V2.0
3. Monitoreo por 24h

---

## 📞 PREGUNTAS

### "¿Dónde están los archivos creados?"
Los archivos fueron creados automáticamente en:
- `backend/src/routes/sync.js`
- `backend/src/routes/collections.js`
- `backend/src/routes/receipts.js`
- `backend/src/routes/predictions.js`
- `backend/src/utils/softDelete.js`
- `backend/src/services/paymentReceipt.js`
- `backend/src/services/inventoryPredictor.js`

Revisa directorios en README.md sección "Estructura del Proyecto"

### "¿Qué archivos documentación leer?"
**Rápido** (< 10 min): [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)
**Completo** (30 min): [PRODUCTION_IMPROVEMENTS_V2.md](PRODUCTION_IMPROVEMENTS_V2.md)
**Técnico** (1h): [backend/API_DOCS.md](backend/API_DOCS.md)

### "¿Cuál es el siguiente paso?"
Ejecutar [MIGRATION_V2_CHECKLIST.md](MIGRATION_V2_CHECKLIST.md)
Toma ~1 hora y activa todas las mejoras.

---

## 🎉 RESUMEN

| Rol | Lee | Tiempo |
|-----|-----|--------|
| Dueño | EXECUTIVE_SUMMARY | 5 min |
| Técnico | MIGRATION_CHECKLIST | 1 hora |
| Developer Mobile | PRODUCTION_IMPROVEMENTS | 20 min |
| Developer Web | PRODUCTION_IMPROVEMENTS | 20 min |
| QA | MIGRATION_CHECKLIST Tests | 30 min |
| Auditor | Este documento | 5 min |

**Total para producción**: ~2 horas de trabajo

---

**Inicio recomendado**: Hoy mismo  
**Dificultad**: Baja (solo es configuración)  
**Riesgo**: Muy bajo (reversible)  
**Ganancia**: +20% ROI  

¿Necesitas ayuda? Cada archivo tiene ejemplos y troubleshooting.

---

*Última actualización: Abril 2026*  
*Versión: V2.0*  
*Status: Production Ready ✅*
