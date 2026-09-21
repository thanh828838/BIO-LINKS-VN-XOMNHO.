'use strict';

const { query } = require('../config/database');

/**
 * Model profiles — 1-1 với users.
 * Giá trị appearance phải nằm trong whitelist để tránh dữ liệu rác.
 */

const BACKGROUNDS = ['mist', 'ink', 'dusk', 'citrus', 'forest', 'rose'];
const BUTTON_STYLES = ['fill', 'outline', 'soft', 'glass'];
const FONTS = ['sans', 'serif', 'mono', 'round'];
const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;

function parseProfile(row) {
    if (!row) return null;
    return {
        displayName: row.display_name || '',
        bio: row.bio || '',
        avatarUrl: row.avatar_url || '',
        background: row.background,
        accentColor: row.accent_color,
        buttonStyle: row.button_style,
        font: row.font
    };
}

async function getProfile(userId) {
    const { rows } = await query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    return rows[0] || null;
}

/** Chỉ nhận các trường được phép sửa; phần còn lại giữ nguyên. */
function pickFields(body, current) {
    const next = {
        display_name: current.display_name,
        bio: current.bio,
        avatar_url: current.avatar_url,
        background: current.background,
        accent_color: current.accent_color,
        button_style: current.button_style,
        font: current.font
    };

    if (body.displayName !== undefined) {
        const v = String(body.displayName).trim();
        if (v.length <= 40) next.display_name = v;
    }
    if (body.bio !== undefined) {
        const v = String(body.bio).trim();
        if (v.length <= 140) next.bio = v;
    }
    if (body.avatar !== undefined) {
        const v = String(body.avatar || '').trim();
        // chỉ nhận data URL ảnh hoặc URL http(s), rỗng = dùng avatar mặc định
        if (v === '') next.avatar_url = '';
        else if (/^data:image\/(png|jpeg|webp);base64,/.test(v) && v.length <= 300000) next.avatar_url = v;
        else if (/^https:\/\//i.test(v) && v.length <= 500) next.avatar_url = v;
    }
    if (body.background !== undefined && BACKGROUNDS.includes(body.background)) {
        next.background = body.background;
    }
    if (body.buttonStyle !== undefined && BUTTON_STYLES.includes(body.buttonStyle)) {
        next.button_style = body.buttonStyle;
    }
    if (body.font !== undefined && FONTS.includes(body.font)) {
        next.font = body.font;
    }
    if (body.accentColor !== undefined && ACCENT_RE.test(String(body.accentColor))) {
        next.accent_color = String(body.accentColor).toUpperCase();
    }
    return next;
}

async function updateProfile(userId, body) {
    const current = await getProfile(userId);
    if (!current) return null;
    const next = pickFields(body, current);
    const { rows } = await query(
        `UPDATE profiles SET
            display_name = $1, bio = $2, avatar_url = $3,
            background = $4, accent_color = $5, button_style = $6, font = $7,
            updated_at = now()
         WHERE user_id = $8
         RETURNING *`,
        [next.display_name, next.bio, next.avatar_url,
         next.background, next.accent_color, next.button_style, next.font, userId]
    );
    return rows[0] || null;
}

/* ------------------------- Preferences ------------------------- */

const PREF_DEFAULTS = {
    notifyProduct: true,   // email cập nhật sản phẩm
    notifyViews: true,     // thông báo khi trang có nhiều lượt xem
    notifyWeekly: false    // tổng kết hàng tuần
};

function normalizePrefs(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    for (const key of Object.keys(PREF_DEFAULTS)) {
        out[key] = typeof src[key] === 'boolean' ? src[key] : PREF_DEFAULTS[key];
    }
    return out;
}

async function getPrefs(userId) {
    await query(
        `INSERT INTO user_prefs (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [userId]
    );
    const { rows } = await query(`SELECT prefs FROM user_prefs WHERE user_id = $1`, [userId]);
    return normalizePrefs(rows[0] && rows[0].prefs);
}

async function updatePrefs(userId, partial) {
    const current = await getPrefs(userId);
    const next = normalizePrefs(Object.assign({}, current, partial || {}));
    await query(
        `UPDATE user_prefs SET prefs = $1, updated_at = now() WHERE user_id = $2`,
        [JSON.stringify(next), userId]
    );
    return next;
}

module.exports = {
    getProfile,
    updateProfile,
    parseProfile,
    getPrefs,
    updatePrefs,
    BACKGROUNDS,
    BUTTON_STYLES,
    FONTS
};
