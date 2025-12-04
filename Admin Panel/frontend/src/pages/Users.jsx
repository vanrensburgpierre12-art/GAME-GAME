import React, { useEffect, useState } from 'react';
import { adminAPI } from '../utils/api';
import './Users.css';

function Users() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadUsers();
  }, [pagination.page, filters]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getUsers({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      });
      setUsers(response.data.users);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="users-page">
      <h1>Users</h1>

      <div className="filters">
        <select
          value={filters.kyc_status || ''}
          onChange={(e) => setFilters({ ...filters, kyc_status: e.target.value || undefined })}
        >
          <option value="">All KYC Statuses</option>
          <option value="none">None</option>
          <option value="submitted">Submitted</option>
          <option value="verified">Verified</option>
        </select>
        <button onClick={() => setFilters({})}>Clear Filters</button>
      </div>

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <>
          <div className="table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display Name</th>
                  <th>KYC Status</th>
                  <th>Admin</th>
                  <th>Balance</th>
                  <th>Parcels Owned</th>
                  <th>Transactions</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.display_name}</td>
                    <td>
                      <span className={`kyc-badge kyc-${user.kyc_status}`}>
                        {user.kyc_status}
                      </span>
                    </td>
                    <td>{user.is_admin ? 'Yes' : 'No'}</td>
                    <td>{formatCurrency(user.balance_cents)}</td>
                    <td>{user.parcels_owned}</td>
                    <td>{user.transactions_count}</td>
                    <td>{formatDate(user.created_at)}</td>
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

export default Users;

