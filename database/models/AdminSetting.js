const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminSetting = sequelize.define('AdminSetting', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    setting_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
    setting_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    setting_type: {
      type: DataTypes.ENUM('boolean', 'string', 'number', 'json'),
      allowNull: false,
      defaultValue: 'string',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'admin_settings',
    indexes: [
      {
        unique: true,
        fields: ['setting_key'],
      },
    ],
  });

  // Class methods for easy setting management
  AdminSetting.getSetting = async function(key, defaultValue = null) {
    try {
      const setting = await this.findOne({
        where: { setting_key: key }
      });
      
      if (!setting) {
        return defaultValue;
      }

      // Parse value based on type
      switch (setting.setting_type) {
        case 'boolean':
          return setting.setting_value === 'true';
        case 'number':
          return parseFloat(setting.setting_value);
        case 'json':
          return JSON.parse(setting.setting_value || 'null');
        default:
          return setting.setting_value;
      }
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return defaultValue;
    }
  };

  AdminSetting.setSetting = async function(key, value, type = 'string', description = null) {
    try {
      // Convert value to string based on type
      let stringValue;
      switch (type) {
        case 'boolean':
          stringValue = value ? 'true' : 'false';
          break;
        case 'number':
          stringValue = value.toString();
          break;
        case 'json':
          stringValue = JSON.stringify(value);
          break;
        default:
          stringValue = value ? value.toString() : null;
      }

      const [setting, created] = await this.findOrCreate({
        where: { setting_key: key },
        defaults: {
          setting_key: key,
          setting_value: stringValue,
          setting_type: type,
          description: description,
        }
      });

      if (!created) {
        // Update existing setting
        setting.setting_value = stringValue;
        setting.setting_type = type;
        if (description !== null) {
          setting.description = description;
        }
        await setting.save();
      }

      return setting;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      throw error;
    }
  };

  AdminSetting.getShowOnlyCustomServers = async function() {
    return await this.getSetting('show_only_custom_servers', false);
  };

  AdminSetting.setShowOnlyCustomServers = async function(value) {
    return await this.setSetting(
      'show_only_custom_servers', 
      value, 
      'boolean',
      'When enabled, only custom VPN servers (added via admin panel) are visible to the Flutter app. When disabled, all servers are visible.'
    );
  };

  return AdminSetting;
};
