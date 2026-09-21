'use strict';

const { query } = require('../config/database');
const { sanitizeUrl } = require('../utils/validate');

/**
 * Model social_links + page_views (thống kê lượt xem).
 */

const PLATFORMS = new Set(['instagram', 'tiktok', 'youtube', 'x', 'facebook', 'github']);
const PLATFORM_PREFIX = {
    instagram: 'instagram.com/',
    tiktok: 'tiktok.com/@',
    youtube: 'youtube.com/@',
    x: 'x.com/',
    facebook: 'facebook.com/',
    github: 'github.com/'
};

function parseSocial(row) {
    if (!row) return null;
    return {
        platform: row.platform,
        url: row.url,
        position: row.position,
        enabled: row.enabled
    };
}

async function listSocials(userId) {
    const { rows } = await query(
        `SELECT * FROM social_links WHERE user_id = $1 ORDER BY position ASC, id ASC`,
        [userId]
    );
    return rows.map(parseSocial);
}

/**
 * Đồng bộ toàn bộ social links của user theo body gửi lên.
 * Nhận object { instagram: 'username', youtube: '@channel', ... }.
 * Giá trị rỗng => xoá platform đó.
 */
async function syncSocials(userId, socialsInput) {
    if (!socialsInput || typeof socialsInput !== 'object' || Array.isArray(socialsInput)) return;

    const entries = Object.entries(socialsInput)
        .filter(([platform]) => PLATFORMS.has(platform))
        .map(([platform, value], i) => {
            let raw = String(value || '').trim().replace(/^@/, '');
            let url = '';
            if (raw) {
                if (/^https?:\/\//i.test(raw)) url = sanitizeUrl(raw);
                else url = 'https://' + PLATFORM_PREFIX[platform] + raw.replace(/^\/+/, '');
            }
            return { platform, url, position: i };
        })
        .filter((e) => e.url);

    await query('DELETE FROM social_links WHERE user_id = $1', [userId]);
    for (const e of entries) {
        await query(
            `INSERT INTO social_links (user_id, platform, url, position)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, platform) DO UPDATE SET url = EXCLUDED.url, position = EXCLUDED.position`,
            [userId, e.platform, e.url, e.position]
        );
    }
}

/* ------------------------- page_views ------------------------- */

/** Đếm 1 lượt xem cho user trong ngày hôm nay. */
async function recordView(userId) {
    await query(
        `INSERT INTO page_views (user_id, day, views) VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (user_id, day) DO UPDATE SET views = page_views.views + 1`,
        [userId]
    );
}

async function totalViews(userId) {
    const { rows } = await query(
        `SELECT COALESCE(SUM(views), 0) AS total FROM page_views WHERE user_id = $1`,
        [userId]
    );
    return Number(rows[0].total) || 0;
}

/** 7 ngày gần nhất, đủ ngày (ngày thiếu = 0). */
async function viewsHistory(userId, days = 7) {
    const { rows } = await query(
        `SELECT day::text, views FROM page_views
         WHERE user_id = $1 AND day >= CURRENT_DATE - ($2::int - 1)
         ORDER BY day ASC`,
        [userId, days]
    );
    const byDay = Object.fromEntries(rows.map((r) => [r.day, Number(r.views)]));
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        out.push({ day: key, views: byDay[key] || 0 });
    }
    return out;
}

module.exports = {
    listSocials,
    syncSocials,
    recordView,
    totalViews,
    viewsHistory,
    PLATFORMS
};
