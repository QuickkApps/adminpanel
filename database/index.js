const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('../utils/logger');

// Initialize SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'admin_panel.db'),
  logging: (msg) => logger.debug(msg),
  define: {
    timestamps: true,
    underscored: true,
  },
});

// Import models
const Admin = require('./models/Admin')(sequelize);
const User = require('./models/User')(sequelize);
const UserSession = require('./models/UserSession')(sequelize);
const AdminSession = require('./models/AdminSession')(sequelize);
const ChatConversation = require('./models/ChatConversation')(sequelize);
const ChatMessage = require('./models/ChatMessage')(sequelize);
const VpnServer = require('./models/VpnServer')(sequelize);

// Define associations
Admin.hasMany(AdminSession, { foreignKey: 'admin_id', as: 'sessions' });
AdminSession.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

User.hasMany(UserSession, { foreignKey: 'user_id', as: 'sessions' });
UserSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Chat model associations
const models = {
  Admin,
  User,
  UserSession,
  AdminSession,
  ChatConversation,
  ChatMessage,
  VpnServer,
};

// Initialize associations for chat models
if (ChatConversation.associate) {
  ChatConversation.associate(models);
}
if (ChatMessage.associate) {
  ChatMessage.associate(models);
}
if (VpnServer.associate) {
  VpnServer.associate(models);
}

// Database initialization
const initializeDatabase = async () => {
  try {
    // Test connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Sync models (create tables if they don't exist)
    // Use force: true in development to recreate tables
    const isDevelopment = process.env.NODE_ENV !== 'production';
    await sequelize.sync({ force: isDevelopment });
    logger.info('Database models synchronized');

    // Create default admin if it doesn't exist
    await createDefaultAdmin();
    
    return true;
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    return false;
  }
};

// Create default admin account
const createDefaultAdmin = async () => {
  try {
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existingAdmin = await Admin.findOne({
      where: { username: defaultUsername }
    });

    if (!existingAdmin) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      await Admin.create({
        username: defaultUsername,
        password: hashedPassword,
        role: 'super_admin',
        is_active: true,
        created_by: 'system'
      });

      logger.info(`Default admin account created: ${defaultUsername}`);
    }
  } catch (error) {
    logger.error('Error creating default admin:', error);
  }
};

// Export database instance and models
module.exports = {
  sequelize,
  models: {
    Admin,
    User,
    UserSession,
    AdminSession,
    ChatConversation,
    ChatMessage,
    VpnServer,
  },
  initializeDatabase,
};
