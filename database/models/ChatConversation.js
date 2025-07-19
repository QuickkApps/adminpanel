const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatConversation = sequelize.define('ChatConversation', {
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
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // Can be null if no admin has been assigned yet
      references: {
        model: 'admins',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('open', 'closed', 'pending'),
      allowNull: false,
      defaultValue: 'open',
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: 'Support Request',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_message_by: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: true,
    },
    user_unread_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    admin_unread_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id',
      },
    },
  }, {
    tableName: 'chat_conversations',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['admin_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['last_message_at'],
      },
    ],
  });

  // Define associations
  ChatConversation.associate = (models) => {
    // Conversation belongs to a user
    ChatConversation.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });

    // Conversation can be assigned to an admin
    ChatConversation.belongsTo(models.Admin, {
      foreignKey: 'admin_id',
      as: 'admin',
    });

    // Conversation can be closed by an admin
    ChatConversation.belongsTo(models.Admin, {
      foreignKey: 'closed_by',
      as: 'closedByAdmin',
    });

    // Conversation has many messages
    ChatConversation.hasMany(models.ChatMessage, {
      foreignKey: 'conversation_id',
      as: 'messages',
    });
  };

  return ChatConversation;
};
