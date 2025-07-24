const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if table already exists
    const tableExists = await queryInterface.showAllTables().then(tables => 
      tables.includes('FallbackUrls')
    );

    if (!tableExists) {
      await queryInterface.createTable('FallbackUrls', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        url: {
          type: DataTypes.STRING(500),
          allowNull: false,
        },
        priority: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        url_type: {
          type: DataTypes.ENUM('api', 'activation', 'both'),
          allowNull: false,
          defaultValue: 'api',
        },
        description: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        last_tested: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        last_test_status: {
          type: DataTypes.ENUM('success', 'failed', 'timeout', 'unknown'),
          allowNull: false,
          defaultValue: 'unknown',
        },
        last_test_response_time: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        last_test_error: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        success_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        failure_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        created_by: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'Admins',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      // Create indexes for better performance
      await queryInterface.addIndex('FallbackUrls', ['url'], {
        unique: true,
        name: 'fallback_urls_url_unique',
      });

      await queryInterface.addIndex('FallbackUrls', ['url_type', 'is_active', 'priority'], {
        name: 'fallback_urls_type_active_priority_idx',
      });

      await queryInterface.addIndex('FallbackUrls', ['priority'], {
        name: 'fallback_urls_priority_idx',
      });

      console.log('✅ FallbackUrls table created successfully');
    } else {
      console.log('ℹ️ FallbackUrls table already exists, skipping creation');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('FallbackUrls');
    console.log('🗑️ FallbackUrls table dropped');
  },
};
