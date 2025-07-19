const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

class MessageValidator {
  // Validate and sanitize message content
  static validateMessage(message) {
    const errors = [];
    
    // Check if message exists
    if (!message || typeof message !== 'string') {
      errors.push('Message must be a string');
      return { isValid: false, errors, sanitizedMessage: null };
    }

    // Trim whitespace
    const trimmedMessage = message.trim();
    
    // Check length
    if (trimmedMessage.length === 0) {
      errors.push('Message cannot be empty');
    }
    
    if (trimmedMessage.length > 5000) {
      errors.push('Message too long (maximum 5000 characters)');
    }

    // Check for prohibited content
    const prohibitedPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, // Iframe tags
      /javascript:/gi, // JavaScript protocol
      /vbscript:/gi, // VBScript protocol
      /on\w+\s*=/gi, // Event handlers
      /data:text\/html/gi, // Data URLs with HTML
      /expression\s*\(/gi, // CSS expressions
    ];

    for (const pattern of prohibitedPatterns) {
      if (pattern.test(trimmedMessage)) {
        errors.push('Message contains prohibited content');
        break;
      }
    }

    // Check for excessive special characters (potential spam)
    const specialCharCount = (trimmedMessage.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length;
    const specialCharRatio = specialCharCount / trimmedMessage.length;
    
    if (specialCharRatio > 0.5 && trimmedMessage.length > 10) {
      errors.push('Message contains too many special characters');
    }

    // Check for repeated characters (potential spam)
    const repeatedCharPattern = /(.)\1{10,}/g;
    if (repeatedCharPattern.test(trimmedMessage)) {
      errors.push('Message contains excessive repeated characters');
    }

    // Check for excessive capitalization
    const upperCaseCount = (trimmedMessage.match(/[A-Z]/g) || []).length;
    const upperCaseRatio = upperCaseCount / trimmedMessage.length;
    
    if (upperCaseRatio > 0.7 && trimmedMessage.length > 20) {
      errors.push('Message contains excessive capitalization');
    }

    // Sanitize the message
    let sanitizedMessage = trimmedMessage;
    
    // Remove or escape HTML tags
    sanitizedMessage = DOMPurify.sanitize(sanitizedMessage, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });

    // Escape special characters for database storage
    sanitizedMessage = validator.escape(sanitizedMessage);

    // Additional sanitization
    sanitizedMessage = sanitizedMessage
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedMessage: errors.length === 0 ? sanitizedMessage : null,
      originalLength: message.length,
      sanitizedLength: sanitizedMessage.length
    };
  }

  // Validate conversation subject
  static validateSubject(subject) {
    const errors = [];
    
    if (!subject || typeof subject !== 'string') {
      // Subject is optional, use default
      return {
        isValid: true,
        errors: [],
        sanitizedSubject: 'Support Request'
      };
    }

    const trimmedSubject = subject.trim();
    
    if (trimmedSubject.length > 255) {
      errors.push('Subject too long (maximum 255 characters)');
    }

    // Sanitize subject
    let sanitizedSubject = DOMPurify.sanitize(trimmedSubject, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });

    sanitizedSubject = validator.escape(sanitizedSubject);
    sanitizedSubject = sanitizedSubject.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();

    if (sanitizedSubject.length === 0) {
      sanitizedSubject = 'Support Request';
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedSubject: errors.length === 0 ? sanitizedSubject : 'Support Request'
    };
  }

  // Validate priority
  static validatePriority(priority) {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    
    if (!priority || !validPriorities.includes(priority)) {
      return {
        isValid: true,
        sanitizedPriority: 'medium'
      };
    }

    return {
      isValid: true,
      sanitizedPriority: priority
    };
  }

  // Validate username
  static validateUsername(username) {
    const errors = [];
    
    if (!username || typeof username !== 'string') {
      errors.push('Username is required');
      return { isValid: false, errors, sanitizedUsername: null };
    }

    const trimmedUsername = username.trim();
    
    if (trimmedUsername.length === 0) {
      errors.push('Username cannot be empty');
    }
    
    if (trimmedUsername.length > 100) {
      errors.push('Username too long (maximum 100 characters)');
    }

    // Check for valid username characters
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      errors.push('Username contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedUsername: errors.length === 0 ? trimmedUsername : null
    };
  }

  // Check for spam patterns
  static isSpam(message) {
    const spamPatterns = [
      /\b(buy now|click here|free money|make money fast|work from home)\b/gi,
      /\b(viagra|cialis|pharmacy|casino|poker)\b/gi,
      /\b(lottery|winner|congratulations|claim your prize)\b/gi,
      /\b(urgent|act now|limited time|expires soon)\b/gi,
      /\$\d+|\d+\$|USD|EUR|GBP/gi, // Currency mentions
      /(https?:\/\/[^\s]+){3,}/gi, // Multiple URLs
      /(.)\1{20,}/gi, // Very long repeated characters
    ];

    return spamPatterns.some(pattern => pattern.test(message));
  }

  // Rate limiting check for user
  static checkUserMessageFrequency(userId, messages, timeWindowMs = 60000, maxMessages = 10) {
    const now = Date.now();
    const recentMessages = messages.filter(msg => 
      msg.sender_id === userId && 
      msg.sender_type === 'user' &&
      (now - new Date(msg.created_at).getTime()) < timeWindowMs
    );

    return {
      isWithinLimit: recentMessages.length < maxMessages,
      currentCount: recentMessages.length,
      maxAllowed: maxMessages,
      timeWindow: timeWindowMs
    };
  }
}

module.exports = MessageValidator;
