# 🔒 Seguridad y Mejores Prácticas

## Autenticación

### JWT (JSON Web Tokens)

```javascript
// Request
POST /api/auth/login
{
  "email": "user@empresa.com",
  "password": "password123"
}

// Response
{
  "user": {
    "id": "uuid",
    "email": "user@empresa.com",
    "full_name": "Juan Rodríguez",
    "role": "seller"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Cómo Usar el Token
```javascript
// Header en cada request
Authorization: Bearer <token>

// Ejemplo
const response = await fetch('http://api/sales', {
  headers: {
    'Authorization': 'Bearer eyJhbGc...'
  }
});
```

### Expiración
- Tokens expiran en **7 días**
- User debe hacer login nuevamente
- App móvil almacena en SecureStore (encriptado)
- App web almacena en localStorage

## Contraseñas

✅ **Requisitos Mínimos:**
- 8 caracteres mínimo
- 1 mayúscula
- 1 número
- 1 carácter especial

✅ **Almacenamiento:**
- Se hashean con bcrypt (10 rounds)
- Nunca se envían en texto plano
- Se validan en HTTPS

## Control de Acceso (RBAC)

### Roles
```
┌─────────────────────────────┐
│ SELLER (Vendedor)           │
├─────────────────────────────┤
│ ✅ Crear venta              │
│ ✅ Ver productos            │
│ ✅ Buscar clientes          │
│ ✅ Ver su historial         │
│ ❌ Editar productos         │
│ ❌ Ver otros vendedores     │
│ ❌ Reportes globales        │
└─────────────────────────────┘

┌─────────────────────────────┐
│ ADMIN (Administrador)       │
├─────────────────────────────┤
│ ✅ Crear venta              │
│ ✅ Editar productos         │
│ ✅ Crear usuarios           │
│ ✅ Ver reportes completos   │
│ ✅ Exportar datos           │
│ ✅ Gestionar inventario     │
│ ✅ Ver auditoría:
└─────────────────────────────┘
```

## Validación de Datos

### Backend
```javascript
// Todas las entradas se validan:
- Tipos de datos
- Rangos (min/max)
- Formato (email, teléfono)
- Longitud (strings)
- Presencia (required fields)

// Ejemplo
if (!email || !validator.isEmail(email)) {
  return res.status(400).json({ error: 'Email inválido' });
}

if (price < 0 || price > 99999) {
  return res.status(400).json({ error: 'Precio inválido' });
}
```

### Mobile
```javascript
// Validación en tiempo real
- Al escribir en inputs
- Antes de enviar al servidor
- Formato de cantidad/bonificación

// Ejemplo
const quantity = parseInt(input);
if (isNaN(quantity) || quantity < 1 || quantity > product.stock) {
  Alert.alert('Error', 'Cantidad inválida');
  return;
}
```

## Encriptación

✅ **En Tránsito:**
- HTTPS/TLS en producción
- Certificados SSL válidos
- HTTP/2 habilitado

✅ **En Reposo:**
- Contraseñas: bcrypt
- Tokens: JWT
- Datos sensibles: considerar AES-256 si es necesario

## Auditoría

### Logs de Transacciones
```sql
-- Cada venta registra:
CREATE TABLE logs (
  id UUID,
  action VARCHAR,           -- 'create_sale', 'update_stock'
  user_id UUID,             -- quién hizo
  resource_id UUID,         -- qué se modificó
  changes JSON,             -- qué cambió
  ip_address VARCHAR,       -- de dónde
  timestamp TIMESTAMP       -- cuándo
);
```

### Monitoreo
```bash
# Ver últimas acciones de un usuario
SELECT * FROM logs 
WHERE user_id = 'user-123' 
ORDER BY timestamp DESC 
LIMIT 100;
```

## Protección contra Ataques

### SQL Injection
```javascript
// ❌ MALO - Vulnerable
db.query(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ BUENO - Parametrizado
db.query('SELECT * FROM users WHERE email = $1', [email]);
```

### XSS (Cross-Site Scripting)
```javascript
// ❌ MALO - Interpola HTML
innerHTML = `<p>${userInput}</p>`;

// ✅ BUENO - Escapa
textContent = userInput;  // o usa bibliotecas como DOMPurify
```

### CSRF (Cross-Site Request Forgery)
```javascript
// Validar origen de requests
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100                    // 100 requests por IP
});

app.use('/api/auth/login', limiter);
```

## Secretos y Configuración

### Variables de Entorno
```bash
# ✅ CORRECTO
# .env (nunca commitear)
JWT_SECRET=muy_secreto_aleatorio_de_32_caracteres

# ❌ INCORRECTO
const secret = 'admin123';  // hardcodeado
```

### Generador de Secretos
```bash
# Generar secret seguro
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Guardar en .env
JWT_SECRET=abc123def456...
```

## Checklist de Seguridad

- [ ] HTTPS habilitado en producción
- [ ] JWT secrets generados aleatoriamente
- [ ] Contraseñas hasheadas con bcrypt
- [ ] Validación de datos en todos los endpoints
- [ ] CORS restringido
- [ ] Rate limiting en login
- [ ] Logs de auditoría
- [ ] Secretos en variables de entorno
- [ ] Dependencias actualizadas
- [ ] Tokens con expiración
- [ ] Contraseñas mínimo 8 caracteres
- [ ] SQL parameterizado
- [ ] No exponer stack traces en producción

## En Caso de Breach

1. **Cambio de secrets:**
   ```bash
   # Generar nuevo JWT_SECRET
   # Redeuplicar todos los tokens activos
   # Todos los usuarios hacen login nuevamente
   ```

2. **Auditoría:**
   ```sql
   -- Revisar logs de acceso no autorizados
   SELECT * FROM logs WHERE status = 'unauthorized';
   ```

3. **Comunicación:**
   - Notificar a usuarios
   - Cambiar credenciales
   - Registrar el incidente
