import React, { useState, useEffect } from 'react';
import { getSales } from '../services/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const DashboardScreen = () => {
  const [salesData, setSalesData] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [productPerformance, setProductPerformance] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const response = await getSales({
        start_date: thirtyDaysAgo.toISOString(),
        limit: 1000
      });

      setSalesData(response.data);
      processSalesData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processSalesData = (sales) => {
    // Agrupar por día
    const dailyMap = {};
    const productMap = {};

    sales.forEach(sale => {
      const date = new Date(sale.created_at).toLocaleDateString();
      dailyMap[date] = (dailyMap[date] || 0) + sale.total_amount;

      // Por producto (si tenemos items)
      if (sale.items) {
        sale.items.forEach(item => {
          const key = item.product_id;
          productMap[key] = (productMap[key] || { name: item.name, sales: 0, quantity: 0 });
          productMap[key].sales += item.subtotal;
          productMap[key].quantity += item.quantity;
        });
      }
    });

    // Convertir a arrays
    const daily = Object.entries(dailyMap)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, amount]) => ({ date, amount }));

    const products = Object.entries(productMap)
      .map(([id, data]) => ({ ...data, id }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    setDailySales(daily);
    setProductPerformance(products);
  };

  const totalSales = salesData.reduce((sum, sale) => sum + sale.total_amount, 0);
  const totalTransactions = salesData.length;
  const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0'];

  if (isLoading) {
    return <div style={{ padding: 20, textAlign: 'center' }}>Cargando...</div>;
  }

  return (
    <div style={styles.container}>
      <h1>📊 Dashboard</h1>

      {/* KPIs */}
      <div style={styles.kpiContainer}>
        <div style={styles.kpiCard}>
          <h3>Ventas Totales (30 días)</h3>
          <p style={styles.kpiValue}>${totalSales.toFixed(2)}</p>
        </div>
        <div style={styles.kpiCard}>
          <h3>Transacciones</h3>
          <p style={styles.kpiValue}>{totalTransactions}</p>
        </div>
        <div style={styles.kpiCard}>
          <h3>Promedio por Venta</h3>
          <p style={styles.kpiValue}>${avgTransaction.toFixed(2)}</p>
        </div>
      </div>

      {/* Gráficos */}
      <div style={styles.chartsContainer}>
        {/* Ventas por día */}
        <div style={styles.chartWrapper}>
          <h2>Ventas por Día</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip formatter={(value) => `$${value}`} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#4CAF50"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Productos más vendidos */}
        <div style={styles.chartWrapper}>
          <h2>Top 10 Productos</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip formatter={(value) => `$${value}`} />
              <Bar dataKey="sales" fill="#2196F3" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de ventas recientes */}
      <div style={styles.tableWrapper}>
        <h2>Ventas Recientes</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Cliente</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {salesData.slice(0, 10).map((sale) => (
              <tr key={sale.id}>
                <td>{new Date(sale.created_at).toLocaleDateString()}</td>
                <td>{sale.full_name}</td>
                <td>{sale.client_name || 'Mostrador'}</td>
                <td>${sale.total_amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  kpiContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  },
  kpiCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  kpiValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#4CAF50',
    margin: '10px 0 0 0',
  },
  chartsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  },
  chartWrapper: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  tableWrapper: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '16px',
  },
};

export default DashboardScreen;
