import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { getProductByCode, createSale } from '../services/api';
import { createSaleLocal, getUnsyncedSales, markSaleSynced } from '../services/syncService';

const PosScreen = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [bonus, setBonus] = useState('');
  const [cart, setCart] = useState([]);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showClientModal, setShowClientModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Buscar producto por código
  const searchProduct = async (code) => {
    if (code.length < 3) return;
    
    try {
      const response = await getProductByCode(code);
      setSelectedProduct(response.data);
    } catch (error) {
      Alert.alert('Error', 'Producto no encontrado');
    }
  };

  // Agregar producto al carrito
  const addToCart = () => {
    if (!selectedProduct || !quantity) {
      Alert.alert('Error', 'Ingresa cantidad');
      return;
    }

    const qty = parseInt(quantity);
    const bon = parseInt(bonus) || 0;

    if (qty > selectedProduct.stock) {
      Alert.alert('Error', `Stock insuficiente. Disponible: ${selectedProduct.stock}`);
      return;
    }

    const cartItem = {
      id: selectedProduct.id,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      code: selectedProduct.code,
      quantity: qty,
      bonus: bon,
      unit_price: selectedProduct.price,
      subtotal: qty * selectedProduct.price
    };

    setCart([...cart, cartItem]);
    setSelectedProduct(null);
    setQuantity('');
    setBonus('');
    setSearchText('');
  };

  // Eliminar item del carrito
  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  // Procesar venta
  const processSale = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'El carrito está vacío');
      return;
    }

    setIsLoading(true);

    try {
      if (isOnline && clientId) {
        // Enviar al servidor
        await createSale({
          client_id: clientId,
          items: cart,
          payment_method: paymentMethod
        });
      } else {
        // Guardar localmente
        await createSaleLocal(clientId, cart, paymentMethod);
      }

      Alert.alert('Éxito', 'Venta registrada');
      setCart([]);
      setClientName('');
      setClientId(null);
      setPaymentMethod('cash');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <View style={styles.container}>
      {/* Header con estado online/offline */}
      <View style={[styles.header, { backgroundColor: isOnline ? '#4CAF50' : '#FF9800' }]}>
        <Text style={styles.headerText}>
          {isOnline ? '🔗 En Línea' : '📴 Sin Conexión'}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Búsqueda por código */}
        <Text style={styles.label}>Código de Producto</Text>
        <TextInput
          style={styles.input}
          placeholder="Escanea o escribe el código"
          value={searchText}
          onChangeText={(text) => {
            setSearchText(text);
            searchProduct(text);
          }}
          keyboardType="default"
        />

        {/* Producto seleccionado */}
        {selectedProduct && (
          <View style={styles.productCard}>
            <Text style={styles.productName}>{selectedProduct.name}</Text>
            <Text style={styles.productPrice}>${selectedProduct.price}</Text>
            <Text style={styles.productStock}>Stock: {selectedProduct.stock}</Text>

            {/* Cantidad y Bonificación */}
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Cantidad</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Bonificación</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={bonus}
                  onChangeText={setBonus}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={addToCart}>
              <Text style={styles.buttonText}>Agregar al Carrito</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Carrito */}
        <Text style={styles.sectionTitle}>Carrito ({cart.length} items)</Text>
        {cart.map((item) => (
          <View key={item.id} style={styles.cartItem}>
            <View>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemDetails}>
                {item.quantity}x ${item.unit_price} = ${item.subtotal}
              </Text>
              {item.bonus > 0 && (
                <Text style={styles.bonusText}>Bonificación: {item.bonus}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => removeFromCart(item.id)}>
              <Text style={styles.delayButton}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Total */}
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
        </View>
      </ScrollView>

      {/* Footer con botones de cliente y venta */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.clientButton}
          onPress={() => setShowClientModal(true)}
        >
          <Text style={styles.buttonText}>
            {clientName ? `Cliente: ${clientName}` : 'Seleccionar Cliente'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saleButton, { opacity: cart.length === 0 ? 0.5 : 1 }]}
          onPress={processSale}
          disabled={isLoading || cart.length === 0}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Guardar Venta</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    paddingTop: 32,
  },
  headerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productStock: {
    fontSize: 14,
    color: '#999',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  inputContainer: {
    flex: 1,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  cartItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  bonusText: {
    fontSize: 11,
    color: '#FF9800',
    marginTop: 2,
  },
  delayButton: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  totalContainer: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  footer: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  clientButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saleButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default PosScreen;
