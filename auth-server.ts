import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './src/db/index.ts';
import { users, prompts } from './src/db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

const authCodes = new Map<string, { email: string; name: string; expiresAt: number }>();

async function ensureUser(email: string, name: string) {
  try {
    const [existingUser] = await db.select().from(users).where(eq(users.username, email));
    if (existingUser) {
      return {
        id: existingUser.id,
        email: existingUser.username,
        name,
        createdAt: existingUser.createdAt ? existingUser.createdAt.toISOString() : new Date().toISOString(),
      };
    }

    const [newUser] = await db.insert(users).values({
      username: email,
      password: 'oauth-user',
    }).returning();

    return {
      id: newUser.id,
      email: newUser.username,
      name,
      createdAt: newUser.createdAt ? newUser.createdAt.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error in ensureUser:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

async function getOrCreateUserIdByEmail(email: string, name: string) {
  try {
    const [existingUser] = await db.select().from(users).where(eq(users.username, email));
    if (existingUser) {
      return existingUser.id;
    }

    const [newUser] = await db.insert(users).values({
      username: email,
      password: 'oauth-user',
    }).returning();

    return newUser.id;
  } catch (error) {
    console.error('Error in getOrCreateUserIdByEmail:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

async function getUserIdByEmail(email: string) {
  try {
    const [existingUser] = await db.select().from(users).where(eq(users.username, email));
    return existingUser ? existingUser.id : null;
  } catch (error) {
    console.error('Error in getUserIdByEmail:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

async function getUserPromptsByEmail(email: string, name: string) {
  try {
    const userId = await getOrCreateUserIdByEmail(email, name || email);

    if (!userId) {
      return [];
    }

    const rows = await db.select()
      .from(prompts)
      .where(eq(prompts.userId, userId))
      .orderBy(desc(prompts.isPinned), desc(prompts.createdAt));

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      text: r.content,
      category: r.tags || 'Uncategorized',
      createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
      isPinned: !!r.isPinned,
      useCount: Number(r.useCount || 0),
      folder: r.folder || ''
    }));
  } catch (error) {
    console.error('Error in getUserPromptsByEmail:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
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
      border-radius: 12px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
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

app.get(['/auth/github/callback', '/auth/github/callback/'], async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.send(`
      <html>
        <body style="background:#0f172a;color:white;font-family:sans-serif;text-align:center;padding:50px;">
          <h2>Authentication Failed</h2>
          <p>No authorization code received from GitHub.</p>
        </body>
      </html>
    `);
  }

  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Server is missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variables.');
    }

    // 1. Swap authorization code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const tokenData: any = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(`GitHub Token Error: ${tokenData.error_description || tokenData.error}`);
    }

    const githubAccessToken = tokenData.access_token;

    // 2. Fetch user profile from GitHub
    const userProfileResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${githubAccessToken}`,
        'User-Agent': 'Prompt-Saver-OAuth'
      }
    });

    const userProfile: any = await userProfileResponse.json();

    if (!userProfile || !userProfile.login) {
      throw new Error('Failed to retrieve user profile from GitHub.');
    }

    // 3. Retrieve user email (sometimes email is null/private, so fetch from emails list)
    let email = userProfile.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${githubAccessToken}`,
          'User-Agent': 'Prompt-Saver-OAuth'
        }
      });
      if (emailsResponse.ok) {
        const emails: any[] = await emailsResponse.json();
        const primaryEmail = emails.find((e: any) => e.primary && e.verified) || emails.find((e: any) => e.primary) || emails[0];
        if (primaryEmail) {
          email = primaryEmail.email;
        }
      }
    }

    if (!email) {
      email = `${userProfile.login}@github.com`;
    }

    const name = userProfile.name || userProfile.login;
    const picture = userProfile.avatar_url || '';

    // Render HTML page to post message back to the application and close itself
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>GitHub Sign In Callback</title>
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
      border-radius: 12px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
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
    <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">GitHub Sign In</h2>
    <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.5;">Completing authentication...</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'GITHUB_OAUTH_SUCCESS',
        user: {
          email: ${JSON.stringify(email)},
          name: ${JSON.stringify(name)},
          picture: ${JSON.stringify(picture)}
        }
      }, '*');
      window.close();
    } else {
      document.querySelector('h2').textContent = 'Sign In Completed';
      document.querySelector('p').textContent = 'You can safely close this window.';
    }
  </script>
</body>
</html>
    `);

  } catch (error: any) {
    console.error('Error during GitHub OAuth callback:', error);
    res.send(`
      <html>
        <body style="background:#0f172a;color:white;font-family:sans-serif;text-align:center;padding:50px;">
          <h2 style="color:#f87171;">Authentication Error</h2>
          <p>${error.message}</p>
          <button onclick="window.close()" style="background:#4f46e5;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;margin-top:20px;">Close Window</button>
        </body>
      </html>
    `);
  }
});

app.get('/api/github-config', (req, res) => {
  res.json({
    clientId: process.env.GITHUB_CLIENT_ID || ''
  });
});

app.get('/api/firebase-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json(config);
    } else {
      res.status(404).json({ error: 'Config not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/oauth/authorize', (req, res) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required' });
  }

  const authCode = crypto.randomBytes(32).toString('hex');
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

  try {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/oauth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    const userId = await getOrCreateUserIdByEmail(decoded.email, decoded.name || decoded.email);
    const [userRow] = await db.select().from(users).where(eq(users.id, userId));

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

const verifyToken = (req: any, res: any, next: any) => {
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

app.get('/api/prompts', verifyToken, async (req: any, res) => {
  try {
    const promptsData = await getUserPromptsByEmail(req.user.email, req.user.name);
    res.json(promptsData);
  } catch (error) {
    console.error('Error loading prompts:', error);
    res.status(500).json({ error: 'Failed to load prompts' });
  }
});

app.post('/api/prompts', verifyToken, async (req: any, res) => {
  const { id, title, text, category, createdAt, isPinned, useCount, folder } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Prompt text is required' });
  }

  try {
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);

    if (!userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const numericId = Number(id);
    let hasExistingPrompt = false;
    // Check if numericId is a valid 32-bit signed integer to prevent PostgreSQL out-of-range errors
    if (!Number.isNaN(numericId) && Number.isInteger(numericId) && numericId >= -2147483648 && numericId <= 2147483647) {
      const [existingPrompt] = await db.select()
        .from(prompts)
        .where(and(eq(prompts.id, numericId), eq(prompts.userId, userId)));
      hasExistingPrompt = !!existingPrompt;
    }

    const pinVal = isPinned ? 1 : 0;
    const countVal = useCount !== undefined ? Number(useCount) : 0;
    const folderVal = folder !== undefined ? folder : null;
    const parsedDate = createdAt ? new Date(createdAt) : new Date();

    if (hasExistingPrompt) {
      await db.update(prompts)
        .set({
          title: title || '',
          content: text,
          tags: category || null,
          createdAt: parsedDate,
          isPinned: pinVal,
          useCount: countVal,
          folder: folderVal
        })
        .where(and(eq(prompts.id, numericId), eq(prompts.userId, userId)));
    } else {
      await db.insert(prompts)
        .values({
          userId,
          title: title || '',
          content: text,
          tags: category || null,
          createdAt: parsedDate,
          isPinned: pinVal,
          useCount: countVal,
          folder: folderVal
        });
    }

    const promptsData = await getUserPromptsByEmail(req.user.email, req.user.name);
    res.json(promptsData);
  } catch (error) {
    console.error('Error saving prompt:', error);
    res.status(500).json({ error: 'Failed to save prompt' });
  }
});

// Batch import/restore prompts
app.post('/api/prompts/batch', verifyToken, async (req: any, res) => {
  const parsedBackupData = req.body;

  if (!parsedBackupData || !Array.isArray(parsedBackupData)) {
    return res.status(400).json({ error: 'Backup data must be an array' });
  }

  try {
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);

    if (!userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.transaction(async (tx) => {
      // Wipe out current cloud database prompts for this user to perform full restore
      await tx.delete(prompts).where(eq(prompts.userId, userId));

      if (parsedBackupData.length > 0) {
        const valuesToInsert = parsedBackupData.map(p => {
          const title = p.title || 'Imported Prompt';
          const text = p.text || p.content || '';
          const category = p.category || 'Uncategorized';
          const pinVal = p.isPinned ? 1 : 0;
          const countVal = p.useCount !== undefined ? Number(p.useCount) : 0;
          const folderVal = p.folder || null;
          const parsedDate = p.createdAt ? new Date(p.createdAt) : new Date();

          return {
            userId,
            title,
            content: text,
            tags: category,
            createdAt: parsedDate,
            isPinned: pinVal,
            useCount: countVal,
            folder: folderVal
          };
        });

        await tx.insert(prompts).values(valuesToInsert);
      }
    });

    const promptsData = await getUserPromptsByEmail(req.user.email, req.user.name);
    res.json(promptsData);
  } catch (error) {
    console.error('Error batch importing prompts:', error);
    res.status(500).json({ error: 'Failed to batch import backup' });
  }
});

app.delete('/api/prompts/:id', verifyToken, async (req: any, res) => {
  try {
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);

    if (!userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const numericId = Number(req.params.id);
    // Check if numericId is a valid 32-bit signed integer to prevent PostgreSQL out-of-range errors
    if (!Number.isNaN(numericId) && Number.isInteger(numericId) && numericId >= -2147483648 && numericId <= 2147483647) {
      await db.delete(prompts).where(and(eq(prompts.id, numericId), eq(prompts.userId, userId)));
    }

    const promptsData = await getUserPromptsByEmail(req.user.email, req.user.name);
    res.json(promptsData);
  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/api/user/profile', verifyToken, async (req: any, res) => {
  try {
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);
    const [userRow] = await db.select().from(users).where(eq(users.id, userId));

    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: userRow.id,
      email: userRow.username,
      name: req.user.name || req.user.email,
      createdAt: userRow.createdAt ? userRow.createdAt.toISOString() : new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

(async () => {
  app.listen(PORT, () => {
    console.log(`Authorization server running on http://localhost:${PORT}`);
  });
})().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
