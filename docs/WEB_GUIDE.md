# 🌐 Guía Frontend Web (Dashboard Admin)

## Pantallas Principales

### 1. Login
```
┌──────────────────────────┐
│    DISTRIBUIDORA APP     │
│                          │
│ Email:  [_____________] │
│ Pass:   [_____________] │
│                          │
│      [INGRESAR]          │
│                          │
│  ¿No tienes cuenta?      │
│      [REGISTRAR]         │
└──────────────────────────┘
```

### 2. Dashboard Principal
```
┌─────────────────────────────────────────────┐
│ 📊 DASHBOARD                                │
├─────────────────────────────────────────────┤
│                                             │
│ ┌──────────┬────────────┬──────────────┐   │
│ │$165,425  │  524       │  $315.62     │   │
│ │Ventas    │Transacciones│Promedio     │   │
│ └──────────┴────────────┴──────────────┘   │
│                                             │
│ [Ventas por Día]    [Top 10 Productos]    │
│                                             │
│ Gráfico de línea      Gráfico de barras    │
│ últimos 30 días       by venta             │
│                                             │
├─────────────────────────────────────────────┤
│ ÚLTIMAS VENTAS                              │
│ Fecha      │ Usuario    │ Cliente   │ Monto│
│ 2024-01-20│ Juan R.    │ Tienda XYZ│ $450 │
│ 2024-01-20│ María L.   │ Local 5   │ $325 │
│ 2024-01-20│ Juan R.    │ Mostrador │ $180 │
└─────────────────────────────────────────────┘
```

### 3. Inventario
```
┌──────────────────────────────────────────────┐
│ 📦 INVENTARIO                                │
├──────────────────────────────────────────────┤
│ [Todo (45)]  [Stock Bajo (8)]               │
├──────────────────────────────────────────────┤
│ Código │Producto │Categoría│Stock│Min│Estado│
├────────┼─────────┼─────────┼─────┼───┼──────┤
│ AC-001 │Aceite P │Lubricad │  45 │10 │✅ OK │
│ HR-005 │Harina B │Alimentos│   3 │20 │⚠️ Bajo
│ AZ-003 │Azúcar   │Alimentos│  15 │ 5 │✅ OK │
│ CAF-02 │Café     │Alimentos│   8 │15 │⚠️ Bajo
└──────────────────────────────────────────────┘
```

### 4. Gestión de Productos
```
┌──────────────────────────────────────────────┐
│ 📦 PRODUCTOS                                │
├──────────────────────────────────────────────┤
│ [+ Nuevo Producto]  Buscar: [___________] │
├──────────────────────────────────────────────┤
│ Código │ Nombre      │Categoría│Precio│Stock│ 
├────────┼─────────────┼─────────┼──────┼─────┤
│ AC-001 │ Aceite Prem │Lubricad│ $25  │  45 │✏️
│ HR-005 │ Harina Buen │Alimen. │ $3.5 │   3 │✏️
│ AZ-003 │ Azúcar kg   │Alimen. │ $2.2 │  15 │✏️
└──────────────────────────────────────────────┘
```

### 5. Gestión de Usuarios
```
┌──────────────────────────────────────────────┐
│ 👥 VENDEDORES                               │
├──────────────────────────────────────────────┤
│ [+ Nuevo Usuario]                           │
├──────────────────────────────────────────────┤
│ Nombre       │ Email                │ Ventas│
├──────────────┼────────────────────┼───────┤
│ Juan Rodríg. │ juan@empresa.com    │  128  │
│ María López  │ maria@empresa.com   │   95  │
│ Carlos Díaz  │ carlos@empresa.com  │   67  │
└──────────────────────────────────────────────┘
```

## Reportes Detallados

### Reporte de Ventas por Período
```bash
GET /api/sales?start_date=2024-01-01&end_date=2024-01-31&limit=1000
```

Datos:
- Total vendido
- Promedio por transacción
- Número de transacciones
- Métodos de pago
- Usuarios más productivos

### Reporte de Productos
```bash
GET /api/products + analítica local
```

Datos:
- Productos más vendidos
- Margen de ganancia
- Rotación de stock
- Productos sin movimiento

### Reporte de Clientes
```bash
GET /api/clients + últimas ventas
```

Datos:
- Cliente más leal (más compras)
- Mayor monto gastado
- Deuda pendiente
- Últimas compras

## Gráficos

### 1. Línea - Ventas Diarias (30 días)
```
$
|     ╱╲         ╱╲
|    ╱  ╲       ╱  ╲
|   ╱    ╲     ╱    ╲
|  ╱      ╲___╱      ╲___
├─────────────────────────→ Días
```

### 2. Barras - Top 10 Productos
```
$ ████████ Aceite
  ██████   Harina
  █████    Azúcar
  ████     Sal
  ███      Café
  ███      Leche
  ██       Manteca
  ██       Arroz
  ██       Pasta
  █        Té
├─────────────────────
```

### 3. Pastel - Distribución de Métodos de Pago
```
        Efectivo 60%
       ╱─────────╲
      ╱           ╲
     │             │
     │  Dinero     │ Tarjeta 30%
     │   Electrónico
     │             │ Otros 10%
      ╲           ╱
       ╲─────────╱
```

## Funcionalidades

✅ **Filtros Avanzados**
- Por período de fechas
- Por usuario/vendedor
- Por cliente
- Por método de pago
- Por estado (completada, cancelada)

✅ **Exportación de Datos**
- Reportes en PDF
- Datos en Excel
- Gráficos en PNG

✅ **Gestión**
- Crear/Editar productos
- Crear/Editar usuarios
- Crear/Editar clientes
- Ajustar stock
- Cancelar ventas (si aplica)

✅ **Búsquedas**
- Por código de producto
- Por nombre de cliente
- Por email
- Por número de documento

## Permisos por Rol

| Función | Admin | Vendedor |
|---------|-------|----------|
| Crear venta | ✅ | ✅ |
| Ver dashboard | ✅ | ❌ |
| Gestionar productos | ✅ | ❌ |
| Gestionar usuarios | ✅ | ❌ |
| Ver reportes | ✅ | ✅* |
| Exportar datos | ✅ | ❌ |

*Vendedor solo ve sus propias ventas

## Atajos de Teclado

| Tecla | Acción |
|-------|--------|
| `Ctrl+N` | Nuevo producto |
| `Ctrl+F` | Buscar |
| `Ctrl+P` | Imprimir |
| `Ctrl+E` | Exportar |
| `Ctrl+S` | Guardar |

## Mobile Responsive

✅ Dashboard se adapta a:
- Desktop (1920x1080+)
- Tablet (768x1024)
- Mobile (375x667)

Todas las funciones disponibles en cualquier dispositivo.
