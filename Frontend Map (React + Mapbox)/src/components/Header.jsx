import React, { useState, useEffect } from 'react';
import { getWallet } from '../utils/api';
import DepositModal from './DepositModal';
import './Header.css';

function Header({ user, authToken, onLogout }) {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (authToken) {
      loadWallet();
    }
  }, [authToken]);

  const loadWallet = async () => {
    setLoading(true);
    try {
      const walletData = await getWallet(authToken);
      setWallet(walletData);
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleDepositSuccess = () => {
    loadWallet(); // Reload wallet after successful deposit
  };

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">Parcel Marketplace</h1>
          </div>
          <nav className="header-nav">
            {user ? (
              <>
                <div className="nav-item wallet-section">
                  <div className="wallet-info">
                    <span className="wallet-label">Balance:</span>
                    <span className="wallet-amount">
                      {wallet ? formatBalance(wallet.balance_cents) : '$0.00'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowDepositModal(true)}
                    className="deposit-button"
                    title="Deposit funds"
                  >
                    + Deposit
                  </button>
                </div>
                <div className="nav-item user-menu-container">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="user-menu-button"
                    title="User menu"
                  >
                    <span className="user-name">{user.display_name}</span>
                    <span className="menu-arrow">▼</span>
                  </button>
                  {showUserMenu && (
                    <div className="user-menu-dropdown">
                      <div className="user-menu-item">
                        <span className="menu-label">Email:</span>
                        <span className="menu-value">{user.email}</span>
                      </div>
                      <div className="user-menu-item">
                        <span className="menu-label">KYC Status:</span>
                        <span className={`menu-value status-${user.kyc_status}`}>
                          {user.kyc_status || 'none'}
                        </span>
                      </div>
                      <div className="menu-divider"></div>
                      <button
                        onClick={onLogout}
                        className="menu-logout-button"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <span className="not-logged-in">Not logged in</span>
            )}
          </nav>
        </div>
      </header>
      {showDepositModal && (
        <DepositModal
          isOpen={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          authToken={authToken}
          onDepositSuccess={handleDepositSuccess}
        />
      )}
      {showUserMenu && (
        <div
          className="menu-overlay"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </>
  );
}

export default Header;

