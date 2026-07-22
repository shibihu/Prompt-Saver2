var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// auth-server.ts
import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  prompts: () => prompts,
  promptsRelations: () => promptsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  // email
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var prompts = pgTable("prompts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags"),
  // category
  createdAt: timestamp("created_at").defaultNow(),
  isPinned: integer("is_pinned").default(0),
  useCount: integer("use_count").default(0),
  folder: text("folder")
});
var usersRelations = relations(users, ({ many }) => ({
  prompts: many(prompts)
}));
var promptsRelations = relations(prompts, ({ one }) => ({
  user: one(users, {
    fields: [prompts.userId],
    references: [users.id]
  })
}));

// src/db/index.ts
var { Pool } = pg;
var createPool = () => {
  const connectionString = process.env.DATABASE_URL || process.env.SQL_DATABASE_URL;
  if (connectionString) {
    const isLocalhost2 = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
    const isRenderInternal2 = /dpg-[a-z0-9]+-a([:@/]|$)/i.test(connectionString) && !connectionString.includes(".render.com");
    if (isRenderInternal2 && !process.env.RENDER) {
      console.warn(
        `
\u26A0\uFE0F  DATABASE CONNECTION WARNING \u26A0\uFE0F
It looks like you are using a Render.com INTERNAL Database URL (host ending in "-a") outside of Render's private network.
To connect from AI Studio, Vercel, or local development, you MUST use Render's EXTERNAL Database URL (which ends with ".render.com").
Please update your DATABASE_URL environment variable to use the External Database URL.
`
      );
    }
    return new Pool({
      connectionString,
      ssl: isLocalhost2 ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 15e3
    });
  }
  const host = process.env.SQL_HOST;
  const isLocalhost = !host || host === "localhost" || host === "127.0.0.1";
  const isRenderInternal = host && /dpg-[a-z0-9]+-a$/i.test(host) && !host.includes(".render.com");
  if (isRenderInternal && !process.env.RENDER) {
    console.warn(
      `
\u26A0\uFE0F  DATABASE CONNECTION WARNING \u26A0\uFE0F
It looks like you are using a Render.com INTERNAL database host (SQL_HOST ending in "-a") outside of Render's private network.
To connect from AI Studio, Vercel, or local development, you MUST use Render's EXTERNAL database host (which ends with ".render.com").
Please update your SQL_HOST/DATABASE_URL environment variable to use the External host.
`
    );
  }
  return new Pool({
    host,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15e3
  });
};
var pool = createPool();
pool.on("error", (err) => {
  console.error("Unexpected error on idle SQL pool client:", err);
});
var db = drizzle(pool, { schema: schema_exports });
async function initializeDatabase() {
  console.log("Initializing database schema if not present...");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY,
        "username" text NOT NULL UNIQUE,
        "password" text NOT NULL,
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log('Table "users" ensured.');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "prompts" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" text NOT NULL,
        "content" text NOT NULL,
        "tags" text,
        "created_at" timestamp DEFAULT now(),
        "is_pinned" integer DEFAULT 0,
        "use_count" integer DEFAULT 0,
        "folder" text
      );
    `);
    console.log('Table "prompts" ensured.');
  } catch (error) {
    console.error("Error during database schema initialization:", error);
  }
}

// auth-server.ts
import { eq, and, desc } from "drizzle-orm";
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3e3;
var JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("public"));
var authCodes = /* @__PURE__ */ new Map();
function formatDatabaseError(error) {
  const message = error?.message || "";
  const causeMessage = error?.cause?.message || "";
  const fullErrorStr = `${message} ${causeMessage}`.toLowerCase();
  const connectionString = process.env.DATABASE_URL || process.env.SQL_DATABASE_URL || "";
  const host = process.env.SQL_HOST || "";
  const isInternalUrl = /dpg-[a-z0-9]+-a([:@/]|$)/i.test(connectionString) && !connectionString.includes(".render.com");
  const isInternalHost = host && /dpg-[a-z0-9]+-a$/i.test(host) && !host.includes(".render.com");
  if (isInternalUrl || isInternalHost || fullErrorStr.includes("eai_again") || fullErrorStr.includes("enotfound") || fullErrorStr.includes("getaddrinfo")) {
    if (isInternalUrl || isInternalHost || fullErrorStr.includes("dpg-") && !fullErrorStr.includes(".render.com")) {
      return new Error(
        `Database connection failed: You are using a Render.com INTERNAL Database URL or Host (ending in "-a"). 1. If you are previewing in AI Studio: The AI Studio preview runs outside of Render's private network, so you MUST use Render's EXTERNAL Database URL (ends with ".render.com") in your AI Studio secrets settings. 2. If you are deployed on Render: Render's internal network only allows connections between services in the EXACT same region. If your database and app are in different regions, or if you want it to work everywhere, please update your environment variable to the EXTERNAL Database URL.`
      );
    }
    return new Error(
      "Database connection failed: Hostname could not be resolved. Please verify that your DATABASE_URL or SQL_HOST is correct, active, and accessible from external networks."
    );
  }
  if (fullErrorStr.includes("econnrefused")) {
    return new Error(
      "Database connection failed: Connection was refused by the database server. Please check if your database is active, and that external connections are allowed (e.g. check firewall/IP allowlists)."
    );
  }
  if (fullErrorStr.includes("password authentication failed") || fullErrorStr.includes("authentication failed")) {
    return new Error(
      "Database authentication failed: Please double-check your database username, password, and database name in your environment variables."
    );
  }
  if (fullErrorStr.includes("ssl") || fullErrorStr.includes("tlsv1")) {
    return new Error(
      "Database connection failed: SSL/TLS handshaking error. Try enabling or disabling SSL in your connection configuration."
    );
  }
  return new Error(`Database query failed: ${error.message || "Please check your database configuration."}`);
}
async function ensureUser(email, name) {
  try {
    const [existingUser] = await db.select().from(users).where(eq(users.username, email));
    if (existingUser) {
      return {
        id: existingUser.id,
        email: existingUser.username,
        name,
        createdAt: existingUser.createdAt ? existingUser.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const [newUser] = await db.insert(users).values({
      username: email,
      password: "oauth-user"
    }).returning();
    return {
      id: newUser.id,
      email: newUser.username,
      name,
      createdAt: newUser.createdAt ? newUser.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Error in ensureUser:", error);
    throw formatDatabaseError(error);
  }
}
async function getOrCreateUserIdByEmail(email, name) {
  try {
    const [existingUser] = await db.select().from(users).where(eq(users.username, email));
    if (existingUser) {
      return existingUser.id;
    }
    const [newUser] = await db.insert(users).values({
      username: email,
      password: "oauth-user"
    }).returning();
    return newUser.id;
  } catch (error) {
    console.error("Error in getOrCreateUserIdByEmail:", error);
    throw formatDatabaseError(error);
  }
}
async function getUserPromptsByEmail(email, name) {
  try {
    const userId = await getOrCreateUserIdByEmail(email, name || email);
    if (!userId) {
      return [];
    }
    const rows = await db.select().from(prompts).where(eq(prompts.userId, userId)).orderBy(desc(prompts.isPinned), desc(prompts.createdAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      text: r.content,
      category: r.tags || "Uncategorized",
      createdAt: r.createdAt ? r.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      isPinned: !!r.isPinned,
      useCount: Number(r.useCount || 0),
      folder: r.folder || ""
    }));
  } catch (error) {
    console.error("Error in getUserPromptsByEmail:", error);
    throw formatDatabaseError(error);
  }
}
app.get(["/auth/google/callback", "/auth/google/callback/"], (req, res) => {
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
app.get(["/auth/github/callback", "/auth/github/callback/"], async (req, res) => {
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
      throw new Error("Server is missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variables.");
    }
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });
    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      throw new Error(`GitHub Token Error: ${tokenData.error_description || tokenData.error}`);
    }
    const githubAccessToken = tokenData.access_token;
    const userProfileResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${githubAccessToken}`,
        "User-Agent": "Prompt-Saver-OAuth"
      }
    });
    const userProfile = await userProfileResponse.json();
    if (!userProfile || !userProfile.login) {
      throw new Error("Failed to retrieve user profile from GitHub.");
    }
    let email = userProfile.email;
    if (!email) {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          "Authorization": `Bearer ${githubAccessToken}`,
          "User-Agent": "Prompt-Saver-OAuth"
        }
      });
      if (emailsResponse.ok) {
        const emails = await emailsResponse.json();
        const primaryEmail = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.primary) || emails[0];
        if (primaryEmail) {
          email = primaryEmail.email;
        }
      }
    }
    if (!email) {
      email = `${userProfile.login}@github.com`;
    }
    const name = userProfile.name || userProfile.login;
    const picture = userProfile.avatar_url || "";
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
  } catch (error) {
    console.error("Error during GitHub OAuth callback:", error);
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
app.get("/api/github-config", (req, res) => {
  res.json({
    clientId: process.env.GITHUB_CLIENT_ID || ""
  });
});
app.get("/api/firebase-config", (req, res) => {
  try {
    const configPath = path.join(__dirname, "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      res.json(config);
    } else {
      res.status(404).json({ error: "Config not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/oauth/authorize", (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: "Email and name are required" });
  }
  const authCode = crypto.randomBytes(32).toString("hex");
  authCodes.set(authCode, {
    email,
    name,
    expiresAt: Date.now() + 10 * 60 * 1e3
  });
  res.json({ authCode });
});
app.post("/oauth/token", async (req, res) => {
  const { authCode } = req.body;
  if (!authCode) {
    return res.status(400).json({ error: "Authorization code is required" });
  }
  const authData = authCodes.get(authCode);
  if (!authData) {
    return res.status(400).json({ error: "Invalid authorization code" });
  }
  if (authData.expiresAt < Date.now()) {
    authCodes.delete(authCode);
    return res.status(400).json({ error: "Authorization code expired" });
  }
  try {
    const user = await ensureUser(authData.email, authData.name);
    authCodes.delete(authCode);
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({
      accessToken: token,
      refreshToken,
      user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/oauth/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is required" });
  }
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const userId = await getOrCreateUserIdByEmail(decoded.email, decoded.name || decoded.email);
    const [userRow] = await db.select().from(users).where(eq(users.id, userId));
    if (!userRow) {
      return res.status(401).json({ error: "User not found" });
    }
    const user = {
      id: userRow.id,
      email: userRow.username,
      name: decoded.name || decoded.email
    };
    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});
var verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};
app.post("/api/logout", verifyToken, (req, res) => {
  res.json({ message: "Logged out successfully" });
});
app.get("/api/prompts", verifyToken, async (req, res) => {
  try {
    const promptsData = await getUserPromptsByEmail(req.user.email, req.user.name);
    res.json(promptsData);
  } catch (error) {
    console.error("Error loading prompts:", error);
    res.status(500).json({ error: "Failed to load prompts" });
  }
});
app.post("/api/prompts", verifyToken, async (req, res) => {
  const { id, title, text: text2, category, createdAt, isPinned, useCount, folder } = req.body;
  if (!text2) {
    return res.status(400).json({ error: "Prompt text is required" });
  }
  try {
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);
    if (!userId) {
      return res.status(404).json({ error: "User not found" });
    }
    const numericId = Number(id);
    let hasExistingPrompt = false;
    if (!Number.isNaN(numericId) && Number.isInteger(numericId) && numericId >= -2147483648 && numericId <= 2147483647) {
      const [existingPrompt] = await db.select().from(prompts).where(and(eq(prompts.id, numericId), eq(prompts.userId, userId)));
      hasExistingPrompt = !!existingPrompt;
    }
    const pinVal = isPinned ? 1 : 0;
    const countVal = useCount !== void 0 ? Number(useCount) : 0;
    const folderVal = folder !== void 0 ? folder : null;
    const parsedDate = createdAt ? new Date(createdAt) : /* @__PURE__ */ new Date();
    if (hasExistingPrompt) {
      await db.update(prompts).set({
        title: title || "",
        content: text2,
        tags: category || null,
        createdAt: parsedDate,
        isPinned: pinVal,
        useCount: countVal,
        folder: folderVal
      }).where(and(eq(prompts.id, numericId), eq(prompts.userId, userId)));
    } else {
      await db.insert(prompts).values({
        userId,
        title: title || "",
        content: text2,
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
    console.error("Error saving prompt:", error);
    res.status(500).json({ error: "Failed to save prompt" });
  }
});
app.post("/api/prompts/batch", verifyToken, async (req, res) => {
  const parsedBackupData = req.body;
  if (!parsedBackupData || !Array.isArray(parsedBackupData)) {
    return res.status(400).json({ error: "Backup data must be an array" });
  }
  try {
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);
    if (!userId) {
      return res.status(404).json({ error: "User not found" });
    }
    await db.transaction(async (tx) => {
      await tx.delete(prompts).where(eq(prompts.userId, userId));
      if (parsedBackupData.length > 0) {
        const valuesToInsert = parsedBackupData.map((p) => {
          const title = p.title || "Imported Prompt";
          const text2 = p.text || p.content || "";
          const category = p.category || "Uncategorized";
          const pinVal = p.isPinned ? 1 : 0;
          const countVal = p.useCount !== void 0 ? Number(p.useCount) : 0;
          const folderVal = p.folder || null;
          const parsedDate = p.createdAt ? new Date(p.createdAt) : /* @__PURE__ */ new Date();
          return {
            userId,
            title,
            content: text2,
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
    console.error("Error batch importing prompts:", error);
    res.status(500).json({ error: "Failed to batch import backup" });
  }
});
app.delete("/api/prompts/:id", verifyToken, async (req, res) => {
  try {
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);
    if (!userId) {
      return res.status(404).json({ error: "User not found" });
    }
    const numericId = Number(req.params.id);
    if (!Number.isNaN(numericId) && Number.isInteger(numericId) && numericId >= -2147483648 && numericId <= 2147483647) {
      await db.delete(prompts).where(and(eq(prompts.id, numericId), eq(prompts.userId, userId)));
    }
    const promptsData = await getUserPromptsByEmail(req.user.email, req.user.name);
    res.json(promptsData);
  } catch (error) {
    console.error("Error deleting prompt:", error);
    res.status(500).json({ error: "Failed to delete prompt" });
  }
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/api/user/profile", verifyToken, async (req, res) => {
  try {
    const userId = await getOrCreateUserIdByEmail(req.user.email, req.user.name || req.user.email);
    const [userRow] = await db.select().from(users).where(eq(users.id, userId));
    if (!userRow) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      id: userRow.id,
      email: userRow.username,
      name: req.user.name || req.user.email,
      createdAt: userRow.createdAt ? userRow.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Error loading profile:", error);
    res.status(500).json({ error: "Failed to load profile" });
  }
});
(async () => {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Authorization server running on http://localhost:${PORT}`);
  });
})().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
