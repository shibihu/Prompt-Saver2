# Prompt Saver with Integrated OAuth Login

## Features

✅ **Integrated OAuth-like Login** - No Google Client ID needed  
✅ **Per-User Prompt Storage** - Each account has separate prompts  
✅ **Account Switching** - Seamlessly switch between accounts  
✅ **Data Persistence** - Prompts persist when you switch back  
✅ **Beautiful UI** - Modern login page + Prompt Saver interface  
✅ **Server-side Storage** - All data synced to backend  

## Project Structure

```
.
├── auth-server.js              # Express server with OAuth & API endpoints
├── index.html                  # Integrated login + app UI
├── js/
│   ├── integrated-app.js      # Main app logic (NEW)
│   └── app.js                 # Legacy Google auth version
├── style.css                  # UI styles
├── public/
│   └── login.html             # Standalone login page
├── package.json               # Dependencies
├── .env                       # Environment variables
└── INTEGRATION_GUIDE.md       # This file
```

## How It Works

### Login Flow

1. **User lands on app** → Login page shown
2. **User enters name & email** → Click "Sign In"
3. **OAuth-like authentication**:
   - Request authorization code
   - Exchange code for JWT tokens
   - Store tokens in localStorage
4. **Load user prompts** → Server retrieves all prompts for that user
5. **Show app with user data**

### Account Switching

- Click "Switch Account" in the sidebar
- Shows login page again
- New login creates session for that account
- **Previous account data is preserved on server**
- Switch back to old account → prompts restore instantly

### Data Storage

- **Frontend**: localStorage stores `accessToken`, `refreshToken`, `user`
- **Backend**: In-memory storage (prompts keyed by user email)
- **Server endpoints**:
  - `POST /oauth/authorize` - Request auth code
  - `POST /oauth/token` - Exchange code for tokens
  - `GET /api/prompts` - Fetch user's prompts
  - `POST /api/prompts` - Save/Update prompt
  - `DELETE /api/prompts/:id` - Delete prompt

## Installation & Setup

### 1. Install Dependencies

```bash
cd "C:\Users\Pc\OneDrive\Desktop\Project\Prompt Saver"
npm install
```

### 2. Configure Environment

Edit `.env`:
```
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
NODE_ENV=development
```

### 3. Start the Server

```bash
npm start
```

Server runs on `http://localhost:3000`

### 4. Access the App

Open your browser to:
```
http://localhost:3000
```

You'll see the login page. Sign in to start using Prompt Saver!

## API Endpoints

### 1. Authorization Request
**POST** `/oauth/authorize`
```json
{
  "email": "user@example.com",
  "name": "John Doe"
}
```
**Response:**
```json
{
  "authCode": "hex_string_code"
}
```

### 2. Token Exchange
**POST** `/oauth/token`
```json
{
  "authCode": "hex_string_code"
}
```
**Response:**
```json
{
  "accessToken": "jwt_token",
  "refreshToken": "jwt_refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. Get Prompts (Protected)
**GET** `/api/prompts`  
**Header:** `Authorization: Bearer access_token`

**Response:**
```json
[
  {
    "id": "prompt_id",
    "title": "My Prompt",
    "text": "Prompt content...",
    "category": "Work",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 4. Save Prompt (Protected)
**POST** `/api/prompts`  
**Header:** `Authorization: Bearer access_token`
```json
{
  "id": "prompt_id",
  "title": "My Prompt",
  "text": "Prompt content...",
  "category": "Work",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### 5. Delete Prompt (Protected)
**DELETE** `/api/prompts/:id`  
**Header:** `Authorization: Bearer access_token`

## File Changes

### New Files
- `js/integrated-app.js` - Main app with auth integration
- `public/login.html` - Standalone login (optional)

### Modified Files
- `index.html` - Replaced with integrated login + app
- `auth-server.js` - Added prompt API endpoints

### Legacy Files
- `js/app.js` - Old Google auth version (kept for reference)

## Usage Example

### Sign In
1. Open http://localhost:3000
2. Enter your name and email
3. Click "Sign In"

### Create Prompt
1. Enter title (optional)
2. Choose or create category
3. Type or paste prompt
4. Click "Save Prompt"

### Switch Account
1. Click "Switch Account" button
2. Sign in with different email
3. Your new account starts with empty prompts
4. Click "Switch Account" again to return to first account
5. First account prompts are restored!

### Search & Filter
- Use search bar to find prompts by title, text, or category
- Click category pills to filter by category

## Database Integration

Currently uses **in-memory storage**. For production, integrate with:

### MongoDB
```javascript
const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema({
  userId: String,
  id: String,
  title: String,
  text: String,
  category: String,
  createdAt: Date,
});

const Prompt = mongoose.model('Prompt', promptSchema);
```

### PostgreSQL
```javascript
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'prompt_saver',
  user: 'postgres',
  password: 'password',
});

// Store prompts in users_prompts table
```

### Firebase
```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

// Store prompts in /users/{userId}/prompts collection
```

## Security Considerations

1. **HTTPS Only** - Always use HTTPS in production
2. **Strong JWT Secret** - Use a long, random string
3. **Rate Limiting** - Add rate limiting to auth endpoints
4. **CORS** - Configure CORS for your frontend domain
5. **HttpOnly Cookies** - Store tokens in httpOnly cookies instead of localStorage
6. **Input Validation** - Validate all user inputs
7. **SQL Injection** - Use parameterized queries with databases

## Troubleshooting

### "Authorization code expired"
- Auth codes expire after 10 minutes
- User needs to request a new code by signing in again

### "Invalid token"
- Access token might be expired (7 days)
- Use refresh token to get a new access token
- If refresh token also expired (30 days), sign in again

### "Cannot POST /api/prompts"
- Make sure server is running: `npm start`
- Check that auth token is being sent correctly
- Verify token hasn't expired

### Prompts not loading
- Check browser console for errors
- Verify server is running
- Check that auth token is valid
- Ensure CORS is configured

### Server won't start
- Check if port 3000 is already in use
- Try changing PORT in .env
- Check Node.js version (requires v14+)

## Next Steps

1. **Deploy to Production**
   - Use a real database (MongoDB, PostgreSQL)
   - Set strong JWT_SECRET
   - Enable HTTPS
   - Configure CORS properly

2. **Add Features**
   - Email verification
   - Password reset
   - 2FA authentication
   - Prompt sharing
   - Prompt export/import

3. **Improve Performance**
   - Add caching
   - Implement pagination
   - Add search indexing

## Support

For issues or questions, check:
- Browser console for error messages
- Server logs in terminal
- Network tab in DevTools
- This documentation

---

**Built with ❤️ for Prompt Saver**
