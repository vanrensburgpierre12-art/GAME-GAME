const pool = require('../config/database');

// Import Wallet module models (local copies)
const { createLedgerEntry, getLedgerEntryById, updateLedgerStatus } = require('../models/walletLedger');
const { initializeWallet, updateBalance } = require('../models/wallet');

/**
 * Create a deposit and generate fake payment URL
 * POST /payments/deposit
 * Creates wallet_ledger entry with status=pending and returns payment URL
 */
async function deposit(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const { amount_cents } = req.body;
    
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
      null,
      'pending',
      client
    );
    
    // Generate fake payment URL
    const paymentUrl = `https://sandbox-payment.example.com/pay/${ledgerEntry.tx_id}`;
    
    await client.query('COMMIT');
    
    res.status(201).json({
      tx_id: ledgerEntry.tx_id,
      payment_url: paymentUrl,
      amount_cents: ledgerEntry.amount_cents,
      status: ledgerEntry.status,
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
 * Handle webhook callback from sandbox payment provider
 * POST /payments/webhook
 * Updates ledger status and credits wallet balance (idempotent)
 */
async function webhook(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { tx_id, status } = req.body;
    
    // Validation
    if (!tx_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'tx_id is required' });
    }
    
    if (!status || !['completed', 'failed'].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'status is required and must be "completed" or "failed"' });
    }
    
    // Get ledger entry
    const ledgerEntry = await getLedgerEntryById(tx_id);
    
    if (!ledgerEntry) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Idempotency check: if already in the target status, return success without re-processing
    if (ledgerEntry.status === status) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        tx_id: ledgerEntry.tx_id,
        status: ledgerEntry.status,
        message: 'Transaction already in this status',
      });
    }
    
    // Only process if current status is 'pending'
    if (ledgerEntry.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Cannot update transaction from status "${ledgerEntry.status}" to "${status}"` 
      });
    }
    
    // Update ledger status
    const updatedEntry = await updateLedgerStatus(tx_id, status, client);
    
    // If status is 'completed', credit the wallet
    if (status === 'completed') {
      await updateBalance(
        ledgerEntry.user_id,
        ledgerEntry.amount_cents,
        0,
        client
      );
    }
    // If status is 'failed', only update ledger (no balance change)
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      tx_id: updatedEntry.tx_id,
      status: updatedEntry.status,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Webhook error:', error);
    
    if (error.message.includes('not found') || error.message.includes('Transaction')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('Invalid') || error.message.includes('Cannot update')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

module.exports = {
  deposit,
  webhook,
};

