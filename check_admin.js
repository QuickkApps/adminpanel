#!/usr/bin/env node

/**
 * Admin Account Check Script
 * This script checks the current state of admin accounts
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

async function checkAdminAccount() {
  try {
    console.log('🔍 Checking admin account details...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Get detailed admin account info
    const [results] = await sequelize.query(`
      SELECT id, username, password, role, is_active, login_attempts, locked_until, created_at, updated_at
      FROM Admins 
      ORDER BY id
    `);
    
    if (results.length > 0) {
      console.log('📋 Admin accounts found:');
      for (const admin of results) {
        const isLocked = admin.locked_until && new Date(admin.locked_until) > new Date();
        console.log(`\n   ID: ${admin.id}`);
        console.log(`   Username: "${admin.username}"`);
        console.log(`   Password Hash: ${admin.password.substring(0, 20)}...`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Active: ${admin.is_active ? 'Yes' : 'No'}`);
        console.log(`   Login Attempts: ${admin.login_attempts}`);
        console.log(`   Locked: ${isLocked ? 'Yes' : 'No'}`);
        if (isLocked) {
          console.log(`   Locked Until: ${admin.locked_until}`);
        }
        console.log(`   Created: ${admin.created_at}`);
        console.log(`   Updated: ${admin.updated_at}`);
        
        // Test password comparison
        const testPasswords = ['admin', 'admin123', 'RESTORE_REQUIRED'];
        for (const testPass of testPasswords) {
          try {
            const isMatch = await bcrypt.compare(testPass, admin.password);
            if (isMatch) {
              console.log(`   ✅ Password matches: "${testPass}"`);
            }
          } catch (error) {
            // Password might not be hashed
            if (admin.password === testPass) {
              console.log(`   ✅ Password matches (unhashed): "${testPass}"`);
            }
          }
        }
      }
    } else {
      console.log('❌ No admin accounts found in database');
    }
    
    // Check table structure
    console.log('\n📊 Table structure:');
    const [tableInfo] = await sequelize.query(`PRAGMA table_info(Admins)`);
    tableInfo.forEach(column => {
      console.log(`   ${column.name}: ${column.type} (${column.notnull ? 'NOT NULL' : 'NULL'})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking admin account:', error.message);
  } finally {
    await sequelize.close();
  }
}

// Run the check
checkAdminAccount();
