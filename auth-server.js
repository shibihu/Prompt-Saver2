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
app.use(express.json());
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

async function getUserIdByEmail(email) {
  const db = getDb();
  const userRow = await db.get('SELECT id FROM users WHERE username = ?', [email]);
  return userRow?.id || null;
}

async function getUserPromptsByEmail(email) {
  const db = getDb();
  const userId = await getUserIdByEmail(email);

  if (!userId) {
    return [];
  }

  const rows = await db.all(
    `SELECT id, title, content AS text, tags AS category, created_at AS createdAt, is_pinned AS isPinned, use_count AS useCount
     FROM prompts
     WHERE user_id = ?
     ORDER BY is_pinned DESC, created_at DESC`,
    [userId]
  );

  return rows.map(r => ({
    ...r,
    isPinned: !!r.isPinned,
    useCount: Number(r.useCount || 0)
  }));
}

// Routes
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
    const userRow = await db.get('SELECT id, username FROM users WHERE username = ?', [decoded.email]);

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
    const prompts = await getUserPromptsByEmail(req.user.email);
    res.json(prompts);
  } catch (error) {
    console.error('Error loading prompts:', error);
    res.status(500).json({ error: 'Failed to load prompts' });
  }
});

app.post('/api/prompts', verifyToken, async (req, res) => {
  const { id, title, text, category, createdAt, isPinned, useCount } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Prompt text is required' });
  }

  try {
    const db = getDb();
    const userId = await getUserIdByEmail(req.user.email);

    if (!userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const numericId = Number(id);
    const hasExistingPrompt = !Number.isNaN(numericId) && await db.get('SELECT id FROM prompts WHERE id = ? AND user_id = ?', [numericId, userId]);

    const pinVal = isPinned ? 1 : 0;
    const countVal = useCount !== undefined ? Number(useCount) : 0;

    if (hasExistingPrompt) {
      await db.run(
        `UPDATE prompts
         SET title = ?, content = ?, tags = ?, created_at = ?, is_pinned = ?, use_count = ?
         WHERE id = ? AND user_id = ?`,
        [title || '', text, category || null, createdAt || new Date().toISOString(), pinVal, countVal, numericId, userId]
      );
    } else {
      await db.run(
        `INSERT INTO prompts (user_id, title, content, tags, created_at, is_pinned, use_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, title || '', text, category || null, createdAt || new Date().toISOString(), pinVal, countVal]
      );
    }

    const prompts = await getUserPromptsByEmail(req.user.email);
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
    const userId = await getUserIdByEmail(req.user.email);

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

      await db.run(
        `INSERT INTO prompts (user_id, title, content, tags, created_at, is_pinned, use_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, title, text, category, createdAt, pinVal, countVal]
      );
    }

    await db.run('COMMIT');

    const prompts = await getUserPromptsByEmail(req.user.email);
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
    const userId = await getUserIdByEmail(req.user.email);

    if (!userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const numericId = Number(req.params.id);
    if (!Number.isNaN(numericId)) {
      await db.run('DELETE FROM prompts WHERE id = ? AND user_id = ?', [numericId, userId]);
    }

    const prompts = await getUserPromptsByEmail(req.user.email);
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
    const userRow = await db.get('SELECT id, username FROM users WHERE username = ?', [req.user.email]);

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
