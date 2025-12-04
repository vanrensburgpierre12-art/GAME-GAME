import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Layout.css';

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>Admin Panel</h2>
        </div>
        <ul className="sidebar-menu">
          <li>
            <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/parcels" className={isActive('/parcels') ? 'active' : ''}>
              Parcels
            </Link>
          </li>
          <li>
            <Link to="/kyc" className={isActive('/kyc') ? 'active' : ''}>
              KYC Review
            </Link>
          </li>
          <li>
            <Link to="/transactions" className={isActive('/transactions') ? 'active' : ''}>
              Transactions
            </Link>
          </li>
          <li>
            <Link to="/users" className={isActive('/users') ? 'active' : ''}>
              Users
            </Link>
          </li>
        </ul>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;

