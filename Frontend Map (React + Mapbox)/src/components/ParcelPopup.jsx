import React, { useState } from 'react';
import { buyParcel } from '../utils/api';
import './ParcelPopup.css';

function ParcelPopup({ parcel, onClose, authToken, onBuySuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const { id: parcelId, properties } = parcel;
  const { price_cents, owner_id } = properties || {};

  const handleBuy = async () => {
    if (!authToken) {
      setError('Authentication required. Please log in.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await buyParcel(parcelId, authToken);
      setSuccess(true);
      if (onBuySuccess) {
        onBuySuccess(parcelId);
      }
      // Close popup after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to buy parcel';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents) => {
    if (!cents) return 'Not for sale';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="parcel-popup">
      <div className="parcel-popup-header">
        <h3>Parcel Details</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="parcel-popup-content">
        <div className="parcel-info">
          <div className="info-row">
            <span className="label">Parcel ID:</span>
            <span className="value">{parcelId}</span>
          </div>
          
          <div className="info-row">
            <span className="label">Owner:</span>
            <span className="value">{owner_id || 'Unowned'}</span>
          </div>
          
          <div className="info-row">
            <span className="label">Price:</span>
            <span className="value">{formatPrice(price_cents)}</span>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            Parcel purchased successfully!
          </div>
        )}

        {price_cents && price_cents > 0 && (
          <button
            className="buy-button"
            onClick={handleBuy}
            disabled={loading || success}
          >
            {loading ? 'Processing...' : success ? 'Purchased!' : 'Buy Parcel'}
          </button>
        )}
      </div>
    </div>
  );
}

export default ParcelPopup;

