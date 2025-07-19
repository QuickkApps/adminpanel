const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatMessage = sequelize.define('ChatMessage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    conversation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'chat_conversations',
        key: 'id',
      },
    },
    sender_type: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      // This will reference either users.id or admins.id based on sender_type
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 5000], // Message length between 1 and 5000 characters
      },
    },
    message_type: {
      type: DataTypes.ENUM('text', 'system', 'file', 'image'),
      allowNull: false,
      defaultValue: 'text',
    },
    status: {
      type: DataTypes.ENUM('sent', 'delivered', 'read'),
      allowNull: false,
      defaultValue: 'sent',
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    read_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      // References the ID of who read the message (admin or user)
    },
    edited_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_edited: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      // Can store additional data like file info, system message details, etc.
    },
    reply_to_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'chat_messages',
        key: 'id',
      },
    },
  }, {
    tableName: 'chat_messages',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['conversation_id'],
      },
      {
        fields: ['sender_type', 'sender_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['reply_to_id'],
      },
    ],
  });

  // Define associations
  ChatMessage.associate = (models) => {
    // Message belongs to a conversation
    ChatMessage.belongsTo(models.ChatConversation, {
      foreignKey: 'conversation_id',
      as: 'conversation',
    });

    // Message can be a reply to another message
    ChatMessage.belongsTo(models.ChatMessage, {
      foreignKey: 'reply_to_id',
      as: 'replyTo',
    });

    // Message can have replies
    ChatMessage.hasMany(models.ChatMessage, {
      foreignKey: 'reply_to_id',
      as: 'replies',
    });

    // Dynamic associations based on sender_type
    // These will be handled in the service layer since Sequelize doesn't support polymorphic associations directly
  };

  // Instance methods
  ChatMessage.prototype.getSender = async function() {
    const models = require('../index').models;
    if (this.sender_type === 'user') {
      return await models.User.findByPk(this.sender_id);
    } else if (this.sender_type === 'admin') {
      return await models.Admin.findByPk(this.sender_id);
    }
    return null;
  };

  ChatMessage.prototype.markAsRead = async function(readerId) {
    this.status = 'read';
    this.read_at = new Date();
    this.read_by = readerId;
    return await this.save();
  };

  return ChatMessage;
};
