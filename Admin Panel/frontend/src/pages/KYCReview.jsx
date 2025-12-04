import React, { useEffect, useState } from 'react';
import { adminAPI } from '../utils/api';
import './KYCReview.css';

function KYCReview() {
  const [submissions, setSubmissions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState({});

  useEffect(() => {
    loadPendingKYC();
  }, [pagination.page]);

  const loadPendingKYC = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getPendingKYC({
        page: pagination.page,
        limit: pagination.limit,
      });
      setSubmissions(response.data.submissions);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error loading KYC submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (userId, status) => {
    setVerifying({ ...verifying, [userId]: true });
    try {
      await adminAPI.verifyKYC(userId, status);
      alert(`KYC ${status} successfully`);
      loadPendingKYC();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setVerifying({ ...verifying, [userId]: false });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="kyc-review">
      <h1>KYC Review</h1>

      {loading ? (
        <div className="loading">Loading pending KYC submissions...</div>
      ) : submissions.length === 0 ? (
        <div className="empty-state">No pending KYC submissions</div>
      ) : (
        <>
          <div className="submissions-list">
            {submissions.map((submission) => (
              <div key={submission.id} className="submission-card">
                <div className="submission-header">
                  <h3>{submission.full_name}</h3>
                  <span className="submission-date">
                    Submitted: {formatDate(submission.submitted_at)}
                  </span>
                </div>
                
                <div className="submission-details">
                  <div className="detail-row">
                    <span className="label">User:</span>
                    <span className="value">{submission.email} ({submission.display_name})</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Date of Birth:</span>
                    <span className="value">{submission.date_of_birth}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">ID Type:</span>
                    <span className="value">{submission.id_type}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">ID Number:</span>
                    <span className="value">{submission.id_number}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Status:</span>
                    <span className="value status-badge">{submission.status}</span>
                  </div>
                </div>

                <div className="submission-actions">
                  <button
                    onClick={() => handleVerify(submission.user_id, 'verified')}
                    disabled={verifying[submission.user_id]}
                    className="verify-button"
                  >
                    {verifying[submission.user_id] ? 'Processing...' : 'Verify'}
                  </button>
                  <button
                    onClick={() => handleVerify(submission.user_id, 'rejected')}
                    disabled={verifying[submission.user_id]}
                    className="reject-button"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
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

export default KYCReview;

