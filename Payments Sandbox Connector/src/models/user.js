const pool = require('../config/database');

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
  findUserById,
};

