'use strict';

const crypto = require('crypto');
const { query } = require('../config/database');
const { sanitizeUrl } = require('../utils/validate');

/**
 * Model short_links — rút gọn đường dẫn.
 * Slug: 6 ký tự, bảng chữ cái dễ đọc (không có 0/o, 1/l/i).
 */

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomSlug(len = 6) {
    let out = '';
    for (let i = 0; i < len; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
    return out;
}

function parseShort(row) {
    if (!row) return null;
    return {
        id: row.id,
        slug: row.slug,
        originalUrl: row.original_url,
        title: row.title,
        clicks: row.clicks,
        createdAt: row.created_at
    };
}

async function createShort(userId, { url, title }) {
    const cleanUrl = sanitizeUrl(url);
    if (!cleanUrl) return { error: 'Địa chỉ URL không hợp lệ.' };

    for (let attempt = 0; attempt < 5; attempt++) {
        const slug = randomSlug();
        try {
            const { rows } = await query(
                `INSERT INTO short_links (user_id, slug, original_url, title)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, slug, cleanUrl, String(title || '').trim().slice(0, 60)]
            );
            return { short: parseShort(rows[0]) };
        } catch (err) {
            if (err.code === '23505') continue; // slug trùng — thử slug khác
            throw err;
        }
    }
    return { error: 'Không tạo được đường dẫn rút gọn. Vui lòng thử lại.' };
}

async function listShorts(userId) {
    const { rows } = await query(
        `SELECT * FROM short_links WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
    );
    return rows.map(parseShort);
}

async function getShort(userId, id) {
    const { rows } = await query(
        `SELECT * FROM short_links WHERE id = $1 AND user_id = $2`,
        [id, userId]
    );
    return rows[0] || null;
}

async function getBySlug(slug) {
    if (!slug || !/^[a-z0-9]{4,16}$/.test(slug)) return null;
    const { rows } = await query(`SELECT * FROM short_links WHERE slug = $1`, [slug]);
    return rows[0] || null;
}

async function updateShort(userId, id, body) {
    const existing = await getShort(userId, id);
    if (!existing) return { error: 'Không tìm thấy đường dẫn.' };

    const next = {
        original_url: existing.original_url,
        title: existing.title
    };
    if (body.url !== undefined) {
        const cleanUrl = sanitizeUrl(body.url);
        if (!cleanUrl) return { error: 'Địa chỉ URL không hợp lệ.' };
        next.original_url = cleanUrl;
    }
    if (body.title !== undefined) {
        next.title = String(body.title).trim().slice(0, 60);
    }

    const { rows } = await query(
        `UPDATE short_links SET original_url = $1, title = $2, updated_at = now()
         WHERE id = $3 AND user_id = $4 RETURNING *`,
        [next.original_url, next.title, id, userId]
    );
    return { short: parseShort(rows[0]) };
}

async function deleteShort(userId, id) {
    const { rowCount } = await query(
        `DELETE FROM short_links WHERE id = $1 AND user_id = $2`,
        [id, userId]
    );
    return rowCount > 0;
}

async function incrementClick(shortId) {
    await query(`UPDATE short_links SET clicks = clicks + 1 WHERE id = $1`, [shortId]);
}

module.exports = {
    createShort,
    listShorts,
    getShort,
    getBySlug,
    updateShort,
    deleteShort,
    incrementClick,
    parseShort
};
