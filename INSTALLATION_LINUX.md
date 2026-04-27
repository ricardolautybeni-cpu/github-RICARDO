# Instalación completa en Linux

Esta guía te lleva paso a paso por la instalación y puesta en marcha del proyecto completo:
- Backend Node/Express
- Frontend web React
- Frontend móvil Expo

## 1. Requisitos previos

Asegúrate de tener instalados:
- Git
- Node.js 18+ y npm
- PostgreSQL 12+
- Expo CLI (opcional para móvil)

En Ubuntu/Debian:
```bash
sudo apt update
sudo apt install -y git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo apt install -y postgresql postgresql-contrib
```

## 2. Clonar el repositorio

```bash
cd ~
git clone https://github.com/ricardolautybeni-cpu/github-RICARDO.git
cd github-RICARDO
```

## 3. Configurar PostgreSQL

1. Inicia el servicio:
```bash
sudo service postgresql start
```

2. Crea el usuario y la base de datos:
```bash
sudo -u postgres createuser -s postgres
sudo -u postgres createdb distribuidora_db
```

3. Si usas contraseña en PostgreSQL, configura `pg_hba.conf` o usa `psql` para cambiarla.

## 4. Configurar y ejecutar el backend

### 4.1 Instalar dependencias

```bash
cd /workspaces/github-RICARDO/backend
npm install
```

### 4.2 Crear el archivo `.env`

Crea `backend/.env` con este contenido:
```bash
cat > backend/.env << 'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_NAME=distribuidora_db
DB_USER=postgres
DB_PASSWORD=password
PORT=3001
NODE_ENV=development
JWT_SECRET=secreto_mas_largo_y_seguro
FRONTEND_URL=http://localhost:3000
DISTRIBUTOR_NAME=MiDistribuidora
EOF
```

Ajusta `DB_PASSWORD` si tu Postgres tiene contraseña distinta.

### 4.3 Ejecutar migraciones

```bash
cd /workspaces/github-RICARDO/backend
npm run migrate
```

Esto crea todas las tablas y las extensiones necesarias como `pgcrypto`.

### 4.4 Iniciar backend

```bash
npm run dev
```

Verifica en otra terminal:
```bash
curl http://localhost:3001/api/health
```
Debe responder con `status: OK`.

## 5. Configurar y ejecutar el frontend web

### 5.1 Instalar dependencias

```bash
cd /workspaces/github-RICARDO/frontend-web
npm install
```

### 5.2 Crear `.env`

```bash
cat > /workspaces/github-RICARDO/frontend-web/.env << 'EOF'
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_SOCKET_URL=ws://localhost:3001
EOF
```

### 5.3 Iniciar la aplicación web

```bash
npm start
```

Abre el navegador en:
```
http://localhost:3000
```

## 6. Configurar y ejecutar el frontend móvil

### 6.1 Instalar dependencias

```bash
cd /workspaces/github-RICARDO/frontend-mobile
npm install
```

### 6.2 Crear `.env`

```bash
cat > /workspaces/github-RICARDO/frontend-mobile/.env << 'EOF'
EXPO_PUBLIC_API_URL=http://localhost:3001/api
EXPO_PUBLIC_SOCKET_URL=ws://localhost:3001
EOF
```

### 6.3 Iniciar Expo

```bash
npm start
```

Si no tienes Expo CLI global:
```bash
npx expo start
```

### 6.4 Abrir en el teléfono

- Instala `Expo Go` en tu dispositivo móvil.
- Escanea el QR que aparece en la terminal.
- Si la conexión no funciona con `localhost`, usa tu IP local en `.env`:
  - `EXPO_PUBLIC_API_URL=http://192.168.x.x:3001/api`

## 7. Probar el flujo básico

### 7.1 Registrar y loguear usuario

Usa `curl` o la UI web.

### 7.2 Crear producto y cliente

Desde la app web o con `curl` a `/api/products` y `/api/clients`.

### 7.3 Hacer una venta

Desde la interfaz o `POST /api/sales` con token.

### 7.4 Realizar check-in/check-out

Llama a `/api/collections/check-in` y `/api/collections/check-out/:id`.

### 7.5 Enviar liquidación diaria

Llama a `/api/settlements/submit-daily` con los montos del día.

## 8. Problemas comunes y soluciones

### Error: `JWT_SECRET` no definido

Asegúrate de tener `JWT_SECRET` en `backend/.env` y reinicia el servidor.

### Error: `pgcrypto` no existe

Ejecuta `npm run migrate` nuevamente, y verifica que PostgreSQL puede crear extensiones.

### Error móvil: no se conecta a backend

Cambia `EXPO_PUBLIC_API_URL` a la IP local de tu computador.

## 9. Comandos útiles de verificación

```bash
# Ver backend corriendo
curl http://localhost:3001/api/health

# Ver productos con token
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/products
```

## 10. Recomendaciones de uso

- Inicia primero el backend.
- Luego ejecuta el frontend web.
- Después ejecuta Expo.
- Usa `localhost` solo en el mismo equipo; en móvil, usa IP local.

---

Esta guía está optimizada para Linux y el proyecto actual.
Si quieres, puedo también generar un `README` corto dentro del repositorio con estos pasos empoderados para tu equipo.