import React, { useState, useEffect } from 'react';
import MapView from './MapView';
import Header from './components/Header';
import LoginForm from './components/Login';
import RegisterForm from './components/Register';
import './App.css';

function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');
  const [user, setUser] = useState(() => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  });
  const [showAuth, setShowAuth] = useState(!authToken);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'

  useEffect(() => {
    if (authToken) {
      setShowAuth(false);
    }
  }, [authToken]);

  const handleLogin = (token, userData) => {
    setAuthToken(token);
    setUser(userData);
    setShowAuth(false);
    setAuthMode('login');
  };

  const handleRegister = (token, userData) => {
    setAuthToken(token);
    setUser(userData);
    setShowAuth(false);
    setAuthMode('login');
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setAuthToken('');
    setUser(null);
    setShowAuth(true);
    setAuthMode('login');
  };

  const handleBuySuccess = (parcelId) => {
    console.log('Parcel purchased:', parcelId);
    // You can add additional logic here, like showing a notification
  };

  return (
    <div className="App">
      <Header 
        user={user} 
        authToken={authToken} 
        onLogout={handleLogout}
      />
      
      {showAuth ? (
        <div className="auth-overlay">
          <div className="auth-container">
            {authMode === 'login' ? (
              <LoginForm 
                onLogin={handleLogin}
                onSwitchToRegister={() => setAuthMode('register')}
              />
            ) : (
              <RegisterForm 
                onRegister={handleRegister}
                onSwitchToLogin={() => setAuthMode('login')}
              />
            )}
          </div>
        </div>
      ) : (
        <MapView 
          authToken={authToken} 
          onBuySuccess={handleBuySuccess}
        />
      )}
    </div>
  );
}

export default App;

