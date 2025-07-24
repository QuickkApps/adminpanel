const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AppContent = sequelize.define('AppContent', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    content_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        len: [1, 100],
        notEmpty: true,
        isIn: [['about_anume', 'privacy_policy']], // Only allow these content types
      },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [1, 255],
        notEmpty: true,
      },
    },
    content: {
      type: DataTypes.TEXT('long'), // Support large content
      allowNull: false,
      validate: {
        len: [1, 50000], // Max 50k characters
        notEmpty: true,
      },
    },
    content_type: {
      type: DataTypes.ENUM('plain_text', 'html', 'markdown'),
      allowNull: false,
      defaultValue: 'plain_text',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    last_updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id',
      },
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      // Can store additional data like formatting options, etc.
    },
  }, {
    tableName: 'app_contents',
    indexes: [
      {
        unique: true,
        fields: ['content_key'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['last_updated_by'],
      },
    ],
    hooks: {
      beforeUpdate: (content, options) => {
        // Increment version on update
        content.version += 1;
      },
    },
  });

  // Class methods for easy content management
  AppContent.getContent = async function(key) {
    try {
      const content = await this.findOne({
        where: { 
          content_key: key,
          is_active: true 
        },
        include: [{
          model: sequelize.models.Admin,
          as: 'updatedBy',
          attributes: ['id', 'username'],
          required: false,
        }],
      });
      
      return content;
    } catch (error) {
      console.error(`Error getting content ${key}:`, error);
      return null;
    }
  };

  AppContent.getAllActiveContent = async function() {
    try {
      const contents = await this.findAll({
        where: { is_active: true },
        include: [{
          model: sequelize.models.Admin,
          as: 'updatedBy',
          attributes: ['id', 'username'],
          required: false,
        }],
        order: [['content_key', 'ASC']],
      });
      
      return contents;
    } catch (error) {
      console.error('Error getting all content:', error);
      return [];
    }
  };

  AppContent.updateContent = async function(key, title, content, contentType = 'plain_text', adminId = null, metadata = null) {
    try {
      const [contentRecord, created] = await this.findOrCreate({
        where: { content_key: key },
        defaults: {
          content_key: key,
          title: title,
          content: content,
          content_type: contentType,
          last_updated_by: adminId,
          metadata: metadata,
          version: 1,
        }
      });

      if (!created) {
        // Update existing content
        contentRecord.title = title;
        contentRecord.content = content;
        contentRecord.content_type = contentType;
        contentRecord.last_updated_by = adminId;
        if (metadata !== null) {
          contentRecord.metadata = metadata;
        }
        await contentRecord.save();
      }

      return contentRecord;
    } catch (error) {
      console.error(`Error updating content ${key}:`, error);
      throw error;
    }
  };

  // Note: Associations are defined in database/index.js to avoid conflicts

  return AppContent;
};
