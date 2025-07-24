'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Make hostname, ip, and country_long fields nullable in vpn_servers table
    await queryInterface.changeColumn('vpn_servers', 'hostname', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.changeColumn('vpn_servers', 'ip', {
      type: Sequelize.STRING(45),
      allowNull: true,
    });

    await queryInterface.changeColumn('vpn_servers', 'country_long', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    // Add is_featured column
    await queryInterface.addColumn('vpn_servers', 'is_featured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert changes - make fields non-nullable again
    // Note: This might fail if there are null values in the database
    await queryInterface.changeColumn('vpn_servers', 'hostname', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });

    await queryInterface.changeColumn('vpn_servers', 'ip', {
      type: Sequelize.STRING(45),
      allowNull: false,
    });

    await queryInterface.changeColumn('vpn_servers', 'country_long', {
      type: Sequelize.STRING(100),
      allowNull: false,
    });

    // Remove is_featured column
    await queryInterface.removeColumn('vpn_servers', 'is_featured');
  }
};
