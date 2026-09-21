'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, withTransaction } = require('../config/database');

/**
 * Model users + sessions.
 * Password chỉ lưu dạng bcrypt hash.
 */

const SESSION_TTL_DAYS = 30;

function parseUser(row) {
    if (!row) return null;
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        createdAt: row.created_at
    };
}

async function findByUsername(username) {
    const { rows } = await query(
        'SELECT * FROM users WHERE username = $1',
        [String(username || '').trim().toLowerCase()]
    );
    return rows[0] || null;
}

async function findByEmail(email) {
    const { rows } = await query(
        'SELECT * FROM users WHERE email = $1',
        [String(email || '').trim().toLowerCase()]
    );
    return rows[0] || null;
}

async function findById(id) {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
}

async function usernameExists(username) {
    return !!(await findByUsername(username));
}

async function emailExists(email) {
    return !!(await findByEmail(email));
}

/**
 * Tạo user mới + profile mặc định trong 1 transaction.
 * legal: { accepted: bool, version: '1.0' } — bắt buộc true (đã validate ở controller).
 * @returns user object công khai (không có hash)
 */
async function createUser({ username, email, password, legal }) {
    const hash = await bcrypt.hash(password, 12);
    const version = String((legal && legal.version) || '1.0');
    return withTransaction(async (client) => {
        const { rows } = await client.query(
            `INSERT INTO users (username, email, password_hash,
                                terms_accepted, privacy_accepted, legal_accepted_at, legal_version)
             VALUES ($1, $2, $3, TRUE, TRUE, now(), $4)
             RETURNING id, username, email, created_at`,
            [username.toLowerCase(), email.toLowerCase(), hash, version]
        );
        const user = rows[0];
        await client.query(
            `INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)`,
            [user.id, user.username]
        );
        return user;
    });
}

async function verifyPassword(userRow, password) {
    if (!userRow) return false;
    return bcrypt.compare(String(password || ''), userRow.password_hash);
}

async function updatePassword(userId, newPassword) {
    const hash = await bcrypt.hash(newPassword, 12);
    await query(
        `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
        [hash, userId]
    );
}

async function updateEmail(userId, email) {
    await query(
        `UPDATE users SET email = $1, updated_at = now() WHERE id = $2`,
        [String(email).toLowerCase(), userId]
    );
}

async function updateUsername(userId, username) {
    await query(
        `UPDATE users SET username = $1, updated_at = now() WHERE id = $2`,
        [String(username).toLowerCase(), userId]
    );
}

/** Xoá user và toàn bộ dữ liệu liên quan (cascade). */
async function deleteUser(userId) {
    await query('DELETE FROM users WHERE id = $1', [userId]);
}

/* ------------------------- Sessions ------------------------- */

function sessionId() {
    return crypto.randomBytes(32).toString('hex');
}

async function createSession(userId) {
    const id = sessionId();
    const { rows } = await query(
        `INSERT INTO sessions (id, user_id, expires_at)
         VALUES ($1, $2, now() + interval '${SESSION_TTL_DAYS} days')
         RETURNING id, expires_at`,
        [id, userId]
    );
    return rows[0];
}

/** Trả về { session, user } nếu session còn hạn, ngược lại xoá session hỏng. */
async function findSession(id) {
    if (!id || typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) return null;
    const { rows } = await query(
        `SELECT s.id, s.expires_at, u.id AS user_id, u.username, u.email, u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1`,
        [id]
    );
    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expires_at) < new Date()) {
        await destroySession(id);
        return null;
    }
    return {
        session: { id: row.id, userId: row.user_id },
        user: parseUser({
            id: row.user_id,
            username: row.username,
            email: row.email,
            created_at: row.created_at
        })
    };
}

async function destroySession(id) {
    await query('DELETE FROM sessions WHERE id = $1', [id]);
}

/** Đăng xuất mọi thiết bị: xoá toàn bộ session của user. */
async function destroyAllSessions(userId) {
    await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

/** Thông tin legal đã đồng ý khi đăng ký. */
async function getLegalInfo(userId) {
    const { rows } = await query(
        `SELECT terms_accepted, privacy_accepted, legal_accepted_at, legal_version
         FROM users WHERE id = $1`,
        [userId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
        termsAccepted: row.terms_accepted,
        privacyAccepted: row.privacy_accepted,
        acceptedAt: row.legal_accepted_at,
        version: row.legal_version
    };
}

/** Dọn session hết hạn — gọi định kỳ. */
async function purgeExpiredSessions() {
    await query('DELETE FROM sessions WHERE expires_at < now()');
}

module.exports = {
    parseUser,
    findByUsername,
    findByEmail,
    findById,
    usernameExists,
    emailExists,
    createUser,
    verifyPassword,
    updatePassword,
    updateEmail,
    updateUsername,
    deleteUser,
    createSession,
    findSession,
    destroySession,
    destroyAllSessions,
    getLegalInfo,
    purgeExpiredSessions
};
