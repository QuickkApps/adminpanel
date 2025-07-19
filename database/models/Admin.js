const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Admin = sequelize.define('Admin', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        isAlphanumeric: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'super_admin'),
      allowNull: false,
      defaultValue: 'admin',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    full_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    login_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  }, {
    tableName: 'admins',
    indexes: [
      {
        unique: true,
        fields: ['username'],
      },
      {
        fields: ['role'],
      },
      {
        fields: ['is_active'],
      },
    ],
    hooks: {
      beforeUpdate: (admin) => {
        if (admin.changed('password')) {
          // Password should be hashed before saving
          // This will be handled in the service layer
        }
      },
    },
  });

  // Instance methods
  Admin.prototype.toSafeJSON = function() {
    const values = { ...this.get() };
    delete values.password;
    delete values.login_attempts;
    delete values.locked_until;
    return values;
  };

  Admin.prototype.isLocked = function() {
    return this.locked_until && this.locked_until > new Date();
  };

  Admin.prototype.incrementLoginAttempts = async function() {
    this.login_attempts += 1;
    
    // Lock account after 5 failed attempts for 30 minutes
    if (this.login_attempts >= 5) {
      this.locked_until = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
    
    await this.save();
  };

  Admin.prototype.resetLoginAttempts = async function() {
    this.login_attempts = 0;
    this.locked_until = null;
    this.last_login = new Date();
    await this.save();
  };

  return Admin;
};
