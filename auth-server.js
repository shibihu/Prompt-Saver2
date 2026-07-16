const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const { initDatabase, getDb } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

const authCodes = new Map();

async function ensureUser(email, name) {
  const db = getDb();
  await db.run(
    `INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`,
    [email, 'oauth-user']
  );

  const userRow = await db.get('SELECT id, username FROM users WHERE username = ?', [email]);

  return {
    id: userRow.id,
    email: userRow.username,
    name,
    createdAt: new Date().toISOString(),
  };
}

async function getOrCreateUserIdByEmail(email, name) {
  const db = getDb();
  let userRow = await db.get('SELECT id FROM users WHERE username = ?', [email]);
  if (!userRow) {
    await db.run(
      `INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`,
      [email, 'oauth-user']
    );
    userRow = await db.get('SELECT id FROM users WHERE username = ?', [email]);
  }
  return userRow?.id || null;
}

async function getUserIdByEmail(email) {
  const db = getDb();
  const userRow = await db.get('SELECT id FROM users WHERE username = ?', [email]);
  return userRow?.id || null;
}

async function getUserPromptsByEmail(email, name) {
  const db = getDb();
  const userId = await getOrCreateUserIdByEmail(email, name || email);

  if (!userId) {
    return [];
  }

  const rows = await db.all(
    `SELECT id, title, content AS text, tags AS category, created_at AS createdAt, is_pinned AS isPinned, use_count AS useCount, folder
     FROM prompts
     WHERE user_id = ?
     ORDER BY is_pinned DESC, created_at DESC`,
    [userId]
  );

  return rows.map(r => ({
    ...r,
    isPinned: !!r.isPinned,
    useCount: Number(r.useCount || 0),
    folder: r.folder || ''
  }));
}

// Routes
app.get(['/auth/google/callback', '/auth/google/callback/'], (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Google Sign In Callback</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      max-width: 320px;
      width: 100%;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-top-color: #5b8cff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">Google Sign In</h2>
    <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.5;">Securing your workspace...</p>
  </div>
  <script>
    // Extract access token from URL hash fragment
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    
    if (accessToken) {
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'Authorization': 'Bearer ' + accessToken
        }
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch user profile from Google');
        return res.json();
      })
      .then(user => {
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_OAUTH_SUCCESS',
            user: {
              email: user.email,
              name: user.name,
              picture: user.picture
            },
            googleAccessToken: accessToken
          }, '*');
          window.close();
        } else {
          document.querySelector('h2').textContent = 'Sign In Completed';
          document.querySelector('p').textContent = 'You can safely close this window.';
        }
      })
      .catch(err => {
        document.querySelector('h2').textContent = 'Authentication Error';
        document.querySelector('p').textContent = err.message;
        document.querySelector('.spinner').style.display = 'none';
      });
    } else {
      document.querySelector('h2').textContent = 'Authentication Failed';
      document.querySelector('p').textContent = 'Could not find access token.';
      document.querySelector('.spinner').style.display = 'none';
    }
  </script>
</body>
</html>
  `);
});

app.get('/api/firebase-config', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json(config);
    } else {
      res.status(404).json({ error: 'Config not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/oauth/authorize', (req, res) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required' });
  }

  const authCode = require('crypto').randomBytes(32).toString('hex');
  authCodes.set(authCode, {
    email,
    name,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  res.json({ authCode });
});

app.post('/oauth/token', async (req, res) => {
  const { authCode } = req.body;

  if (!authCode) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  const authData = authCodes.get(authCode);

  if (!authData) {
    return res.status(400).json({ error: 'Invalid authorization code' });
  }

  if (authData.expiresAt < Date.now()) {
    authCodes.delete(authCode);
    return res.status(400).json({ error: 'Authorization code expired' });
  }

  const user = await ensureUser(authData.email, authData.name);
  authCodes.delete(authCode);

  const token = jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    accessToken: token,
    refreshToken,
    user,
  });
});

app.post('/oauth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const db = getDb();
    const userId = await getOrCreateUserIdByEmail(decoded.email, decoded.name || decoded.email);
    const userRow = await db.get('SELECT id, username FROM users WHERE id = ?', [userId]);

    if (!userRow) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = {
      id: userRow.id,
      email: userRow.username,
      name: decoded.name || decoded.email,
    };

    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.post('/api/logout', verifyToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/prompts', verifyToken, async (req, res) => {
  try {
    const prompts = await getUserPromptsByEmail(req.user.email, req.user.name);
    res.json(prompts);
  } catch (error) {
    console.error('Error loading prompts:', error);
    res.status(500).json({ error: 'Failed to load prompts' });
  }
});

app.post('/api/prompts', verifyToken, async (req, res) => {
  const { id, title, text, category, createdAt, isPinned, useCount, folder } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Prompt text is required' });
  }

  try {
    const db = getDb();
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);

    if (!userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const numericId = Number(id);
    const hasExistingPrompt = !Number.isNaN(numericId) && await db.get('SELECT id FROM prompts WHERE id = ? AND user_id = ?', [numericId, userId]);

    const pinVal = isPinned ? 1 : 0;
    const countVal = useCount !== undefined ? Number(useCount) : 0;
    const folderVal = folder !== undefined ? folder : null;

    if (hasExistingPrompt) {
      await db.run(
        `UPDATE prompts
         SET title = ?, content = ?, tags = ?, created_at = ?, is_pinned = ?, use_count = ?, folder = ?
         WHERE id = ? AND user_id = ?`,
        [title || '', text, category || null, createdAt || new Date().toISOString(), pinVal, countVal, folderVal, numericId, userId]
      );
    } else {
      await db.run(
        `INSERT INTO prompts (user_id, title, content, tags, created_at, is_pinned, use_count, folder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, title || '', text, category || null, createdAt || new Date().toISOString(), pinVal, countVal, folderVal]
      );
    }

    const prompts = await getUserPromptsByEmail(req.user.email, req.user.name);
    res.json(prompts);
  } catch (error) {
    console.error('Error saving prompt:', error);
    res.status(500).json({ error: 'Failed to save prompt' });
  }
});

// 12. Batch import/restore prompts
app.post('/api/prompts/batch', verifyToken, async (req, res) => {
  const parsedBackupData = req.body;

  if (!parsedBackupData || !Array.isArray(parsedBackupData)) {
    return res.status(400).json({ error: 'Backup data must be an array' });
  }

  try {
    const db = getDb();
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);

    if (!userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Begin single transaction for extreme speed and safety
    await db.run('BEGIN TRANSACTION');

    // Wipe out current cloud database prompts for this user to perform full restore
    await db.run('DELETE FROM prompts WHERE user_id = ?', [userId]);

    for (const p of parsedBackupData) {
      const title = p.title || 'Imported Prompt';
      const text = p.text || p.content || '';
      const category = p.category || 'Uncategorized';
      const createdAt = p.createdAt || new Date().toISOString();
      const pinVal = p.isPinned ? 1 : 0;
      const countVal = p.useCount !== undefined ? Number(p.useCount) : 0;
      const folderVal = p.folder || null;

      await db.run(
        `INSERT INTO prompts (user_id, title, content, tags, created_at, is_pinned, use_count, folder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, title, text, category, createdAt, pinVal, countVal, folderVal]
      );
    }

    await db.run('COMMIT');

    const prompts = await getUserPromptsByEmail(req.user.email, req.user.name);
    res.json(prompts);
  } catch (error) {
    try {
      const db = getDb();
      await db.run('ROLLBACK');
    } catch (e) {}
    console.error('Error batch importing prompts:', error);
    res.status(500).json({ error: 'Failed to batch import backup' });
  }
});

app.delete('/api/prompts/:id', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);

    if (!userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const numericId = Number(req.params.id);
    if (!Number.isNaN(numericId)) {
      await db.run('DELETE FROM prompts WHERE id = ? AND user_id = ?', [numericId, userId]);
    }

    const prompts = await getUserPromptsByEmail(req.user.email, req.user.name);
    res.json(prompts);
  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);
    const userRow = await db.get('SELECT id, username FROM users WHERE id = ?', [userId]);

    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: userRow.id,
      email: userRow.username,
      name: req.user.name || req.user.email,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

(async () => {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Authorization server running on http://localhost:${PORT}`);
  });
})().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
