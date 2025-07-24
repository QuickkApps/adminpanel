const { models } = require('./database');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  try {
    console.log('🔄 Resetting admin password...');
    
    const hash = await bcrypt.hash('admin123', 10);
    const [updatedRows] = await models.Admin.update(
      { password: hash },
      { where: { username: 'admin' } }
    );
    
    if (updatedRows > 0) {
      console.log('✅ Admin password reset to "admin123"');
    } else {
      console.log('❌ No admin found with username "admin"');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  }
}

resetPassword();
