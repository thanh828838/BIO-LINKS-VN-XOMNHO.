'use strict';

const analyticsModel = require('../models/analytics.model');
const { asyncHandler } = require('../middleware/error.middleware');

/** GET /api/analytics — tổng hợp cho user đang đăng nhập */
const overview = asyncHandler(async (req, res) => {
    const [overview, history] = await Promise.all([
        analyticsModel.getOverview(req.user.id),
        analyticsModel.viewsHistory(req.user.id, 7)
    ]);
    res.json(Object.assign(overview, { viewsHistory: history }));
});

module.exports = { overview };
