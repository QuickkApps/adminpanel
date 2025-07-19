# Live Chat Support System

This document describes the comprehensive live chat support system implemented for the Anume application.

## Overview

The chat system provides real-time communication between users and administrators, featuring:

- **Real-time messaging** using WebSocket connections
- **Message validation and sanitization** for security
- **Rate limiting** to prevent spam and abuse
- **Conversation management** with status tracking
- **Admin panel integration** for support team management
- **Flutter mobile interface** for users

## Architecture

### Backend Components

1. **Database Models**
   - `ChatConversation`: Manages conversation metadata
   - `ChatMessage`: Stores individual messages
   - Relationships with existing `User` and `Admin` models

2. **API Routes** (`/api/chat/`)
   - User endpoints for conversation and message management
   - Admin endpoints for support team operations
   - Authentication and authorization checks

3. **WebSocket Events**
   - Real-time message delivery
   - Typing indicators
   - Connection status management
   - Message read receipts

4. **Security Features**
   - Message content validation and sanitization
   - Rate limiting for messages and conversation creation
   - Spam detection and filtering
   - User access control

### Frontend Components

1. **Admin Panel Interface**
   - Conversation list with filtering and search
   - Real-time message display
   - Typing indicators and status updates
   - Conversation management tools

2. **Flutter Mobile Interface**
   - Chat screen with message bubbles
   - Real-time message updates
   - Typing indicators
   - Connection status management

## API Endpoints

### User Endpoints

- `GET /api/chat/conversations?username={username}` - Get user conversations
- `POST /api/chat/conversations` - Create new conversation
- `GET /api/chat/conversations/{id}/messages` - Get conversation messages
- `POST /api/chat/conversations/{id}/messages` - Send message
- `PATCH /api/chat/conversations/{id}/messages/read` - Mark messages as read

### Admin Endpoints

- `GET /api/chat/admin/conversations` - Get all conversations (with filters)
- `POST /api/chat/admin/conversations/{id}/messages` - Send admin message
- `PATCH /api/chat/admin/conversations/{id}/status` - Update conversation status

## WebSocket Events

### Client to Server

- `join-chat` - Join a conversation room
- `leave-chat` - Leave conversation room
- `send-chat-message` - Send message via WebSocket
- `typing-start` - Start typing indicator
- `typing-stop` - Stop typing indicator
- `mark-messages-read` - Mark messages as read

### Server to Client

- `new-chat-message` - New message received
- `new-user-message` - New message from user (admin notification)
- `user-typing` - Typing indicator update
- `messages-read` - Messages marked as read
- `chat-error` - Error notification

## Security Features

### Message Validation

- **Length limits**: 1-5000 characters
- **Content sanitization**: HTML/script tag removal
- **Spam detection**: Pattern-based filtering
- **Special character limits**: Prevents excessive symbols

### Rate Limiting

- **Messages**: 30 per minute per user
- **Conversations**: 5 per 15 minutes per user
- **Typing indicators**: 20 per 10 seconds

### Access Control

- Users can only access their own conversations
- Admins require authentication for all operations
- Message sender validation

## Database Schema

### ChatConversation Table

```sql
- id (PRIMARY KEY)
- user_id (FOREIGN KEY -> users.id)
- admin_id (FOREIGN KEY -> admins.id, nullable)
- status (ENUM: 'open', 'closed', 'pending')
- subject (VARCHAR 255)
- priority (ENUM: 'low', 'medium', 'high', 'urgent')
- last_message_at (DATETIME)
- last_message_by (ENUM: 'user', 'admin')
- user_unread_count (INTEGER)
- admin_unread_count (INTEGER)
- closed_at (DATETIME, nullable)
- closed_by (FOREIGN KEY -> admins.id, nullable)
- created_at, updated_at (TIMESTAMPS)
```

### ChatMessage Table

```sql
- id (PRIMARY KEY)
- conversation_id (FOREIGN KEY -> chat_conversations.id)
- sender_type (ENUM: 'user', 'admin')
- sender_id (INTEGER)
- message (TEXT)
- message_type (ENUM: 'text', 'system', 'file', 'image')
- status (ENUM: 'sent', 'delivered', 'read')
- read_at (DATETIME, nullable)
- read_by (INTEGER, nullable)
- edited_at (DATETIME, nullable)
- is_edited (BOOLEAN)
- metadata (JSON, nullable)
- reply_to_id (FOREIGN KEY -> chat_messages.id, nullable)
- created_at, updated_at (TIMESTAMPS)
```

## Usage Examples

### Creating a Conversation (User)

```javascript
POST /api/chat/conversations
{
  "username": "user123",
  "subject": "App Login Issue",
  "priority": "high",
  "message": "I can't log into the app with my credentials."
}
```

### Sending a Message (Admin)

```javascript
POST /api/chat/admin/conversations/1/messages
Authorization: Bearer {admin_token}
{
  "message": "Hello! I'll help you with your login issue. Can you tell me what error message you're seeing?"
}
```

### WebSocket Connection (Flutter)

```dart
// Connect to chat
socket.emit('join-chat', {
  'conversationId': conversationId,
  'userType': 'user',
  'userId': userId
});

// Send message
socket.emit('send-chat-message', {
  'conversationId': conversationId,
  'message': message,
  'senderType': 'user',
  'senderId': userId
});
```

## Testing

Run the test suite:

```bash
npm test
```

The test suite covers:
- Conversation creation and validation
- Message sending and receiving
- Rate limiting enforcement
- Security validation
- Admin operations
- WebSocket functionality

## Configuration

### Environment Variables

- `CHAT_RATE_LIMIT_ENABLED`: Enable/disable rate limiting (default: true)
- `CHAT_MAX_CONVERSATIONS_PER_USER`: Max open conversations per user (default: 5)
- `CHAT_MESSAGE_MAX_LENGTH`: Maximum message length (default: 5000)

### Rate Limit Configuration

Modify `middleware/chatRateLimit.js` to adjust:
- Message frequency limits
- Conversation creation limits
- Typing indicator limits

## Monitoring and Logging

The system logs:
- Message sending/receiving events
- Rate limit violations
- Spam detection triggers
- Connection events
- Error conditions

Logs are stored in the Winston logging system with appropriate log levels.

## Future Enhancements

Potential improvements:
- File/image sharing
- Message encryption
- Push notifications
- Chat analytics
- Auto-assignment of conversations to admins
- Canned responses for common issues
- Chat transcripts export
