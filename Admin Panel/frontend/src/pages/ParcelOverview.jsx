import React, { useEffect, useState } from 'react';
import { adminAPI } from '../utils/api';
import './ParcelOverview.css';

function ParcelOverview() {
  const [parcels, setParcels] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadParcels();
  }, [pagination.page, filters]);

  const loadParcels = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getParcels({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      });
      setParcels(response.data.parcels);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error loading parcels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('This will create new parcels. Continue?')) {
      return;
    }

    setSeeding(true);
    try {
      await adminAPI.seedParcels({
        resolution: 9,
        bbox: {
          minLon: -122.5,
          minLat: 37.7,
          maxLon: -122.3,
          maxLat: 37.8,
        },
      });
      alert('Parcels seeded successfully!');
      loadParcels();
    } catch (error) {
      alert('Error seeding parcels: ' + (error.response?.data?.message || error.message));
    } finally {
      setSeeding(false);
    }
  };

  const formatPrice = (cents) => {
    if (!cents) return 'Not for sale';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="parcel-overview">
      <div className="page-header">
        <h1>Parcel Overview</h1>
        <button onClick={handleSeed} disabled={seeding} className="seed-button">
          {seeding ? 'Seeding...' : 'Seed Parcels'}
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Filter by owner ID"
          value={filters.owner_id || ''}
          onChange={(e) => setFilters({ ...filters, owner_id: e.target.value || undefined })}
        />
        <input
          type="number"
          placeholder="Min price (cents)"
          value={filters.min_price || ''}
          onChange={(e) => setFilters({ ...filters, min_price: e.target.value || undefined })}
        />
        <input
          type="number"
          placeholder="Max price (cents)"
          value={filters.max_price || ''}
          onChange={(e) => setFilters({ ...filters, max_price: e.target.value || undefined })}
        />
        <button onClick={() => setFilters({})}>Clear Filters</button>
      </div>

      {loading ? (
        <div className="loading">Loading parcels...</div>
      ) : (
        <>
          <div className="table-container">
            <table className="parcels-table">
              <thead>
                <tr>
                  <th>Parcel ID</th>
                  <th>Owner ID</th>
                  <th>Price</th>
                  <th>Available for Rent</th>
                </tr>
              </thead>
              <tbody>
                {parcels.map((parcel) => (
                  <tr key={parcel.parcel_id}>
                    <td>{parcel.parcel_id}</td>
                    <td>{parcel.owner_id || 'Unowned'}</td>
                    <td>{formatPrice(parcel.price_cents)}</td>
                    <td>{parcel.available_for_rent ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ParcelOverview;

