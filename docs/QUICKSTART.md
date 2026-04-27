# 🚀 Guía Rápida de Inicio

## En 5 minutos

### 1. Base de Datos
```bash
brew install postgresql  # macOS
# o
sudo apt install postgresql postgresql-contrib  # Ubuntu

createdb distribuidora_db
```

### 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

### 3. Web
```bash
cd frontend-web
npm install
npm start
# Abre http://localhost:3000
```

### 4. Mobile (Expo)
```bash
cd frontend-mobile
npm install
npm start
# Abre "w" para web, "a" para Android, "i" para iOS
```

## Credenciales de Prueba

**Usuario Admin:**
- Email: admin@distribuidora.test
- Password: admin123456

## URLs Principales

- 📱 Mobile: Expo CLI
- 🌐 Web: http://localhost:3000
- 🔌 API: http://localhost:3001/api

## Próximos Pasos

1. Crear categorías de productos
2. Cargar catálogo de productos
3. Crear vendedores
4. Comenzar a vender
