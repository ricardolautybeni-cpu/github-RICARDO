import React, { useState, useEffect } from 'react';
import { getInventory } from '../services/api';

const InventoryScreen = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'low_stock'

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await getInventory();
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = filter === 'low_stock'
    ? products.filter(p => p.low_stock)
    : products;

  if (isLoading) {
    return <div style={{ padding: 20 }}>Cargando inventario...</div>;
  }

  return (
    <div style={styles.container}>
      <h1>📦 Inventario</h1>

      <div style={styles.filterContainer}>
        <button
          style={{
            ...styles.filterButton,
            backgroundColor: filter === 'all' ? '#4CAF50' : '#ccc',
          }}
          onClick={() => setFilter('all')}
        >
          Todo ({products.length})
        </button>
        <button
          style={{
            ...styles.filterButton,
            backgroundColor: filter === 'low_stock' ? '#FF9800' : '#ccc',
          }}
          onClick={() => setFilter('low_stock')}
        >
          Stock Bajo ({products.filter(p => p.low_stock).length})
        </button>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th>Código</th>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Stock</th>
            <th>Mínimo</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.map((product) => (
            <tr key={product.id} style={product.low_stock ? { backgroundColor: '#fff3cd' } : {}}>
              <td>{product.code}</td>
              <td>{product.name}</td>
              <td>{product.category_name || '-'}</td>
              <td style={{ fontWeight: 'bold' }}>{product.stock}</td>
              <td>{product.min_stock}</td>
              <td>
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: product.low_stock ? '#FFE0B2' : '#C8E6C9',
                    color: product.low_stock ? '#E65100' : '#2E7D32',
                  }}
                >
                  {product.low_stock ? '⚠️ Bajo' : '✅ OK'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  filterContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  filterButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    color: 'white',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
};

export default InventoryScreen;
