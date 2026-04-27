const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function initializeSocket(server) {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true
    }
  });

  // Middleware de autenticación
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token requerido'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Usuario conectado: ${socket.user.id}`);

    // Unirse a sala personal
    socket.join(`user_${socket.user.id}`);

    // Unirse a sala de admin si tiene permiso
    if (socket.user.role === 'admin') {
      socket.join('admin');
    }

    // Evento: Nueva venta realizada
    socket.on('sale:created', (data) => {
      io.to('admin').emit('sale:notification', {
        type: 'sale',
        userId: socket.user.id,
        userName: socket.user.email,
        data,
        timestamp: new Date()
      });
    });

    // Evento: Stock bajo detectado
    socket.on('stock:critical', (data) => {
      io.to('admin').emit('stock:alert', {
        type: 'critical_stock',
        product: data,
        timestamp: new Date()
      });
    });

    // Evento: Ubicación en tiempo real (para mapa de rutas)
    socket.on('location:update', (data) => {
      io.to('admin').emit('seller:location', {
        userId: socket.user.id,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date()
      });
    });

    // Evento: Devolución pendiente aprobación
    socket.on('return:pending', (data) => {
      io.to('admin').emit('return:notification', {
        type: 'pending_approval',
        data,
        timestamp: new Date()
      });
    });

    // Mantener latido (heartbeat)
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', () => {
      console.log(`❌ Usuario desconectado: ${socket.user.id}`);
    });
  });

  return io;
}

// Funciones auxiliares para emitir eventos desde rutas
function emitSaleCreated(saleData) {
  if (io) {
    io.to('admin').emit('sale:icon', {
      type: 'new_sale',
      data: saleData,
      timestamp: new Date()
    });
  }
}

function emitStockAlert(product) {
  if (io) {
    io.to('admin').emit('stock:warning', {
      type: 'low_stock',
      product,
      timestamp: new Date()
    });
  }
}

function emitLocationUpdate(userId, location) {
  if (io) {
    io.to('admin').emit('seller:location', {
      userId,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date()
    });
  }
}

function getIO() {
  return io;
}

module.exports = {
  initializeSocket,
  emitSaleCreated,
  emitStockAlert,
  emitLocationUpdate,
  getIO
};
