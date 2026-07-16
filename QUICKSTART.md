# 🚀 Quick Start Guide - Prompt Saver with Account Integration

## What's New

Your Prompt Saver now has **integrated OAuth-like login** with **per-account data storage**! 

### Key Features:
✅ Login with email & name (no Google Client ID needed)  
✅ Each account has its own prompts  
✅ Switch between accounts seamlessly  
✅ Your data persists when you switch back  
✅ All data synced to secure backend server  

---

## Getting Started

### 1. Server is Already Running ✓
```bash
http://localhost:3000
```

### 2. Open the App
Go to your browser and open:
```
http://localhost:3000
```

You'll see a beautiful login page.

### 3. Sign In
- **Enter your name** (e.g., "John Doe")
- **Enter your email** (e.g., "john@example.com")
- **Click "Sign In"**

That's it! You're logged in and can start saving prompts.

---

## Using the App

### Save a Prompt
1. Type a **title** (optional)
2. Choose a **category** (optional)
3. **Paste or write your prompt**
4. Click **"Save Prompt"**

Your prompt is instantly saved to your account!

### Search & Filter
- Use the search bar to find prompts by title, text, or category
- Click category pills in the sidebar to filter
- See real-time stats (Total, Visible, Groups)

### Edit & Delete
- **Edit**: Click the "Edit" button on any prompt
- **Delete**: Click "Delete" (you'll get a confirmation)
- **Copy**: Click "Copy" to copy prompt to clipboard

### Switch Accounts
1. Click **"Switch Account"** in the sidebar
2. Sign in with a **different email**
3. Your new account starts with **empty prompts**
4. **Click "Switch Account" again** to return to your first account
5. **Your first account's prompts are restored!** ✨

---

## File Structure

```
Prompt Saver/
├── index.html                # New integrated login + app
├── auth-server.js            # Backend API server
├── js/
│   └── integrated-app.js    # New app with auth integration
├── style.css                # Styling
├── .env                     # Configuration (JWT secret, port)
├── package.json             # Dependencies
└── INTEGRATION_GUIDE.md     # Full technical documentation
```

---

## API Endpoints (For Developers)

### Login Flow
```
POST /oauth/authorize          Request auth code
POST /oauth/token              Exchange code for JWT tokens
```

### Prompt Management
```
GET    /api/prompts            Get all prompts for current user
POST   /api/prompts            Save/update a prompt
DELETE /api/prompts/:id        Delete a prompt
```

### User Profile
```
GET    /api/user/profile       Get current user info
POST   /api/logout             Sign out
POST   /oauth/refresh          Refresh access token
```

---

## How Your Data is Stored

- **Frontend**: Tokens stored in browser's localStorage
- **Backend**: Each user's prompts stored server-side
- **Persistence**: Prompts remain even after you close the browser
- **Account Switching**: Switching accounts doesn't lose data

```
User A (john@example.com)
├── Prompt 1: "API Design Best Practices"
├── Prompt 2: "Python Async Tips"
└── Prompt 3: "React Hooks Guide"

User B (jane@example.com)
├── Prompt 1: "SQL Query Optimization"
└── Prompt 2: "Docker Troubleshooting"
```

---

## Common Tasks

### Organize Prompts by Category
1. Create different categories (Work, Learning, etc.)
2. Save prompts to specific categories
3. Click category pills to filter

### Find a Prompt Quickly
- Use the search bar at the top
- Type part of the title or content
- Results update in real-time

### Export Prompts (Coming Soon)
- We can add export to JSON/CSV feature
- Would preserve all your prompts

### Share Prompts (Coming Soon)
- Generate share links for individual prompts
- Others can view without signing in

---

## Troubleshooting

### "Server not responding"
- Check if server is running: `npm start`
- Port 3000 should be accessible

### "Can't sign in"
- Make sure you enter both name and email
- Try a different email address

### "Prompts disappeared"
- Switch to the correct account
- Check if you're on the right browser/device

### "Sign Out not working"
- Try clicking "Switch Account" instead
- Close the browser and reopen

---

## Next Steps

### For Users
1. ✅ Sign in and create some prompts
2. ✅ Try switching to a different account
3. ✅ Switch back and verify your prompts return
4. 📱 Use it as your personal prompt library!

### For Developers
1. 📦 Upgrade to a real database (MongoDB, PostgreSQL, Firebase)
2. 🔐 Add email verification
3. 🔑 Implement password reset
4. 📤 Add prompt import/export
5. 🤝 Add prompt sharing features

---

## Need Help?

Check these files for more info:
- `INTEGRATION_GUIDE.md` - Full technical details
- `AUTH_README.md` - OAuth & JWT documentation
- Browser Console - For error messages (F12)
- Network Tab - To see API calls

---

**Ready to go! Start saving your prompts now! 🎉**

Open http://localhost:3000 in your browser to begin.
