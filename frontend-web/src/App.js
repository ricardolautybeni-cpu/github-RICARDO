import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import DashboardScreen from './screens/DashboardScreen';
import InventoryScreen from './screens/InventoryScreen';
import useAuthStore from './stores/authStore';
import { login } from './services/api';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

function LoginPage({ onLogin, error, email, setEmail, password, setPassword }) {
  return (
    <div style={styles.loginContainer}>
      <h1>Iniciar sesión</h1>
      <form style={styles.loginForm} onSubmit={onLogin}>
        <label style={styles.label}>
          Correo electrónico
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label style={styles.label}>
          Contraseña
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div style={styles.error}>{error}</div>}
        <button style={styles.loginButton} type="submit">Entrar</button>
      </form>
    </div>
  );
}

function App() {
  const { user, token, login: loginStore, logout, hydrate } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const response = await login(email, password);
      loginStore(response.data.user, response.data.accessToken);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al iniciar sesión');
    }
  };

  return (
    <BrowserRouter>
      <div style={styles.appContainer}>
        <header style={styles.header}>
          <div>
            <Link to="/" style={styles.logo}>
              Distribuidora V3
            </Link>
          </div>
          {token && (
            <nav style={styles.nav}>
              <Link to="/" style={styles.navLink}>Dashboard</Link>
              <Link to="/inventory" style={styles.navLink}>Inventario</Link>
              <button style={styles.logoutButton} onClick={logout}>Cerrar sesión</button>
            </nav>
          )}
        </header>

        <main style={styles.main}>
          <Routes>
            <Route
              path="/login"
              element={
                token ? (
                  <Navigate to="/" replace />
                ) : (
                  <LoginPage
                    onLogin={handleLogin}
                    error={error}
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                  />
                )
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <InventoryScreen />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to={token ? '/' : '/login'} replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

const styles = {
  appContainer: {
    fontFamily: 'Arial, sans-serif',
    minHeight: '100vh',
    backgroundColor: '#eef2f7'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logo: {
    color: '#0077cc',
    textDecoration: 'none',
    fontSize: '20px',
    fontWeight: '700'
  },
  nav: {
    display: 'flex',
    gap: '14px',
    alignItems: 'center'
  },
  navLink: {
    textDecoration: 'none',
    color: '#333',
    fontWeight: '600'
  },
  logoutButton: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#f44336',
    color: 'white',
    cursor: 'pointer'
  },
  main: {
    minHeight: 'calc(100vh - 80px)'
  },
  loginContainer: {
    display: 'flex',
    minHeight: 'calc(100vh - 80px)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  loginForm: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 12px 30px rgba(0,0,0,0.08)'
  },
  label: {
    display: 'block',
    marginBottom: '16px',
    fontWeight: '600',
    color: '#333'
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #ddd',
    marginTop: '8px'
  },
  loginButton: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#0077cc',
    color: 'white',
    fontWeight: '700',
    cursor: 'pointer'
  },
  error: {
    color: '#d32f2f',
    marginBottom: '12px',
    fontSize: '14px'
  }
};

export default App;
