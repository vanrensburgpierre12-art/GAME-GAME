const pool = require('../config/database');
const path = require('path');
const fs = require('fs');
const {
  createSubmission,
  getSubmissionByUserId,
  updateSubmissionStatus,
  updateUserKycStatus,
  getUserKycStatus,
} = require('../models/kyc');

/**
 * Submit KYC information and documents
 * POST /kyc/submit
 */
async function submit(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const { full_name, date_of_birth, id_number, id_type } = req.body;
    const file = req.file;
    
    // Validation
    if (!full_name || !date_of_birth || !id_number || !id_type) {
      await client.query('ROLLBACK');
      // Clean up uploaded file if validation fails
      if (file) {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      }
      return res.status(400).json({ 
        error: 'All fields are required: full_name, date_of_birth, id_number, id_type' 
      });
    }
    
    if (!file) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'ID document file is required' });
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date_of_birth)) {
      await client.query('ROLLBACK');
      // Clean up uploaded file
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
      return res.status(400).json({ error: 'date_of_birth must be in format YYYY-MM-DD' });
    }
    
    // Validate id_type
    const validIdTypes = ['passport', 'drivers_license', 'national_id'];
    if (!validIdTypes.includes(id_type)) {
      await client.query('ROLLBACK');
      // Clean up uploaded file
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
      return res.status(400).json({ 
        error: `Invalid id_type. Must be one of: ${validIdTypes.join(', ')}` 
      });
    }
    
    // Create submission
    const submission = await createSubmission(
      userId,
      { full_name, date_of_birth, id_number, id_type },
      file.path,
      client
    );
    
    // Update user's kyc_status to 'submitted'
    await updateUserKycStatus(userId, 'submitted', client);
    
    await client.query('COMMIT');
    
    res.status(201).json({
      submission_id: submission.id,
      status: submission.status,
      message: 'KYC submitted successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('KYC submit error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }
    
    if (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('format')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/**
 * Get KYC status for current user
 * GET /kyc/status
 */
async function getStatus(req, res) {
  try {
    const userId = req.user.id;
    
    // Get user's kyc_status
    const user = await getUserKycStatus(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get latest submission if exists
    const submission = await getSubmissionByUserId(userId);
    
    const response = {
      kyc_status: user.kyc_status,
    };
    
    if (submission) {
      // Don't expose sensitive document path
      response.submission = {
        id: submission.id,
        full_name: submission.full_name,
        id_type: submission.id_type,
        status: submission.status,
        submitted_at: submission.submitted_at,
        verified_at: submission.verified_at,
      };
    }
    
    res.json(response);
  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Admin endpoint to verify/reject KYC submission
 * POST /kyc/admin/verify/:user_id
 */
async function adminVerify(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { user_id } = req.params;
    const { status = 'verified' } = req.body;
    const adminId = req.user.id;
    
    // Validate status
    if (!['verified', 'rejected'].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'status must be "verified" or "rejected"' 
      });
    }
    
    // Get user's latest submission
    const submission = await getSubmissionByUserId(user_id);
    
    if (!submission) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No KYC submission found for this user' });
    }
    
    // Update submission status
    await updateSubmissionStatus(submission.id, status, adminId, client);
    
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
    console.error('Admin verify error:', error);
    
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

module.exports = {
  submit,
  getStatus,
  adminVerify,
};

