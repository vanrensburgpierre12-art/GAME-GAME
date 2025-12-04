const pool = require('../config/database');

/**
 * Create a new user
 * @param {string} email - User email
 * @param {string} passwordHash - Hashed password
 * @param {string} displayName - User display name
 * @returns {Promise<object>} User object with minimal profile
 */
async function createUser(email, passwordHash, displayName) {
  const query = `
    INSERT INTO users (email, password_hash, display_name, kyc_status)
    VALUES ($1, $2, $3, 'none')
    RETURNING id, email, display_name, kyc_status
  `;
  
  const result = await pool.query(query, [email, passwordHash, displayName]);
  return result.rows[0];
}

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<object|null>} User object with all fields or null
 */
async function findUserByEmail(email) {
  const query = `
    SELECT id, email, password_hash, display_name, created_at, kyc_status, COALESCE(is_admin, false) as is_admin
    FROM users
    WHERE email = $1
  `;
  
  const result = await pool.query(query, [email]);
  return result.rows[0] || null;
}

/**
 * Find user by ID
 * @param {string} id - User ID (UUID)
 * @returns {Promise<object|null>} User object with minimal profile or null
 */
async function findUserById(id) {
  const query = `
    SELECT id, email, display_name, kyc_status, COALESCE(is_admin, false) as is_admin
    FROM users
    WHERE id = $1
  `;
  
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
};

