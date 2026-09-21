'use strict';

const { query } = require('../config/database');
const { sanitizeUrl } = require('../utils/validate');

/**
 * Model links — liên kết trên trang công khai.
 * Mọi truy vấn đều lọc theo user_id: user chỉ đụng được dữ liệu của mình.
 */

const ICONS = new Set([
    'link', 'globe', 'github', 'instagram', 'youtube', 'tiktok', 'x',
    'facebook', 'twitch', 'spotify', 'soundcloud', 'mail', 'music', 'camera',
    'store', 'book', 'calendar', 'coffee', 'sparkle', 'pin'
]);
const TITLE_MAX = 60;

function parseLink(row) {
    if (!row) return null;
    return {
        id: row.id,
        title: row.title,
        url: row.url,
        icon: row.icon,
        position: row.position,
        enabled: row.enabled,
        clicks: row.clicks
    };
}

async function listLinks(userId) {
    const { rows } = await query(
        `SELECT * FROM links WHERE user_id = $1 ORDER BY position ASC, id ASC`,
        [userId]
    );
    return rows.map(parseLink);
}

async function getLink(userId, linkId) {
    const { rows } = await query(
        `SELECT * FROM links WHERE id = $1 AND user_id = $2`,
        [linkId, userId]
    );
    return rows[0] || null;
}

async function nextPosition(userId) {
    const { rows } = await query(
        `SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM links WHERE user_id = $1`,
        [userId]
    );
    return rows[0].pos || 0;
}

async function createLink(userId, { title, url, icon, enabled }) {
    const cleanUrl = sanitizeUrl(url);
    if (!cleanUrl) return { error: 'Địa chỉ URL không hợp lệ.' };
    const t = String(title || '').trim().slice(0, TITLE_MAX);
    if (!t) return { error: 'Vui lòng đặt tiêu đề cho liên kết.' };

    const position = await nextPosition(userId);
    const { rows } = await query(
        `INSERT INTO links (user_id, title, url, icon, position, enabled)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, t, cleanUrl, ICONS.has(icon) ? icon : 'link', position, enabled !== false]
    );
    return { link: parseLink(rows[0]) };
}

async function updateLink(userId, linkId, body) {
    const existing = await getLink(userId, linkId);
    if (!existing) return { error: 'Không tìm thấy liên kết.' };

    const next = {
        title: existing.title,
        url: existing.url,
        icon: existing.icon,
        enabled: existing.enabled
    };
    if (body.title !== undefined) {
        const t = String(body.title).trim().slice(0, TITLE_MAX);
        if (!t) return { error: 'Vui lòng đặt tiêu đề cho liên kết.' };
        next.title = t;
    }
    if (body.url !== undefined) {
        const cleanUrl = sanitizeUrl(body.url);
        if (!cleanUrl) return { error: 'Địa chỉ URL không hợp lệ.' };
        next.url = cleanUrl;
    }
    if (body.icon !== undefined && ICONS.has(body.icon)) next.icon = body.icon;
    if (body.enabled !== undefined) next.enabled = !!body.enabled;

    const { rows } = await query(
        `UPDATE links SET title = $1, url = $2, icon = $3, enabled = $4, updated_at = now()
         WHERE id = $5 AND user_id = $6
         RETURNING *`,
        [next.title, next.url, next.icon, next.enabled, linkId, userId]
    );
    return { link: parseLink(rows[0]) };
}

async function deleteLink(userId, linkId) {
    const { rowCount } = await query(
        `DELETE FROM links WHERE id = $1 AND user_id = $2`,
        [linkId, userId]
    );
    return rowCount > 0;
}

/**
 * Cập nhật lại thứ tự các link theo mảng id.
 * Mỗi id phải thuộc về user — nếu có id lạ, từ chối toàn bộ.
 */
async function reorderLinks(userId, orderedIds) {
    if (!Array.isArray(orderedIds) || !orderedIds.length) {
        return { error: 'Danh sách thứ tự không hợp lệ.' };
    }
    const owned = await listLinks(userId);
    const ownedIds = new Set(owned.map((l) => l.id));
    if (!orderedIds.every((id) => ownedIds.has(Number(id)))) {
        return { error: 'Danh sách thứ tự không hợp lệ.' };
    }
    for (let i = 0; i < orderedIds.length; i++) {
        await query(
            `UPDATE links SET position = $1, updated_at = now() WHERE id = $2 AND user_id = $3`,
            [i, Number(orderedIds[i]), userId]
        );
    }
    return { ok: true };
}

async function incrementClick(userId, linkId) {
    await query(`UPDATE links SET clicks = clicks + 1 WHERE id = $1 AND user_id = $2`, [linkId, userId]);
}

module.exports = {
    listLinks,
    getLink,
    createLink,
    updateLink,
    deleteLink,
    reorderLinks,
    incrementClick,
    ICONS
};
