# ✅ DEPLOYMENT CHECKLIST - Distribuidora POS

## PRE-DEPLOYMENT

### Código
- [ ] Todas las rutas tienen validación Joi
- [ ] No hay `console.log()` en producción
- [ ] Variables sensibles en `.env`
- [ ] No hay hardcoded de contraseñas
- [ ] Código formateado con Prettier/ESLint

### Base de Datos
- [ ] Migraciones ejecutadas (`npm run migrate`)
- [ ] Índices creados (CHECK migrate.js)
- [ ] Backup antes de deployment
- [ ] Credenciales BD seguras (.env)

### Testing
- [ ] Endpoints principales testeados
- [ ] Validaciones funcionan (Joi)
- [ ] Stock validation OK
- [ ] Refresh tokens funcionan
- [ ] Logout revoca tokens

### Seguridad
- [ ] JWT_SECRET es fuerte (min 32 chars)
- [ ] CORS está restringido a domain correcto
- [ ] Bcrypt rounds = 10
- [ ] Refresh tokens con max 7 días
- [ ] AccessTokens con max 15 minutos

---

## DEPLOYMENT (Producción)

### Credenciales
```bash
# En variables de entorno del servidor:
DB_HOST=db-server.example.com
DB_PORT=5432
DB_NAME=distribuidora
DB_USER=prod_user
DB_PASSWORD=<SECURO_32_CHARS>
JWT_SECRET=<SECURO_32_CHARS>
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://tu-dominio.com
```

### Base de Datos PostgreSQL
1. Crear DB remota (RDS, Railway, etc.)
2. Ejecutar migraciones:
   ```bash
   NODE_ENV=production npm run migrate
   ```
3. Verificar tablas y índices:
   ```sql
   \dt           -- Ver todas las tablas
   \di           -- Ver índices
   ```

### Servidor Node.js
```bash
# Instalar dependencias
npm install --production

# Iniciar con PM2 (para mantener arriba)
pm2 start src/server.js --name "distribuidora-api"
pm2 save
pm2 startup

# O con Docker
docker build -t distribuidora-api .
docker run -d --env-file .env --name api distribuidora-api
```

### Certificados SSL
- [ ] Obtener SSL (Let's Encrypt gratis)
- [ ] API en HTTPS
- [ ] WebSocket seguro (WSS)

### CORS
```javascript
// En production:
FRONTEND_URL=https://tu-dominio.com
app.use(cors({ origin: 'https://tu-dominio.com' }))
```

### Logs
- [ ] Configurar logging (Winston/Pino)
- [ ] Enviar a servicio (Datadog, New Relic)
- [ ] Monitorear errores

---

## POST-DEPLOYMENT

### Verificación
```bash
# Health check
curl https://tu-api.com/api/health

# Login test
curl -X POST https://tu-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'

# Productos
curl https://tu-api.com/api/products \
  -H "Authorization: Bearer TOKEN"

# WebSocket
wscat -c wss://tu-api.com
```

### Backups
- [ ] Backup diario de BD
- [ ] Guardar PDFs generados
- [ ] Retención de 30 días

### Monitoreo
- [ ] Uptime monitoring
- [ ] CPU/Memory alerts
- [ ] DB query performance
- [ ] API response time

### Performance
- [ ] CDN para assets
- [ ] Cache de respuestas GET
- [ ] Compression (gzip)
- [ ] Redis para sesiones (opcional)

---

## ROLLBACK PLAN

Si algo falla:

```bash
# 1. Revertir código
git revert <commit>
git push

# 2. Revertir BD
-- Backup anterior (si existe)
psql -U user -d db < backup.sql

# 3. Reiniciar API
pm2 restart distribuidora-api
```

---

## UPGRADES FUTUROS

### Features Listos
- [ ] Fotos de productos (AWS S3)
- [ ] Caché distribuido (Redis)
- [ ] Email de confirmación
- [ ] Integración con contabilidad
- [ ] API de proveedores

### Mejoras
- [ ] Rate limiting
- [ ] API versioning (v1, v2)
- [ ] GraphQL (alternativo a REST)
- [ ] Mobile push notifications
- [ ] Analytics avanzadas

---

## CHECKLIST FINAL

- [ ] Código limpio y documentado
- [ ] Todas las validaciones en lugar
- [ ] Tokens funcionando (15min/7d)
- [ ] Stock validation OK
- [ ] Devoluciones con aprobación
- [ ] Geolocalización funciona
- [ ] WebSocket en tiempo real
- [ ] PDFs generan correctamente
- [ ] Cuentas corrientes OK
- [ ] Alertas de stock funcionan
- [ ] Logs en servidor
- [ ] Backups automáticos
- [ ] SSL/HTTPS
- [ ] Monitoreo activado
- [ ] Documentación actualizada

---

**Última actualización**: 2024
