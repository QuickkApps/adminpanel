const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class ConfigService {
  constructor() {
    this.configPath = path.resolve(process.env.ANUME_CONFIG_PATH || '../anume/lib/config/remote_config.json');
    this.backupDir = path.resolve(process.env.BACKUP_DIR || './backups');
    this.ensureBackupDir();
  }

  async ensureBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create backup directory:', error);
    }
  }

  // Default configuration template
  getDefaultConfig() {
    return {
      apiUrl: 'http://nuconteaza.mmager.ro:8080',
      username: 'test',
      password: 'test',
      activationApiUrl: 'https://www.xtream.ro/appactivation',
      lastUpdated: new Date().toISOString(),
      isActive: true,
      additionalSettings: {
        timeout: 30000,
        retryAttempts: 3,
        enableLogging: true
      },
      version: '1.0.0'
    };
  }

  // Validate configuration structure
  validateConfig(config) {
    const errors = [];

    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return { isValid: false, errors };
    }

    // Required fields
    const requiredFields = ['apiUrl', 'username', 'password', 'lastUpdated'];
    for (const field of requiredFields) {
      if (!config[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate API URL format
    if (config.apiUrl && typeof config.apiUrl === 'string') {
      try {
        new URL(config.apiUrl);
      } catch (e) {
        errors.push('Invalid API URL format');
      }
    }

    // Validate username and password
    if (config.username && typeof config.username !== 'string') {
      errors.push('Username must be a string');
    }
    if (config.password && typeof config.password !== 'string') {
      errors.push('Password must be a string');
    }

    // Validate lastUpdated
    if (config.lastUpdated && isNaN(Date.parse(config.lastUpdated))) {
      errors.push('Invalid lastUpdated date format');
    }

    // Validate isActive
    if (config.isActive !== undefined && typeof config.isActive !== 'boolean') {
      errors.push('isActive must be a boolean');
    }

    // Validate additionalSettings
    if (config.additionalSettings && typeof config.additionalSettings !== 'object') {
      errors.push('additionalSettings must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Read current configuration
  async readConfig() {
    try {
      const configExists = await this.configExists();
      if (!configExists) {
        logger.info('Configuration file does not exist, returning default config');
        return this.getDefaultConfig();
      }

      const configData = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        logger.warn('Invalid configuration found, returning default config', validation.errors);
        return this.getDefaultConfig();
      }

      logger.info('Configuration read successfully');
      return config;
    } catch (error) {
      logger.error('Failed to read configuration:', error);
      return this.getDefaultConfig();
    }
  }

  // Write configuration
  async writeConfig(config) {
    try {
      // Validate configuration
      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Create backup before writing
      await this.createBackup();

      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      // Update lastUpdated timestamp
      config.lastUpdated = new Date().toISOString();

      // Write configuration
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      
      logger.info('Configuration written successfully', {
        apiUrl: config.apiUrl,
        username: config.username,
        isActive: config.isActive
      });

      return config;
    } catch (error) {
      logger.error('Failed to write configuration:', error);
      throw error;
    }
  }

  // Check if configuration file exists
  async configExists() {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  // Create backup of current configuration
  async createBackup() {
    try {
      const configExists = await this.configExists();
      if (!configExists) {
        logger.info('No configuration file to backup');
        return null;
      }

      // Generate new backup filename format: database_backup_12am-23min-34sec_07-19-25
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);

      // Convert to 12-hour format with am/pm
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const ampm = hours >= 12 ? 'pm' : 'am';

      const backupFileName = `database_backup_${hour12}${ampm}-${minutes}min-${seconds}sec_${month}-${day}-${year}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);

      const configData = await fs.readFile(this.configPath, 'utf8');
      await fs.writeFile(backupPath, configData, 'utf8');

      logger.info(`Configuration backup created: ${backupFileName}`);
      return backupFileName;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  // List available backups
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = files
        .filter(file => (file.startsWith('remote_config_backup_') || file.startsWith('database_backup_')) && file.endsWith('.json'))
        .map(file => {
          let timestamp;
          let parsedDate;

          if (file.startsWith('database_backup_')) {
            // New format: database_backup_12am-23min-34sec_07-19-25.json
            const match = file.match(/database_backup_(\d+)(am|pm)-(\d+)min-(\d+)sec_(\d+)-(\d+)-(\d+)\.json$/);
            if (match) {
              const [, hour12, ampm, minutes, seconds, month, day, year] = match;
              let hour24 = parseInt(hour12);
              if (ampm === 'pm' && hour24 !== 12) hour24 += 12;
              if (ampm === 'am' && hour24 === 12) hour24 = 0;

              const fullYear = 2000 + parseInt(year);
              parsedDate = new Date(fullYear, parseInt(month) - 1, parseInt(day), hour24, parseInt(minutes), parseInt(seconds));
              timestamp = parsedDate.toISOString();
            } else {
              parsedDate = new Date();
              timestamp = parsedDate.toISOString();
            }
          } else {
            // Old format: remote_config_backup_2025-07-18T19-31-00-922Z.json
            const oldTimestamp = file.replace('remote_config_backup_', '').replace('.json', '');
            timestamp = oldTimestamp.replace(/-/g, ':');
            parsedDate = new Date(timestamp);
          }

          return {
            filename: file,
            timestamp: timestamp,
            parsedDate: parsedDate,
            path: path.join(this.backupDir, file)
          };
        })
        .sort((a, b) => b.parsedDate - a.parsedDate); // Sort by actual date objects

      return backups;
    } catch (error) {
      logger.error('Failed to list backups:', error);
      return [];
    }
  }

  // Restore from backup
  async restoreFromBackup(backupFileName) {
    try {
      const backupPath = path.join(this.backupDir, backupFileName);
      
      // Check if backup exists
      try {
        await fs.access(backupPath);
      } catch {
        throw new Error('Backup file not found');
      }

      // Read backup
      const backupData = await fs.readFile(backupPath, 'utf8');
      const backupConfig = JSON.parse(backupData);

      // Validate backup configuration
      const validation = this.validateConfig(backupConfig);
      if (!validation.isValid) {
        throw new Error(`Invalid backup configuration: ${validation.errors.join(', ')}`);
      }

      // Create backup of current config before restoring
      await this.createBackup();

      // Restore configuration
      await this.writeConfig(backupConfig);

      logger.info(`Configuration restored from backup: ${backupFileName}`);
      return backupConfig;
    } catch (error) {
      logger.error('Failed to restore from backup:', error);
      throw error;
    }
  }

  // Get configuration status
  async getConfigStatus() {
    try {
      const configExists = await this.configExists();
      const config = await this.readConfig();
      const backups = await this.listBackups();

      return {
        exists: configExists,
        path: this.configPath,
        lastUpdated: config.lastUpdated,
        isActive: config.isActive,
        apiUrl: config.apiUrl,
        username: config.username,
        version: config.version || '1.0.0',
        backupCount: backups.length,
        latestBackup: backups.length > 0 ? backups[0].filename : null
      };
    } catch (error) {
      logger.error('Failed to get configuration status:', error);
      throw error;
    }
  }
}

module.exports = new ConfigService();
