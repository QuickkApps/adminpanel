const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get log files list
router.get('/', authMiddleware, async (req, res) => {
  try {
    const logsDir = path.resolve('./logs');
    
    try {
      const files = await fs.readdir(logsDir);
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          const filePath = path.join(logsDir, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            size: stats.size,
            modified: stats.mtime,
            path: filePath
          };
        })
      );

      // Sort by modification time (newest first)
      fileStats.sort((a, b) => new Date(b.modified) - new Date(a.modified));

      res.json({
        files: fileStats,
        message: 'Log files retrieved successfully'
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          files: [],
          message: 'No log directory found'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('Failed to get log files:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve log files'
    });
  }
});

// Get log file content
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { lines = 100, offset = 0 } = req.query;
    
    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        error: 'Invalid filename',
        message: 'Filename contains invalid characters'
      });
    }

    if (!filename.endsWith('.log')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only .log files are allowed'
      });
    }

    const logsDir = path.resolve('./logs');
    const filePath = path.join(logsDir, filename);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      
      // Apply pagination
      const startIndex = Math.max(0, parseInt(offset) || 0);
      const maxLines = Math.min(1000, parseInt(lines) || 100); // Limit to 1000 lines max
      const endIndex = Math.min(allLines.length, startIndex + maxLines);
      
      const selectedLines = allLines.slice(startIndex, endIndex);
      
      // Parse JSON log entries if possible
      const parsedLines = selectedLines.map((line, index) => {
        try {
          const parsed = JSON.parse(line);
          return {
            index: startIndex + index,
            timestamp: parsed.timestamp,
            level: parsed.level,
            message: parsed.message,
            service: parsed.service,
            raw: line,
            parsed: true
          };
        } catch {
          return {
            index: startIndex + index,
            raw: line,
            parsed: false
          };
        }
      });

      res.json({
        filename,
        totalLines: allLines.length,
        returnedLines: selectedLines.length,
        offset: startIndex,
        lines: parsedLines,
        message: 'Log content retrieved successfully'
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({
          error: 'File not found',
          message: 'The requested log file does not exist'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('Failed to read log file:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to read log file'
    });
  }
});

// Search in log files
router.post('/search', async (req, res) => {
  try {
    const { query, filename, caseSensitive = false, maxResults = 100 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Search query is required'
      });
    }

    const logsDir = path.resolve('./logs');
    let filesToSearch = [];

    if (filename) {
      // Search in specific file
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || !filename.endsWith('.log')) {
        return res.status(400).json({
          error: 'Invalid filename',
          message: 'Invalid filename provided'
        });
      }
      filesToSearch = [filename];
    } else {
      // Search in all log files
      try {
        const files = await fs.readdir(logsDir);
        filesToSearch = files.filter(file => file.endsWith('.log'));
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.json({
            results: [],
            message: 'No log directory found'
          });
        }
        throw error;
      }
    }

    const searchResults = [];
    const searchRegex = new RegExp(query, caseSensitive ? 'g' : 'gi');

    for (const file of filesToSearch) {
      try {
        const filePath = path.join(logsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (searchRegex.test(line) && searchResults.length < maxResults) {
            searchResults.push({
              filename: file,
              lineNumber: index + 1,
              content: line.trim(),
              matches: line.match(searchRegex) || []
            });
          }
        });

        if (searchResults.length >= maxResults) {
          break;
        }
      } catch (error) {
        logger.warn(`Failed to search in file ${file}:`, error);
        continue;
      }
    }

    res.json({
      query,
      caseSensitive,
      totalResults: searchResults.length,
      maxResults,
      results: searchResults,
      message: 'Search completed successfully'
    });
  } catch (error) {
    logger.error('Failed to search logs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to search logs'
    });
  }
});

// Clear log files (with confirmation)
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        error: 'Invalid filename',
        message: 'Filename contains invalid characters'
      });
    }

    if (!filename.endsWith('.log')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only .log files can be cleared'
      });
    }

    const logsDir = path.resolve('./logs');
    const filePath = path.join(logsDir, filename);
    
    try {
      // Clear the file content instead of deleting it
      await fs.writeFile(filePath, '');
      
      logger.info(`Log file cleared by user: ${req.user.username} - ${filename}`);

      res.json({
        filename,
        message: 'Log file cleared successfully'
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({
          error: 'File not found',
          message: 'The requested log file does not exist'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('Failed to clear log file:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to clear log file'
    });
  }
});

module.exports = router;
