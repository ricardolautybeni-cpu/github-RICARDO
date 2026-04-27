# 📱 Guía Frontend Móvil

## Características

### 1. Pantalla de Punto de Venta (POS)

```
┌─────────────────────────┐
│ 🔗 En Línea / 📴 Offline│  ← Estado de conexión
├─────────────────────────┤
│ Código de Producto      │
│ [_____________________]│  ← Scanner/búsqueda
├─────────────────────────┤
│ Nombre: Aceite Premium  │  ← Producto seleccionado
│ Precio: $25.00          │
│ Stock: 45               │
│ ┌──────────────────────┐│
│ │ Cantidad │ Bonificac.││
│ │ [  ___  ] │ [  ___  ]││
│ └──────────────────────┘│
│     [Agregar al Carrito]│
├─────────────────────────┤
│ CARRITO (3 items)       │
│ • Aceite x5 = $125.00   │
│ • Harina x10 = $30.00   │
│ • Azúcar x3 = $9.00     │
│                Total: $164.00
├─────────────────────────┤
│ [Seleccionar Cliente]   │
│ [Guardar Venta]         │
└─────────────────────────┘
```

### 2. Historial de Cliente

```
┌─────────────────────────┐
│ Historial de Juan López │
│ Últimas 3 ventas        │
├─────────────────────────┤
│ 💡 Sugerencias:         │  ← IA
│ ┌─────────┬─────────┬───┤
│ │ Aceite  │ Harina  │Leche
│ │ 5 comp. │3 comp.  │2x     │
│ └─────────┴─────────┴───┤
├─────────────────────────┤
│ 📅 2024-01-15 - $165.00 │
│ • Aceite x5             │
│ • Harina x10            │
│ • Azúcar x3             │
├─────────────────────────┤
│ 📅 2024-01-10 - $245.00 │
│ • Aceite x7             │
│ • Manteca x2            │
│ • Café x5               │
├─────────────────────────┤
│ 📅 2024-01-05 - $89.50  │
│ • Harina x5             │
│ • Sal x2                │
└─────────────────────────┘
```

## Flujo de Uso

### Caso 1: Venta Normal (Con conexión)
1. Usuario escanea código producto
2. Ingresa cantidad y bonificación
3. Agrega al carrito
4. Selecciona cliente
5. Presiona "Guardar Venta"
6. ✅ Venta se envía al servidor
7. ✅ Stock se actualiza en tiempo real

### Caso 2: Venta Sin Conexión
1. Usuario hace mismos pasos
2. Presiona "Guardar Venta"
3. ✅ Se guarda localmente (SQLite)
4. Indicador 📴 aparece
5. Cuando hay conexión:
   - App intenta sincronizar automáticamente
   - Se envía al servidor en background
   - ✅ Estado cambia a 🔗

### Caso 3: Sugerencias de Compra
1. Usuario busca cliente
2. Ve últimas 3 ventas
3. IA muestra "Sugerencias" (productos que compró antes)
4. Usuario puede hacer tap para agregar rápidamente

## Teclado Numérico

Las entradas de cantidad y bonificación usan:
- Teclado nativo numérico del dispositivo
- Validación en tiempo real
- No permite valores negativos
- Cálculo automático de subtotales

## Sincronización Automática

**Protocolo:**
```
App intenta sincronizar cada:
- 30 segundos (si hay ventas pendientes)
- Al abrir la app
- Al cambiar de online a offline
- Cuando las ventas se guardan localmente
```

**Estado de Sincronización:**
- 🔗 En línea y sincronizado
- 📴 Offline (sin conexión)
- ⏳ Pendiente de sincronización
- ✅ Sincronizado correctamente
- ❌ Error en sincronización

## Tips de Uso

✅ **Búsqueda rápida:** Escanea código de barras
✅ **Clientes frecuentes:** Guarda en favoritos
✅ **Stock en tiempo real:** Refresh automático
✅ **Offline:** Funciona sin conexión
✅ **Historial:** Últimas 100 ventas disponibles

## Problemas Comunes

| Problema | Solución |
|----------|----------|
| "Producto no encontrado" | Verifica código/descripción |
| "Stock insuficiente" | Reduce cantidad |
| "No sincroniza" | Verifica conexión WiFi/datos |
| "Cliente no aparece" | Búsqueda por inicio del nombre |
| "App se reinicia" | Limpia cache y reinstala |
