# OAuth-Like Login System with JWT

A secure authentication system that mimics OAuth flow using JWT tokens. **No Google Client ID required** - this is a custom authorization implementation.

## Features

✅ OAuth-like authorization flow  
✅ JWT token generation & validation  
✅ Refresh token support  
✅ Protected API routes  
✅ Session management with localStorage  
✅ Beautiful Google-style UI  

## Project Structure

```
.
├── auth-server.js          # Main Express server with OAuth endpoints
├── public/
│   └── login.html         # Beautiful login page UI
├── package.json           # Dependencies
├── .env                   # Environment variables
└── README.md             # This file
```

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   Or with auto-reload:
   ```bash
   npm run dev
   ```

3. **Access the login page:**
   ```
   http://localhost:3000/login
   ```

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

### 3. Refresh Token
**POST** `/oauth/refresh`
```json
{
  "refreshToken": "jwt_refresh_token"
}
```
**Response:**
```json
{
  "accessToken": "new_jwt_token"
}
```

### 4. Get User Profile (Protected)
**GET** `/api/user/profile`  
**Header:** `Authorization: Bearer access_token`

**Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### 5. Logout (Protected)
**POST** `/api/logout`  
**Header:** `Authorization: Bearer access_token`

## How It Works

### Authentication Flow

1. **User submits login form** with email and name
2. **Request authorization** → Server generates temporary auth code
3. **Exchange code for tokens** → Server validates code and returns JWT tokens
4. **Store tokens** → Frontend stores accessToken & refreshToken in localStorage
5. **Access protected routes** → Frontend sends accessToken in Authorization header

### Token Details

- **Access Token**: Valid for 7 days, used for API requests
- **Refresh Token**: Valid for 30 days, used to get new access token
- **Auth Code**: Valid for 10 minutes, used for token exchange

## Environment Variables

Edit `.env`:
```
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

⚠️ **Important**: Change `JWT_SECRET` before deploying to production!

## Example Usage (JavaScript/Fetch)

```javascript
// 1. Sign in
const response = await fetch('/oauth/authorize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email: 'user@example.com',
    name: 'John Doe'
  })
});

const { authCode } = await response.json();

// 2. Exchange code for token
const tokenRes = await fetch('/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ authCode })
});

const { accessToken, refreshToken } = await tokenRes.json();
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// 3. Make authenticated request
const profileRes = await fetch('/api/user/profile', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

const user = await profileRes.json();
```

## Security Considerations

1. **HTTPS only** - Always use HTTPS in production
2. **Secure JWT_SECRET** - Use a strong, random secret key
3. **HttpOnly Cookies** - Consider storing tokens in httpOnly cookies instead of localStorage
4. **CORS** - Configure CORS properly for your frontend domain
5. **Rate Limiting** - Add rate limiting to prevent brute force attacks
6. **Token Validation** - Always validate tokens server-side

## Database Integration

Currently uses in-memory storage. For production, integrate with:
- MongoDB
- PostgreSQL
- MySQL
- Firebase

## Extending the System

### Add Password Authentication
```javascript
// Add bcrypt for password hashing
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(password, 10);
```

### Add Email Verification
```javascript
// Send verification email on signup
const verificationToken = jwt.sign({...}, SECRET, {expiresIn: '24h'});
```

### Add 2FA
```javascript
// Use libraries like speakeasy or totp for 2FA
```

## Troubleshooting

**"Authorization code expired"**
- Authorization codes expire after 10 minutes
- User needs to request a new code

**"Invalid token"**
- Token might be expired (7 days for access token)
- Use refresh token to get a new access token

**CORS errors**
- Add your frontend domain to CORS configuration
- Update the `cors()` middleware in auth-server.js

## License

MIT

---

**Created with ❤️ for Prompt Saver**
