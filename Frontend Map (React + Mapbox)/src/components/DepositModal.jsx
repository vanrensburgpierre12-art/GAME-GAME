import React, { useState } from 'react';
import { deposit } from '../utils/api';
import './DepositModal.css';

function DepositModal({ isOpen, onClose, authToken, onDepositSuccess }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!amountCents || amountCents <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const result = await deposit(amountCents, authToken);
      setSuccess(true);
      if (onDepositSuccess) {
        onDepositSuccess(result);
      }
      // Close after 2 seconds
      setTimeout(() => {
        onClose();
        setAmount('');
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Deposit failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Deposit Funds</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Amount (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              disabled={loading || success}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          {success && (
            <div className="success-message">
              Deposit initiated! Redirecting to payment...
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="cancel-button"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={loading || success}
            >
              {loading ? 'Processing...' : success ? 'Redirecting...' : 'Deposit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DepositModal;

