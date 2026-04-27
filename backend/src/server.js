const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
require('dotenv').config();
const db = require('./db/connection');

// Importar rutas
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const clientsRoutes = require('./routes/clients');
const inventoryRoutes = require('./routes/inventory');
const geolocationRoutes = require('./routes/geolocation');
const returnsRoutes = require('./routes/returns');
const stockAlertsRoutes = require('./routes/stockAlerts');
const accountsRoutes = require('./routes/accounts');
const invoicesRoutes = require('./routes/invoices');
const syncRoutes = require('./routes/sync');
const collectionsRoutes = require('./routes/collections');
const receiptsRoutes = require('./routes/receipts');
const predictionsRoutes = require('./routes/predictions');
const settlementsRoutes = require('./routes/settlements');
const reportsRoutes = require('./routes/reports');
const auditlogsRoutes = require('./routes/auditlogs');

// WebSocket
const { initializeSocket } = require('./services/websocket');

const app = express();
const server = http.createServer(app);

// Inicializar WebSocket
const io = initializeSocket(server);

// Middleware
const path = require('path');
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos estáticos (imágenes, documentos)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/pdfs', express.static(path.join(__dirname, '../pdfs')));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/geolocation', geolocationRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/stock-alerts', stockAlertsRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/settlements', settlementsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/auditlogs', auditlogsRoutes);

// Servir PDFs generados (ya está en middleware arriba)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor'
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`🔌 WebSocket iniciado en ws://localhost:${PORT}`);
});
