import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env file.
dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.SQL_DATABASE_URL;

let dbCredentials: any = {};

if (connectionString) {
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  dbCredentials = {
    url: connectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  };
} else {
  const sqlHost = process.env.SQL_HOST;
  const sqlDbName = process.env.SQL_DB_NAME;
  const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
  const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

  if (!sqlHost) {
    throw new Error("SQL_HOST or DATABASE_URL must be set in environment variables.");
  }
  if (!sqlDbName) {
    throw new Error("SQL_DB_NAME or DATABASE_URL must be set in environment variables.");
  }
  if (!user) {
    throw new Error("SQL_USER or DATABASE_URL must be set in environment variables.");
  }
  if (!password) {
    throw new Error("SQL_PASSWORD or DATABASE_URL must be set in environment variables.");
  }

  const isLocalhost = sqlHost.includes('localhost') || sqlHost.includes('127.0.0.1');
  dbCredentials = {
    host: sqlHost,
    user: user,
    password: password,
    database: sqlDbName,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  };
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle", // Output directory for migrations.
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials,
  verbose: true,
});
