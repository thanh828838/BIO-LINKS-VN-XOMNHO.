'use strict';

const { query } = require('../config/database');

/**
 * Model analytics — visits + click_logs.
 * visitor_id: cookie ẩn danh (xn.vid) để đếm khách truy cập duy nhất.
 */

/** Phân loại thiết bị thô từ User-Agent — chỉ mobile/tablet/desktop. */
function detectDevice(userAgent) {
    const ua = String(userAgent || '');
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    if (/Mobi|Android.*Mobile|iPhone/i.test(ua)) return 'mobile';
    return 'desktop';
}

/** Host của Referer; rỗng hoặc cùng host mình => "(trực tiếp)". */
function detectReferrer(refererHeader, ownHost) {
    const raw = String(refererHeader || '').trim();
    if (!raw) return '(trực tiếp)';
    try {
        const host = new URL(raw).host;
        if (!host || host === ownHost) return '(trực tiếp)';
        return host.slice(0, 120);
    } catch {
        return '(trực tiếp)';
    }
}

async function recordVisit(userId, visitorId, device, referrer) {
    await query(
        `INSERT INTO visits (user_id, visitor_id, device, referrer) VALUES ($1, $2, $3, $4)`,
        [userId, visitorId, device, referrer]
    );
    await query(
        `INSERT INTO page_views (user_id, day, views) VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (user_id, day) DO UPDATE SET views = page_views.views + 1`,
        [userId]
    );
}

async function recordClickLog(userId, { linkId = null, shortId = null, label = '', visitorId = '', device = 'desktop', referrer = '(trực tiếp)' }) {
    await query(
        `INSERT INTO click_logs (user_id, link_id, short_id, label, visitor_id, device, referrer)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, linkId, shortId, String(label).slice(0, 80), visitorId, device, referrer]
    );
}

async function getOverview(userId) {
    const [views, unique, linkClicks, shortClicks, topLinks, recent, devices, referrers] = await Promise.all([
        query(`SELECT COALESCE(SUM(views), 0) AS total FROM page_views WHERE user_id = $1`, [userId]),
        query(`SELECT COUNT(DISTINCT visitor_id) AS total FROM visits WHERE user_id = $1`, [userId]),
        query(`SELECT COALESCE(SUM(clicks), 0) AS total FROM links WHERE user_id = $1`, [userId]),
        query(`SELECT COALESCE(SUM(clicks), 0) AS total FROM short_links WHERE user_id = $1`, [userId]),
        query(
            `SELECT id, title, icon, clicks FROM links WHERE user_id = $1 ORDER BY clicks DESC, id ASC LIMIT 5`,
            [userId]
        ),
        query(
            `SELECT label, device, referrer, created_at FROM click_logs
             WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
            [userId]
        ),
        query(
            `SELECT device, COUNT(*) AS count FROM visits WHERE user_id = $1 GROUP BY device ORDER BY count DESC`,
            [userId]
        ),
        query(
            `SELECT referrer, COUNT(*) AS count FROM visits WHERE user_id = $1 GROUP BY referrer ORDER BY count DESC LIMIT 5`,
            [userId]
        )
    ]);

    return {
        totals: {
            bioViews: Number(views.rows[0].total) || 0,
            uniqueVisitors: Number(unique.rows[0].total) || 0,
            linkClicks: Number(linkClicks.rows[0].total) || 0,
            shortClicks: Number(shortClicks.rows[0].total) || 0
        },
        topLinks: topLinks.rows.map((r) => ({ id: r.id, title: r.title, icon: r.icon, clicks: r.clicks })),
        recentClicks: recent.rows.map((r) => ({
            label: r.label,
            device: r.device,
            referrer: r.referrer,
            at: r.created_at
        })),
        devices: devices.rows.map((r) => ({ device: r.device, count: Number(r.count) })),
        referrers: referrers.rows.map((r) => ({ referrer: r.referrer, count: Number(r.count) }))
    };
}

/** Lịch sử lượt xem 7 ngày (dùng ở dashboard + analytics). */
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

module.exports = { detectDevice, detectReferrer, recordVisit, recordClickLog, getOverview, viewsHistory };
