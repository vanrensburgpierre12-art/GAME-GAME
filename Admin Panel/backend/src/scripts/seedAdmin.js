require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/database');

/**
 * Seed an admin user
 * Usage: node src/scripts/seedAdmin.js [email] [password] [display_name]
 */
async function seedAdmin() {
  const email = process.argv[2] || 'admin@example.com';
  const password = process.argv[3] || 'admin123';
  const displayName = process.argv[4] || 'Admin User';

  try {
    console.log('Seeding admin user...');
    console.log(`Email: ${email}`);
    console.log(`Display Name: ${displayName}`);

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id, email, is_admin FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.is_admin) {
        console.log('✓ Admin user already exists with this email');
        return;
      } else {
        // Update existing user to admin
        await pool.query(
          'UPDATE users SET is_admin = true WHERE email = $1',
          [email]
        );
        console.log('✓ Updated existing user to admin');
        return;
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, kyc_status, is_admin)
       VALUES ($1, $2, $3, 'verified', true)
       RETURNING id, email, display_name, is_admin`,
      [email, passwordHash, displayName]
    );

    const user = result.rows[0];
    console.log('✓ Admin user created successfully!');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Display Name: ${user.display_name}`);
    console.log(`  Admin: ${user.is_admin}`);
    console.log('\nYou can now log in with these credentials.');

  } catch (error) {
    console.error('Error seeding admin user:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the seeder
seedAdmin();

