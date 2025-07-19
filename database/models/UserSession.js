const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserSession = sequelize.define('UserSession', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    session_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    socket_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45), // IPv6 support
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    device_info: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    app_version: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    connection_type: {
      type: DataTypes.ENUM('mobile', 'web', 'desktop', 'tv'),
      allowNull: false,
      defaultValue: 'mobile',
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'expired'),
      allowNull: false,
      defaultValue: 'active',
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    last_activity: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    bytes_sent: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    bytes_received: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    disconnect_reason: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  }, {
    tableName: 'user_sessions',
    indexes: [
      {
        unique: true,
        fields: ['session_token'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['socket_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['started_at'],
      },
      {
        fields: ['last_activity'],
      },
    ],
  });

  // Instance methods
  UserSession.prototype.updateActivity = async function() {
    this.last_activity = new Date();
    this.duration_seconds = Math.floor((this.last_activity - this.started_at) / 1000);
    await this.save();
  };

  UserSession.prototype.endSession = async function(reason = 'normal') {
    this.ended_at = new Date();
    this.status = 'inactive';
    this.disconnect_reason = reason;
    this.duration_seconds = Math.floor((this.ended_at - this.started_at) / 1000);
    await this.save();
  };

  UserSession.prototype.isActive = function() {
    return this.status === 'active' && !this.ended_at;
  };

  UserSession.prototype.getDurationMinutes = function() {
    return Math.floor(this.duration_seconds / 60);
  };

  UserSession.prototype.getFormattedDuration = function() {
    const hours = Math.floor(this.duration_seconds / 3600);
    const minutes = Math.floor((this.duration_seconds % 3600) / 60);
    const seconds = this.duration_seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return UserSession;
};
