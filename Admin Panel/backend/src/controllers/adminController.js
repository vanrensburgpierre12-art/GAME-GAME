const pool = require('../config/database');
const path = require('path');
const { seedParcels } = require('../utils/seeder');

/**
 * Get all parcels (admin only)
 * GET /admin/parcels
 */
async function getParcels(req, res) {
  try {
    const { page = 1, limit = 50, owner_id, min_price, max_price } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        parcel_id,
        owner_id,
        price_cents,
        available_for_rent,
        ST_AsGeoJSON(geom)::json as geometry
      FROM parcels
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (owner_id) {
      query += ` AND owner_id = $${paramIndex}`;
      params.push(owner_id);
      paramIndex++;
    }
    
    if (min_price) {
      query += ` AND price_cents >= $${paramIndex}`;
      params.push(parseInt(min_price));
      paramIndex++;
    }
    
    if (max_price) {
      query += ` AND price_cents <= $${paramIndex}`;
      params.push(parseInt(max_price));
      paramIndex++;
    }
    
    // Get total count
    const countQuery = query.replace(
      'SELECT parcel_id, owner_id, price_cents, available_for_rent, ST_AsGeoJSON(geom)::json as geometry',
      'SELECT COUNT(*) as total'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    query += ` ORDER BY parcel_id LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      parcels: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get parcels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Trigger H3 seeder
 * POST /admin/seed
 */
async function triggerSeeder(req, res) {
  try {
    const { resolution, bbox } = req.body;
    
    const result = await seedParcels({ resolution, bbox });
    
    res.json({
      success: true,
      message: `Created ${result.parcelsCreated} parcels`,
      ...result,
    });
  } catch (error) {
    console.error('Seeder error:', error);
    res.status(500).json({ 
      error: 'Seeder failed',
      message: error.message,
    });
  }
}

/**
 * Verify KYC submission (wrapper around KYC module)
 * POST /admin/kyc/verify/:user_id
 */
async function verifyKYC(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { user_id } = req.params;
    const { status = 'verified' } = req.body;
    
    // Validate status
    if (!['verified', 'rejected'].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'status must be "verified" or "rejected"' 
      });
    }
    
    // Import KYC models
    const kycModelPath = path.join(__dirname, '../../../KYC/src/models/kyc');
    const { getSubmissionByUserId, updateSubmissionStatus, updateUserKycStatus } = require(kycModelPath);
    
    // Get user's latest submission
    const submission = await getSubmissionByUserId(user_id);
    
    if (!submission) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No KYC submission found for this user' });
    }
    
    // Update submission status
    await updateSubmissionStatus(submission.id, status, req.user.id, client);
    
    // Update user's kyc_status
    if (status === 'verified') {
      await updateUserKycStatus(user_id, 'verified', client);
    } else {
      // If rejected, reset to 'none'
      await updateUserKycStatus(user_id, 'none', client);
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      user_id,
      kyc_status: status === 'verified' ? 'verified' : 'none',
      message: `KYC ${status} successfully`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('KYC verify error:', error);
    
    if (error.message.includes('not found') || error.message.includes('No KYC')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('must be')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/**
 * Get transaction logs (combined marketplace + wallet)
 * GET /admin/logs/transactions
 */
async function getTransactionLogs(req, res) {
  try {
    const { 
      type, 
      status, 
      start_date, 
      end_date, 
      page = 1, 
      limit = 100 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build marketplace transactions query
    let marketplaceQuery = `
      SELECT 
        tx_id,
        parcel_id,
        buyer_id,
        seller_id,
        price_cents,
        fee_cents,
        seller_receives_cents,
        type,
        status,
        created_at,
        'marketplace' as source
      FROM marketplace_transactions
      WHERE 1=1
    `;
    
    // Build wallet ledger query
    let walletQuery = `
      SELECT 
        tx_id,
        NULL as parcel_id,
        user_id as buyer_id,
        NULL as seller_id,
        amount_cents as price_cents,
        0 as fee_cents,
        0 as seller_receives_cents,
        type,
        status,
        created_at,
        'wallet' as source
      FROM wallet_ledger
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (type) {
      marketplaceQuery += ` AND type = $${paramIndex}`;
      walletQuery += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (status) {
      marketplaceQuery += ` AND status = $${paramIndex}`;
      walletQuery += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (start_date) {
      marketplaceQuery += ` AND created_at >= $${paramIndex}`;
      walletQuery += ` AND created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      marketplaceQuery += ` AND created_at <= $${paramIndex}`;
      walletQuery += ` AND created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    // Combine queries with UNION
    const combinedQuery = `
      (${marketplaceQuery})
      UNION ALL
      (${walletQuery})
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(parseInt(limit), offset);
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM (
        (${marketplaceQuery.replace('SELECT tx_id,', 'SELECT tx_id,')})
        UNION ALL
        (${walletQuery.replace('SELECT tx_id,', 'SELECT tx_id,')})
      ) combined
    `;
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    // Execute combined query
    const result = await pool.query(combinedQuery, params);
    
    res.json({
      transactions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get transaction logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get all users with stats
 * GET /admin/users
 */
async function getUsers(req, res) {
  try {
    const { page = 1, limit = 50, kyc_status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.kyc_status,
        u.is_admin,
        u.created_at,
        COALESCE(w.balance_cents, 0) as balance_cents,
        COUNT(DISTINCT p.parcel_id) as parcels_owned,
        COUNT(DISTINCT mt.tx_id) as transactions_count
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      LEFT JOIN parcels p ON u.id = p.owner_id
      LEFT JOIN marketplace_transactions mt ON u.id = mt.buyer_id OR u.id = mt.seller_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (kyc_status) {
      query += ` AND u.kyc_status = $${paramIndex}`;
      params.push(kyc_status);
      paramIndex++;
    }
    
    query += ` GROUP BY u.id, u.email, u.display_name, u.kyc_status, u.is_admin, u.created_at, w.balance_cents`;
    
    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      WHERE 1=1 ${kyc_status ? `AND u.kyc_status = $1` : ''}
    `;
    const countResult = await pool.query(countQuery, kyc_status ? [kyc_status] : []);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get system statistics
 * GET /admin/stats
 */
async function getStats(req, res) {
  try {
    // Get all stats in parallel
    const [
      usersResult,
      parcelsResult,
      transactionsResult,
      walletResult,
      kycPendingResult,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users'),
      pool.query('SELECT COUNT(*) as total FROM parcels'),
      pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(price_cents) as total_volume
        FROM marketplace_transactions
        WHERE status = 'completed'
      `),
      pool.query('SELECT SUM(balance_cents) as total_balance FROM wallets'),
      pool.query(`
        SELECT COUNT(*) as total
        FROM kyc_submissions
        WHERE status = 'submitted'
      `),
    ]);
    
    const stats = {
      users: {
        total: parseInt(usersResult.rows[0].total),
      },
      parcels: {
        total: parseInt(parcelsResult.rows[0].total),
        owned: (await pool.query('SELECT COUNT(*) as total FROM parcels WHERE owner_id IS NOT NULL')).rows[0].total,
        for_sale: (await pool.query('SELECT COUNT(*) as total FROM parcels WHERE price_cents IS NOT NULL AND price_cents > 0')).rows[0].total,
      },
      transactions: {
        total: parseInt(transactionsResult.rows[0].total),
        total_volume_cents: parseInt(transactionsResult.rows[0].total_volume || 0),
      },
      wallets: {
        total_balance_cents: parseInt(walletResult.rows[0].total_balance || 0),
      },
      kyc: {
        pending: parseInt(kycPendingResult.rows[0].total),
      },
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get pending KYC submissions
 * GET /admin/kyc/pending
 */
async function getPendingKYC(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const query = `
      SELECT 
        k.id,
        k.user_id,
        k.full_name,
        k.date_of_birth,
        k.id_type,
        k.status,
        k.submitted_at,
        u.email,
        u.display_name,
        u.kyc_status
      FROM kyc_submissions k
      JOIN users u ON k.user_id = u.id
      WHERE k.status = 'submitted'
      ORDER BY k.submitted_at ASC
      LIMIT $1 OFFSET $2
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM kyc_submissions
      WHERE status = 'submitted'
    `;
    
    const [result, countResult] = await Promise.all([
      pool.query(query, [parseInt(limit), offset]),
      pool.query(countQuery),
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      submissions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get pending KYC error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getParcels,
  triggerSeeder,
  verifyKYC,
  getTransactionLogs,
  getUsers,
  getStats,
  getPendingKYC,
};

