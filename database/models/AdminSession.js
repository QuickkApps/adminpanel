const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminSession = sequelize.define('AdminSession', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'admins',
        key: 'id',
      },
    },
    session_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    jwt_token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45), // IPv6 support
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    browser_info: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'revoked'),
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
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    actions_performed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_action: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  }, {
    tableName: 'admin_sessions',
    indexes: [
      {
        unique: true,
        fields: ['session_token'],
      },
      {
        fields: ['admin_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['started_at'],
      },
      {
        fields: ['expires_at'],
      },
      {
        fields: ['last_activity'],
      },
    ],
  });

  // Instance methods
  AdminSession.prototype.updateActivity = async function(action = null) {
    this.last_activity = new Date();
    this.actions_performed += 1;
    if (action) {
      this.last_action = action;
    }
    await this.save();
  };

  AdminSession.prototype.isActive = function() {
    return this.status === 'active' && 
           this.expires_at > new Date() && 
           !this.ended_at;
  };

  AdminSession.prototype.isExpired = function() {
    return this.expires_at <= new Date();
  };

  AdminSession.prototype.revoke = async function() {
    this.status = 'revoked';
    this.ended_at = new Date();
    await this.save();
  };

  AdminSession.prototype.expire = async function() {
    this.status = 'expired';
    this.ended_at = new Date();
    await this.save();
  };

  AdminSession.prototype.getDurationMinutes = function() {
    const endTime = this.ended_at || new Date();
    return Math.floor((endTime - this.started_at) / (1000 * 60));
  };

  AdminSession.prototype.getFormattedDuration = function() {
    const endTime = this.ended_at || new Date();
    const durationMs = endTime - this.started_at;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  return AdminSession;
};
