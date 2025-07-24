'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add is_custom field to vpn_servers table
    await queryInterface.addColumn('vpn_servers', 'is_custom', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this server was added via admin panel (true) or is a pre-configured/default server (false)'
    });

    // Create admin_settings table for storing configuration preferences
    await queryInterface.createTable('admin_settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      setting_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Unique identifier for the setting'
      },
      setting_value: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON string or plain text value for the setting'
      },
      setting_type: {
        type: Sequelize.ENUM('boolean', 'string', 'number', 'json'),
        allowNull: false,
        defaultValue: 'string',
        comment: 'Data type of the setting value'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Human-readable description of what this setting controls'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Insert the default setting for show_only_custom_servers
    await queryInterface.bulkInsert('admin_settings', [{
      setting_key: 'show_only_custom_servers',
      setting_value: 'false',
      setting_type: 'boolean',
      description: 'When enabled, only custom VPN servers (added via admin panel) are visible to the Flutter app. When disabled, all servers are visible.',
      created_at: new Date(),
      updated_at: new Date()
    }]);

    // Add index for better performance
    await queryInterface.addIndex('vpn_servers', ['is_custom']);
    await queryInterface.addIndex('admin_settings', ['setting_key']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the is_custom column
    await queryInterface.removeColumn('vpn_servers', 'is_custom');
    
    // Drop the admin_settings table
    await queryInterface.dropTable('admin_settings');
  }
};
