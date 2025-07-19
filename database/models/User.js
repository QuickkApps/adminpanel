const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    server_url: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    subscription_type: {
      type: DataTypes.ENUM('basic', 'premium', 'trial'),
      allowNull: false,
      defaultValue: 'basic',
    },
    subscription_status: {
      type: DataTypes.ENUM('active', 'inactive', 'expired', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    max_connections: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    current_connections: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_connections: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_ip: {
      type: DataTypes.STRING(45), // IPv6 support
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    app_version: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    device_info: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    last_activity: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'users',
    indexes: [
      {
        unique: true,
        fields: ['username'],
      },
      {
        fields: ['server_url'],
      },
      {
        fields: ['subscription_status'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['is_online'],
      },
      {
        fields: ['last_activity'],
      },
    ],
  });

  // Instance methods
  User.prototype.toSafeJSON = function() {
    const values = { ...this.get() };
    // Remove sensitive information if needed
    return values;
  };

  User.prototype.isSubscriptionActive = function() {
    if (this.subscription_status !== 'active') return false;
    if (this.expiry_date && this.expiry_date < new Date()) return false;
    return true;
  };

  User.prototype.canConnect = function() {
    return this.is_active && 
           this.isSubscriptionActive() && 
           this.current_connections < this.max_connections;
  };

  User.prototype.incrementConnection = async function() {
    this.current_connections += 1;
    this.total_connections += 1;
    this.last_activity = new Date();
    await this.save();
  };

  User.prototype.decrementConnection = async function() {
    if (this.current_connections > 0) {
      this.current_connections -= 1;
      await this.save();
    }
  };

  User.prototype.updateActivity = async function(ipAddress, userAgent) {
    this.last_activity = new Date();
    this.last_login = new Date();
    if (ipAddress) this.last_ip = ipAddress;
    if (userAgent) this.user_agent = userAgent;
    await this.save();
  };

  return User;
};
