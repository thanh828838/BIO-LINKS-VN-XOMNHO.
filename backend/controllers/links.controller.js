'use strict';

const linkModel = require('../models/link.model');
const socialModel = require('../models/social.model');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * Links controller — CRUD liên kết của user đang đăng nhập.
 */

/** GET /api/links */
const list = asyncHandler(async (req, res) => {
    const links = await linkModel.listLinks(req.user.id);
    res.json({ links });
});

/** POST /api/links */
const create = asyncHandler(async (req, res) => {
    const body = req.body || {};
    const result = await linkModel.createLink(req.user.id, {
        title: body.title,
        url: body.url,
        icon: body.icon,
        enabled: body.enabled
    });
    if (result.error) return res.status(422).json({ message: result.error });
    res.status(201).json({ message: 'Đã thêm liên kết.', link: result.link });
});

/** PUT /api/links/:id */
const update = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ message: 'Không tìm thấy liên kết.' });

    const body = req.body || {};
    const result = await linkModel.updateLink(req.user.id, id, {
        title: body.title,
        url: body.url,
        icon: body.icon,
        enabled: body.enabled
    });
    if (result.error) return res.status(result.error === 'Không tìm thấy liên kết.' ? 404 : 422)
        .json({ message: result.error });
    res.json({ message: 'Đã lưu liên kết.', link: result.link });
});

/** DELETE /api/links/:id */
const remove = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ message: 'Không tìm thấy liên kết.' });

    const ok = await linkModel.deleteLink(req.user.id, id);
    if (!ok) return res.status(404).json({ message: 'Không tìm thấy liên kết.' });
    res.json({ message: 'Đã xoá liên kết.' });
});

/** PUT /api/links/order — body: { order: [id, id, ...] } */
const reorder = asyncHandler(async (req, res) => {
    const order = (req.body || {}).order;
    const result = await linkModel.reorderLinks(req.user.id, order);
    if (result.error) return res.status(422).json({ message: result.error });
    const links = await linkModel.listLinks(req.user.id);
    res.json({ message: 'Đã lưu thứ tự mới.', links });
});

module.exports = { list, create, update, remove, reorder };
