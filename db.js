const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDatabase() {
  // เปิดหรือสร้างไฟล์ฐานข้อมูลชื่อ database.db ไว้ในโฟลเดอร์โปรเจกต์
  db = await open({
    filename: path.join(__dirname, 'database.db'),
    driver: sqlite3.Database
  });

  // สร้างตาราง users (ถ้ายังไม่มี)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // สร้างตาราง prompts (ถ้ายังไม่มี)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_pinned INTEGER DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      folder TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Migration: ลองเพิ่มคอลัมน์ใหม่ เผื่อกรณีรันตารางที่มีอยู่แล้ว (Migration support)
  try {
    await db.exec(`ALTER TABLE prompts ADD COLUMN is_pinned INTEGER DEFAULT 0`);
  } catch (err) {
    // คอลัมน์อาจจะอยู่แล้ว ข้ามเลย
  }

  try {
    await db.exec(`ALTER TABLE prompts ADD COLUMN use_count INTEGER DEFAULT 0`);
  } catch (err) {
    // คอลัมน์อาจจะอยู่แล้ว ข้ามเลย
  }

  try {
    await db.exec(`ALTER TABLE prompts ADD COLUMN folder TEXT`);
  } catch (err) {
    // คอลัมน์อาจจะอยู่แล้ว ข้ามเลย
  }

  console.log('💾 SQLite Database พร้อมใช้งานแล้ว! (ไฟล์ database.db)');
  return db;
}

// ฟังก์ชันสำหรับดึงก้อน database ไปใช้งานในไฟล์อื่น
function getDb() {
  if (!db) {
    throw new Error('Database ยังไม่ได้เปิดใช้งาน! กรุณาเรียก initDatabase() ก่อน');
  }
  return db;
}

module.exports = { initDatabase, getDb };
