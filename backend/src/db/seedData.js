// Datos de prueba para insertar en la BD

const seedData = {
  users: [
    {
      email: 'admin@distribuidora.test',
      password: 'admin123456',  // Se hashea antes de insertar
      full_name: 'Administrador',
      role: 'admin'
    },
    {
      email: 'juan@distribuidora.test',
      password: 'juan123456',
      full_name: 'Juan Rodríguez',
      role: 'seller'
    },
    {
      email: 'maria@distribuidora.test',
      password: 'maria123456',
      full_name: 'María López',
      role: 'seller'
    }
  ],

  categories: [
    { name: 'Alimentos Secos' },
    { name: 'Bebidas' },
    { name: 'Productos de Limpieza' },
    { name: 'Artículos de Almacén' },
    { name: 'Congelados' }
  ],

  products: [
    // Alimentos Secos
    { code: 'AR-001', name: 'Arroz Integral', price: 45.00, cost: 30.00, stock: 100 },
    { code: 'HR-001', name: 'Harina 000', price: 35.00, cost: 25.00, stock: 80 },
    { code: 'AZ-001', name: 'Azúcar Blanca', price: 28.00, cost: 18.00, stock: 120 },
    { code: 'SAL-001', name: 'Sal Fina', price: 12.00, cost: 8.00, stock: 200 },
    { code: 'CAF-001', name: 'Café Molido', price: 120.00, cost: 80.00, stock: 45 },

    // Bebidas
    { code: 'BEB-001', name: 'Agua Mineral 2L', price: 32.00, cost: 20.00, stock: 150 },
    { code: 'BEB-002', name: 'Gaseosa Cola 2L', price: 42.00, cost: 28.00, stock: 100 },
    { code: 'BEB-003', name: 'Jugo Naranja 1L', price: 38.00, cost: 25.00, stock: 80 },
    { code: 'LEC-001', name: 'Leche Entera 1L', price: 52.00, cost: 35.00, stock: 120 },

    // Productos de Limpieza
    { code: 'LIM-001', name: 'Detergente Polvo', price: 85.00, cost: 55.00, stock: 60 },
    { code: 'LIM-002', name: 'Desinfectante', price: 45.00, cost: 30.00, stock: 75 },
    { code: 'LIM-003', name: 'Jabón Líquido', price: 55.00, cost: 35.00, stock: 90 },

    // Aceites y Condimentos
    { code: 'ACE-001', name: 'Aceite de Oliva', price: 180.00, cost: 110.00, stock: 35 },
    { code: 'ACE-002', name: 'Aceite Sunflower', price: 95.00, cost: 60.00, stock: 50 },
  ],

  clients: [
    {
      name: 'Supermercado Central',
      document_type: 'ruc',
      document_number: '20123456789',
      email: 'compras@supermercado.com',
      phone: '0111234567',
      address: 'Av Principal 123'
    },
    {
      name: 'Almacén del Barrio',
      document_type: 'cuit',
      document_number: '27987654321',
      email: 'info@almacen.com',
      phone: '0112345678',
      address: 'Calle 5 456'
    },
    {
      name: 'Tienda Juan López',
      document_type: 'dni',
      document_number: '12345678',
      email: 'juan@tienda.com',
      phone: '0113456789',
      address: 'Calle 10 789'
    },
    {
      name: 'Distribuidora Regional',
      document_type: 'ruc',
      document_number: '20987654321',
      email: 'ventas@regional.com',
      phone: '0114567890',
      address: 'Ruta Nacional Km 25'
    }
  ]
};

module.exports = seedData;
