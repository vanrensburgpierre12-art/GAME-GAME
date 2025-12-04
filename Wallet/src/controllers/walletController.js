const pool = require('../config/database');
const { getWallet, initializeWallet } = require('../models/wallet');
const { createLedgerEntry } = require('../models/walletLedger');

/**
 * Get wallet balance and reserved amount
 * GET /wallet
 */
async function getWalletHandler(req, res) {
  try {
    const userId = req.user.id;
    
    // Initialize wallet if it doesn't exist
    let wallet = await getWallet(userId);
    if (!wallet) {
      wallet = await initializeWallet(userId);
    }
    
    res.json({
      balance_cents: wallet.balance_cents,
      reserved_cents: wallet.reserved_cents,
      available_cents: wallet.balance_cents - wallet.reserved_cents,
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Create a deposit ledger entry
 * POST /wallet/deposit
 * Creates ledger entry with status=pending
 */
async function deposit(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const { amount_cents, ref } = req.body;
    
    // Validation
    if (!amount_cents || typeof amount_cents !== 'number') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'amount_cents is required and must be a number' });
    }
    
    if (amount_cents <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'amount_cents must be positive' });
    }
    
    if (!Number.isInteger(amount_cents)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'amount_cents must be an integer' });
    }
    
    // Ensure wallet exists
    await initializeWallet(userId, client);
    
    // Create ledger entry with status=pending
    const ledgerEntry = await createLedgerEntry(
      userId,
      amount_cents,
      'deposit',
      ref || null,
      'pending',
      client
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({
      tx_id: ledgerEntry.tx_id,
      amount_cents: ledgerEntry.amount_cents,
      type: ledgerEntry.type,
      status: ledgerEntry.status,
      ref: ledgerEntry.ref,
      created_at: ledgerEntry.created_at,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Deposit error:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/**
 * Create a withdraw ledger entry
 * POST /wallet/withdraw
 * Requires KYC verification (enforced by middleware)
 * Creates ledger entry with status=pending
 */
async function withdraw(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const { amount_cents, ref } = req.body;
    
    // Validation
    if (!amount_cents || typeof amount_cents !== 'number') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'amount_cents is required and must be a number' });
    }
    
    if (amount_cents <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'amount_cents must be positive' });
    }
    
    if (!Number.isInteger(amount_cents)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'amount_cents must be an integer' });
    }
    
    // Ensure wallet exists and get current balance
    await initializeWallet(userId, client);
    const wallet = await getWallet(userId);
    
    // Check available balance (balance - reserved)
    const availableBalance = wallet.balance_cents - wallet.reserved_cents;
    if (availableBalance < amount_cents) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Insufficient balance',
        available_cents: availableBalance,
        requested_cents: amount_cents,
      });
    }
    
    // Create ledger entry with status=pending
    const ledgerEntry = await createLedgerEntry(
      userId,
      amount_cents,
      'withdraw',
      ref || null,
      'pending',
      client
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({
      tx_id: ledgerEntry.tx_id,
      amount_cents: ledgerEntry.amount_cents,
      type: ledgerEntry.type,
      status: ledgerEntry.status,
      ref: ledgerEntry.ref,
      created_at: ledgerEntry.created_at,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Withdraw error:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

module.exports = {
  getWallet: getWalletHandler,
  deposit,
  withdraw,
};

