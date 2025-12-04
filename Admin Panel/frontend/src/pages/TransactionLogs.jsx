import React, { useEffect, useState } from 'react';
import { adminAPI } from '../utils/api';
import './TransactionLogs.css';

function TransactionLogs() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadTransactions();
  }, [pagination.page, filters]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getTransactionLogs({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      });
      setTransactions(response.data.transactions);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="transaction-logs">
      <h1>Transaction Logs</h1>

      <div className="filters">
        <select
          value={filters.type || ''}
          onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}
        >
          <option value="">All Types</option>
          <option value="buy">Buy</option>
          <option value="list">List</option>
          <option value="deposit">Deposit</option>
          <option value="withdraw">Withdraw</option>
        </select>
        
        <select
          value={filters.status || ''}
          onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        
        <input
          type="date"
          placeholder="Start Date"
          value={filters.start_date || ''}
          onChange={(e) => setFilters({ ...filters, start_date: e.target.value || undefined })}
        />
        
        <input
          type="date"
          placeholder="End Date"
          value={filters.end_date || ''}
          onChange={(e) => setFilters({ ...filters, end_date: e.target.value || undefined })}
        />
        
        <button onClick={() => setFilters({})}>Clear Filters</button>
      </div>

      {loading ? (
        <div className="loading">Loading transactions...</div>
      ) : (
        <>
          <div className="table-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Parcel ID</th>
                  <th>Buyer/User</th>
                  <th>Seller</th>
                  <th>Amount</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.tx_id}>
                    <td>{formatDate(tx.created_at)}</td>
                    <td>
                      <span className={`type-badge type-${tx.type}`}>{tx.type}</span>
                    </td>
                    <td>
                      <span className="source-badge">{tx.source}</span>
                    </td>
                    <td>{tx.parcel_id || '-'}</td>
                    <td>{tx.buyer_id || '-'}</td>
                    <td>{tx.seller_id || '-'}</td>
                    <td>{formatCurrency(tx.price_cents)}</td>
                    <td>{tx.fee_cents > 0 ? formatCurrency(tx.fee_cents) : '-'}</td>
                    <td>
                      <span className={`status-badge status-${tx.status}`}>{tx.status}</span>
                    </td>
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

export default TransactionLogs;

