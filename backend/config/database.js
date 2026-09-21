'use strict';

/**
 * Kết nối PostgreSQL — lớp DUY NHẤT được phép chạm vào database.
 * Thông tin kết nối chỉ đọc từ .env, không bao giờ trả về client.
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000
});

pool.on('error', (err) => {
    console.error('[database] Lỗi pool PostgreSQL:', err.message);
});

/**
 * Chạy 1 truy vấn với parameterized values (chống SQL injection).
 * @returns {Promise<{rows: Array, rowCount: number}>}
 */
async function query(text, params) {
    return pool.query(text, params);
}

/**
 * Chạy nhiều câu trong 1 transaction.
 * @param {(client) => Promise<any>} fn
 */
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/** Kiểm tra kết nối khi khởi động. Dừng server nếu database chưa sẵn sàng. */
async function ensureConnection() {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
        console.log('[database] Đã kết nối PostgreSQL.');
    } finally {
        client.release();
    }
}

module.exports = { pool, query, withTransaction, ensureConnection };
