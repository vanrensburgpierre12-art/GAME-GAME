const pool = require('../config/database');

/**
 * Create a KYC submission
 * @param {string} userId - User ID (UUID)
 * @param {object} data - Submission data { full_name, date_of_birth, id_number, id_type }
 * @param {string} documentPath - Path to uploaded document file
 * @param {object} client - Database client (for transaction, optional)
 * @returns {Promise<object>} Created submission
 */
async function createSubmission(userId, data, documentPath, client = null) {
  const db = client || pool;
  
  const { full_name, date_of_birth, id_number, id_type } = data;
  
  // Validate required fields
  if (!full_name || !date_of_birth || !id_number || !id_type) {
    throw new Error('All fields are required: full_name, date_of_birth, id_number, id_type');
  }
  
  // Validate id_type
  const validIdTypes = ['passport', 'drivers_license', 'national_id'];
  if (!validIdTypes.includes(id_type)) {
    throw new Error(`Invalid id_type. Must be one of: ${validIdTypes.join(', ')}`);
  }
  
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date_of_birth)) {
    throw new Error('date_of_birth must be in format YYYY-MM-DD');
  }
  
  const query = `
    INSERT INTO kyc_submissions (user_id, full_name, date_of_birth, id_number, id_type, id_document_path, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
    RETURNING id, user_id, full_name, date_of_birth, id_number, id_type, id_document_path, status, submitted_at, verified_at, verified_by
  `;
  
  const result = await db.query(query, [
    userId,
    full_name,
    date_of_birth,
    id_number,
    id_type,
    documentPath || null,
  ]);
  
  return result.rows[0];
}

/**
 * Get latest submission for a user
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<object|null>} Latest submission or null
 */
async function getSubmissionByUserId(userId) {
  const query = `
    SELECT id, user_id, full_name, date_of_birth, id_number, id_type, id_document_path, status, submitted_at, verified_at, verified_by
    FROM kyc_submissions
    WHERE user_id = $1
    ORDER BY submitted_at DESC
    LIMIT 1
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
}

/**
 * Update submission status
 * @param {string} submissionId - Submission ID (UUID)
 * @param {string} status - New status ('verified' or 'rejected')
 * @param {string} adminId - Admin user ID who verified (UUID)
 * @param {object} client - Database client (for transaction, optional)
 * @returns {Promise<object>} Updated submission
 */
async function updateSubmissionStatus(submissionId, status, adminId, client = null) {
  const db = client || pool;
  
  // Validate status
  if (!['verified', 'rejected'].includes(status)) {
    throw new Error('Status must be "verified" or "rejected"');
  }
  
  const query = `
    UPDATE kyc_submissions
    SET status = $1, verified_at = NOW(), verified_by = $2
    WHERE id = $3
    RETURNING id, user_id, full_name, date_of_birth, id_number, id_type, id_document_path, status, submitted_at, verified_at, verified_by
  `;
  
  const result = await db.query(query, [status, adminId, submissionId]);
  
  if (result.rows.length === 0) {
    throw new Error('Submission not found');
  }
  
  return result.rows[0];
}

/**
 * Update user's kyc_status
 * @param {string} userId - User ID (UUID)
 * @param {string} status - New kyc_status ('none', 'submitted', 'verified')
 * @param {object} client - Database client (for transaction, optional)
 * @returns {Promise<object>} Updated user
 */
async function updateUserKycStatus(userId, status, client = null) {
  const db = client || pool;
  
  // Validate status
  if (!['none', 'submitted', 'verified'].includes(status)) {
    throw new Error('kyc_status must be "none", "submitted", or "verified"');
  }
  
  const query = `
    UPDATE users
    SET kyc_status = $1
    WHERE id = $2
    RETURNING id, email, display_name, kyc_status
  `;
  
  const result = await db.query(query, [status, userId]);
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  return result.rows[0];
}

/**
 * Get user's current kyc_status
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<object|null>} User with kyc_status or null
 */
async function getUserKycStatus(userId) {
  const query = `
    SELECT id, email, display_name, kyc_status
    FROM users
    WHERE id = $1
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
}

module.exports = {
  createSubmission,
  getSubmissionByUserId,
  updateSubmissionStatus,
  updateUserKycStatus,
  getUserKycStatus,
};

