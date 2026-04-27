import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { getClientLastSales } from '../services/api';

const ClientHistoryScreen = ({ route }) => {
  const { clientId, clientName } = route.params;
  const [lastSales, setLastSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLastSales();
  }, [clientId]);

  const fetchLastSales = async () => {
    try {
      const response = await getClientLastSales(clientId);
      setLastSales(response.data);
    } catch (error) {
      console.error('Error al obtener historial:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (lastSales.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.emptyText}>Sin historial de ventas</Text>
      </View>
    );
  }

  // Obtener productos sugeridos (IA simple)
  const getSuggestedProducts = () => {
    const productFrequency = {};
    
    lastSales.forEach(sale => {
      sale.items.forEach(item => {
        const key = item.product_id;
        productFrequency[key] = (productFrequency[key] || 0) + 1;
      });
    });

    // Ordenar por frecuencia y retornar los 5 más frecuentes
    return Object.entries(productFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([productId, frequency]) => {
        const allItems = lastSales.flatMap(s => s.items);
        const itemData = allItems.find(item => item.product_id === productId);
        return { ...itemData, frequency };
      });
  };

  const suggestedProducts = getSuggestedProducts();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de {clientName}</Text>
        <Text style={styles.subTitle}>Últimas 3 ventas</Text>
      </View>

      {/* Productos sugeridos por IA */}
      {suggestedProducts.length > 0 && (
        <View style={styles.suggestionsSection}>
          <Text style={styles.sectionTitle}>💡 Sugerencias (Basado en historial)</Text>
          <FlatList
            data={suggestedProducts}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.suggestionCard}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.frequency}>
                  Comprado {item.frequency}x
                </Text>
                <TouchableOpacity style={styles.suggestButton}>
                  <Text style={styles.buttonText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {/* Historial de ventas */}
      <Text style={styles.sectionTitle}>Últimas Ventas</Text>
      <FlatList
        data={lastSales}
        keyExtractor={(item) => item.id}
        renderItem={({ item: sale }) => (
          <View style={styles.saleCard}>
            <View style={styles.saleHeader}>
              <Text style={styles.saleDate}>
                {new Date(sale.created_at).toLocaleDateString()}
              </Text>
              <Text style={styles.saleTotal}>${sale.total_amount}</Text>
            </View>

            {sale.items.map((item, index) => (
              <View key={index} style={styles.saleItem}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQuantity}>
                  {item.quantity}x ${item.unit_price}
                </Text>
              </View>
            ))}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 16,
    paddingTop: 32,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  suggestionsSection: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 8,
  },
  suggestionCard: {
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 140,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
  },
  frequency: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  suggestButton: {
    backgroundColor: '#2196F3',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saleCard: {
    backgroundColor: 'white',
    margin: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
    marginBottom: 8,
  },
  saleDate: {
    fontSize: 12,
    color: '#666',
  },
  saleTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  saleItem: {
    paddingVertical: 6,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
  },
  itemQuantity: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default ClientHistoryScreen;
