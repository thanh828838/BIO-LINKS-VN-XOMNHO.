'use strict';

const shortlinkModel = require('../models/shortlink.model');
const analyticsModel = require('../models/analytics.model');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * Short links controller — CRUD của user đang đăng nhập.
 */

/** GET /api/shortlinks */
const list = asyncHandler(async (req, res) => {
    const shorts = await shortlinkModel.listShorts(req.user.id);
    res.json({ shorts });
});

/** POST /api/shortlinks */
const create = asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!String(body.url || '').trim()) {
        return res.status(422).json({ message: 'Nhập đường dẫn gốc cần rút gọn.' });
    }
    const result = await shortlinkModel.createShort(req.user.id, {
        url: body.url,
        title: body.title
    });
    if (result.error) return res.status(422).json({ message: result.error });
    res.status(201).json({ message: 'Đã tạo đường dẫn rút gọn.', short: result.short });
});

/** PUT /api/shortlinks/:id */
const update = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ message: 'Không tìm thấy đường dẫn.' });

    const body = req.body || {};
    const result = await shortlinkModel.updateShort(req.user.id, id, {
        url: body.url,
        title: body.title
    });
    if (result.error) {
        return res.status(result.error === 'Không tìm thấy đường dẫn.' ? 404 : 422)
            .json({ message: result.error });
    }
    res.json({ message: 'Đã lưu thay đổi.', short: result.short });
});

/** DELETE /api/shortlinks/:id */
const remove = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ message: 'Không tìm thấy đường dẫn.' });

    const ok = await shortlinkModel.deleteShort(req.user.id, id);
    if (!ok) return res.status(404).json({ message: 'Không tìm thấy đường dẫn.' });
    res.json({ message: 'Đã xóa đường dẫn rút gọn.' });
});

/**
 * GET /s/:slug — redirect công khai + đếm lượt nhấp.
 * Đặt ở server.js (không qua /api) để giữ URL ngắn đẹp.
 */
const handleRedirect = asyncHandler(async (req, res) => {
    const row = await shortlinkModel.getBySlug(String(req.params.slug || ''));
    if (!row) {
        return res.status(404).sendFile(require('path').join(__dirname, '..', '..', 'frontend', '404.html'));
    }
    const device = analyticsModel.detectDevice(req.headers['user-agent']);
    const referrer = analyticsModel.detectReferrer(req.headers.referer, req.hostname);
    await Promise.all([
        shortlinkModel.incrementClick(row.id),
        analyticsModel.recordClickLog(row.user_id, {
            shortId: row.id,
            label: row.title || row.slug,
            device,
            referrer
        })
    ]);
    res.redirect(302, row.original_url);
});

module.exports = { list, create, update, remove, handleRedirect };
