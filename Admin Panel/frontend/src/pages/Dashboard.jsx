import React, { useEffect, useState } from 'react';
import { adminAPI } from '../utils/api';
import './Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await adminAPI.getStats();
      setStats(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Users</h3>
          <div className="stat-value">{stats?.users?.total || 0}</div>
        </div>
        
        <div className="stat-card">
          <h3>Parcels</h3>
          <div className="stat-value">{stats?.parcels?.total || 0}</div>
          <div className="stat-detail">
            {stats?.parcels?.owned || 0} owned, {stats?.parcels?.for_sale || 0} for sale
          </div>
        </div>
        
        <div className="stat-card">
          <h3>Transactions</h3>
          <div className="stat-value">{stats?.transactions?.total || 0}</div>
          <div className="stat-detail">
            Volume: {formatCurrency(stats?.transactions?.total_volume_cents || 0)}
          </div>
        </div>
        
        <div className="stat-card">
          <h3>Total Wallet Balance</h3>
          <div className="stat-value">{formatCurrency(stats?.wallets?.total_balance_cents || 0)}</div>
        </div>
        
        <div className="stat-card">
          <h3>Pending KYC</h3>
          <div className="stat-value">{stats?.kyc?.pending || 0}</div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

