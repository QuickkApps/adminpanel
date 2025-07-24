const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VpnServer = sequelize.define('VpnServer', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
      },
    },
    hostname: {
      type: DataTypes.STRING(255),
      allowNull: true, // Made optional since many OpenVPN configs don't require hostname
      validate: {
        len: [1, 255],
      },
    },
    ip: {
      type: DataTypes.STRING(45), // IPv4 or IPv6
      allowNull: true, // Made optional since many OpenVPN configs don't require IP
      validate: {
        isIP: true,
      },
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1194,
      validate: {
        min: 1,
        max: 65535,
      },
    },
    protocol: {
      type: DataTypes.ENUM('udp', 'tcp'),
      allowNull: false,
      defaultValue: 'udp',
    },
    country_long: {
      type: DataTypes.STRING(100),
      allowNull: true, // Made optional since country code is sufficient
      validate: {
        len: [1, 100],
      },
    },
    country_short: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        len: [2, 10],
      },
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    openvpn_config_base64: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    speed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    ping: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '0',
    },
    num_vpn_sessions: {
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
    is_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true, // New servers are featured by default
      comment: 'Whether this server should be featured/starred in the app',
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Admins',
        key: 'id',
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    max_connections: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      validate: {
        min: 1,
      },
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    server_load: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
      validate: {
        min: 0.0,
        max: 100.0,
      },
    },
  }, {
    tableName: 'vpn_servers',
    indexes: [
      {
        fields: ['is_active'],
      },
      {
        fields: ['country_short'],
      },
      {
        fields: ['created_by'],
      },
    ],
  });

  // Define associations
  VpnServer.associate = (models) => {
    VpnServer.belongsTo(models.Admin, {
      foreignKey: 'created_by',
      as: 'creator',
    });
  };

  // Instance methods
  VpnServer.prototype.toFlutterFormat = function() {
    return {
      HostName: this.hostname,
      IP: this.ip,
      Ping: this.ping,
      Speed: this.speed,
      CountryLong: this.country_long,
      CountryShort: this.country_short,
      NumVpnSessions: this.num_vpn_sessions,
      OpenVPN_ConfigData_Base64: this.openvpn_config_base64,
      // Authentication credentials
      Username: this.username,
      Password: this.password,
      // Additional custom server metadata
      _isCustomServer: true,
      _serverId: this.id,
      _serverName: this.name,
      _port: this.port,
      _protocol: this.protocol,
      _maxConnections: this.max_connections,
      _serverLoad: this.server_load,
      _location: this.location,
      _isFeatured: this.is_featured,
      _createdAt: this.created_at,
    };
  };

  // Class methods
  VpnServer.getActiveServers = async function() {
    return await this.findAll({
      where: {
        is_active: true,
      },
      order: [
        ['is_featured', 'DESC'], // Featured servers first
        ['server_load', 'ASC'],  // Then by server load
        ['created_at', 'DESC'],  // Then by creation date (newest first)
      ],
    });
  };

  VpnServer.getServersByCountry = async function(countryShort) {
    return await this.findAll({
      where: {
        country_short: countryShort,
        is_active: true,
      },
      order: [['server_load', 'ASC']],
    });
  };

  return VpnServer;
};
