#!/usr/bin/env node

/**
 * Admin Account Reset Script
 * This script unlocks the admin account and resets the password to default
 */

const path = require('path');
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');

// Database configuration
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database', 'admin_panel.db'),
  logging: false
});

async function resetAdminAccount() {
  try {
    console.log('🔓 Starting admin account reset process...');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Default password (same as in database/index.js)
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Update admin account to unlock it and reset password
    const [updatedRows] = await sequelize.query(`
      UPDATE Admins
      SET login_attempts = 0,
          locked_until = NULL,
          password = ?
      WHERE username = 'admin'
    `, {
      replacements: [hashedPassword]
    });

    if (updatedRows > 0) {
      console.log('✅ Admin account reset successfully!');
      console.log('📋 Reset login attempts to 0');
      console.log('📋 Cleared lockout timer');
      console.log('📋 Reset password to default');
      console.log('');
      console.log('🎉 You can now login with:');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('⚠️  No admin account found with username "admin"');

      // Check if any admin accounts exist
      const [results] = await sequelize.query(`
        SELECT username, login_attempts, locked_until, is_active, password
        FROM Admins
        ORDER BY id
      `);

      if (results.length > 0) {
        console.log('📋 Found admin accounts:');
        results.forEach((admin, index) => {
          const isLocked = admin.locked_until && new Date(admin.locked_until) > new Date();
          const needsPasswordReset = admin.password === 'RESTORE_REQUIRED';
          console.log(`   ${index + 1}. Username: ${admin.username}`);
          console.log(`      Active: ${admin.is_active ? 'Yes' : 'No'}`);
          console.log(`      Login Attempts: ${admin.login_attempts}`);
          console.log(`      Locked: ${isLocked ? 'Yes' : 'No'}`);
          console.log(`      Password Reset Needed: ${needsPasswordReset ? 'Yes' : 'No'}`);
          if (isLocked) {
            console.log(`      Locked Until: ${admin.locked_until}`);
          }
          console.log('');
        });
      } else {
        console.log('❌ No admin accounts found in database');
      }
    }

  } catch (error) {
    console.error('❌ Error resetting admin account:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   1. Make sure the server is stopped before running this script');
    console.error('   2. Check that the database file exists');
    console.error('   3. Verify you have write permissions to the database');
  } finally {
    await sequelize.close();
  }
}

// Run the reset process
resetAdminAccount();
