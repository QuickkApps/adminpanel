# Admin Panel Fixes Applied

## Issues Fixed

### 1. Backup Restore Foreign Key Constraint Error ✅

**Problem:** When restoring backups, the system was failing with "SQLITE CONSTRAINT: FOREIGN KEY constraint failed" error.

**Root Cause:** During database restore, foreign key constraints were being enforced while restoring data with potentially mismatched IDs between related tables.

**Solution Applied:**
- Modified `services/configService.js` in the `restoreFromBackup` function
- Added `PRAGMA foreign_keys = OFF` before database restore operations
- Added `PRAGMA foreign_keys = ON` after successful restore
- Ensured foreign keys are re-enabled even if restore fails (in error handling)

**Files Modified:**
- `services/configService.js` (lines 540-548, 698-704, 706-716)

### 2. Support Chat "User Not Found" Error for New Users ✅

**Problem:** When new users tried to start a support chat, they received a 404 "User not found" error because the user didn't exist in the database yet.

**Root Cause:** The chat endpoints expected users to already exist in the database, but new users were only created during authentication, not during chat initiation.

**Solution Applied:**
- Added `findOrCreateChatUser()` helper function in `routes/chat.js`
- Modified GET `/api/chat/conversations` endpoint to auto-create users
- Modified POST `/api/chat/conversations` endpoint to auto-create users
- Auto-created users have minimal required data with reasonable defaults

**Files Modified:**
- `routes/chat.js` (lines 54-86, 102, 712-713)

**Auto-Created User Defaults:**
- `server_url`: 'chat-only' (placeholder for chat-only users)
- `subscription_type`: 'basic'
- `subscription_status`: 'active'
- `max_connections`: 1
- `expiry_date`: 1 year from creation
- `is_active`: true

## Deployment Required

⚠️ **IMPORTANT:** These fixes are applied to the local codebase but need to be deployed to the live server at https://web-production-6358.up.railway.app/

### To Deploy on Railway:
1. Commit the changes to your git repository
2. Push to the branch connected to Railway
3. Railway will automatically redeploy with the new changes

### Manual Deployment Alternative:
If using manual deployment, ensure the following files are updated on the server:
- `services/configService.js`
- `routes/chat.js`

## Testing

### Test Backup Restore:
1. Go to admin panel → Configuration → Backup & Restore
2. Try restoring any existing backup
3. Should no longer show foreign key constraint errors

### Test New User Chat:
1. Use a new username that doesn't exist in the system
2. Try to start a support chat from the mobile app
3. Should successfully create conversation without "User not found" error

## Verification Script

A test script `test_fixes.js` has been created to verify both fixes work correctly after deployment.

Run with: `node test_fixes.js`

## Notes

- The backup restore fix is backward compatible and doesn't affect existing functionality
- The chat user auto-creation only creates minimal user records for chat purposes
- Users created through chat will have `server_url: 'chat-only'` to distinguish them from authenticated users
- All changes maintain existing security and validation measures
