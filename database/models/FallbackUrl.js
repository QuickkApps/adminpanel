const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FallbackUrl = sequelize.define('FallbackUrl', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        isUrl: true,
        len: [1, 500],
      },
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
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
      comment: 'Response time in milliseconds',
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
        model: 'admins',
        key: 'id',
      },
    },
  }, {
    tableName: 'fallback_urls',
    indexes: [
      {
        fields: ['priority', 'is_active'],
      },
      {
        fields: ['url_type', 'is_active'],
      },
      {
        fields: ['last_test_status'],
      },
    ],
  });

  // Define associations
  FallbackUrl.associate = function(models) {
    FallbackUrl.belongsTo(models.Admin, {
      foreignKey: 'created_by',
      as: 'creator',
    });
  };

  // Class methods for easy management
  FallbackUrl.getActiveUrls = async function(urlType = 'api') {
    try {
      return await this.findAll({
        where: {
          is_active: true,
          url_type: ['both', urlType],
        },
        order: [['priority', 'ASC']],
        include: [{
          model: this.sequelize.models.Admin,
          as: 'creator',
          attributes: ['id', 'username'],
        }],
      });
    } catch (error) {
      console.error(`Error getting active URLs for type ${urlType}:`, error);
      return [];
    }
  };

  FallbackUrl.updateTestResult = async function(id, status, responseTime = null, error = null) {
    try {
      const url = await this.findByPk(id);
      if (!url) return false;

      const updateData = {
        last_tested: new Date(),
        last_test_status: status,
        last_test_response_time: responseTime,
        last_test_error: error,
      };

      if (status === 'success') {
        updateData.success_count = url.success_count + 1;
      } else {
        updateData.failure_count = url.failure_count + 1;
      }

      await url.update(updateData);
      return true;
    } catch (error) {
      console.error(`Error updating test result for URL ${id}:`, error);
      return false;
    }
  };

  FallbackUrl.reorderPriorities = async function(urlIds) {
    try {
      const transaction = await this.sequelize.transaction();
      
      try {
        for (let i = 0; i < urlIds.length; i++) {
          await this.update(
            { priority: i },
            { 
              where: { id: urlIds[i] },
              transaction 
            }
          );
        }
        
        await transaction.commit();
        return true;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error reordering priorities:', error);
      return false;
    }
  };

  return FallbackUrl;
};
