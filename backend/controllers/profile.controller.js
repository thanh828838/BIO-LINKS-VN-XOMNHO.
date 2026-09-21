'use strict';

const crypto = require('crypto');
const profileModel = require('../models/profile.model');
const socialModel = require('../models/social.model');
const userModel = require('../models/user.model');
const analyticsModel = require('../models/analytics.model');
const { asyncHandler, httpError } = require('../middleware/error.middleware');
const { validateUsername, validateEmail, RESERVED } = require('../utils/validate');

/**
 * Profile controller — GET/PUT profile của user đang đăng nhập,
 * và trang public profile theo username.
 */

/** GET /api/profile — profile + socials + stats của chính mình */
const getMyProfile = asyncHandler(async (req, res) => {
    if (!req.user) throw httpError(401, 'Bạn cần đăng nhập để thực hiện việc này.');
    const row = await profileModel.getProfile(req.user.id);
    if (!row) throw httpError(404, 'Không tìm thấy hồ sơ.');

    const [socials, views, history, links] = await Promise.all([
        socialModel.listSocials(req.user.id),
        socialModel.totalViews(req.user.id),
        socialModel.viewsHistory(req.user.id, 7),
        require('../models/link.model').listLinks(req.user.id)
    ]);

    res.json({
        user: { id: req.user.id, username: req.user.username, email: req.user.email },
        profile: profileModel.parseProfile(row),
        socials,
        stats: { views, history, clicks: links.reduce((s, l) => s + (l.clicks || 0), 0) },
        links
    });
});

/** PUT /api/profile — cập nhật profile + socials (+ username/email) */
const updateMyProfile = asyncHandler(async (req, res) => {
    if (!req.user) throw httpError(401, 'Bạn cần đăng nhập để thực hiện việc này.');
    const body = req.body || {};

    // Username / email thay đổi thì validate + kiểm tra trùng
    if (body.username !== undefined && String(body.username).toLowerCase() !== req.user.username) {
        const u = validateUsername(body.username);
        if (u.error) return res.status(422).json({ message: u.error });
        if (RESERVED.includes(u.value)) return res.status(422).json({ message: 'Tên này đã được đặt trước. Hãy chọn tên khác.' });
        if (await userModel.usernameExists(u.value)) return res.status(409).json({ message: 'Tên đăng nhập này đã có người dùng.' });
        await userModel.updateUsername(req.user.id, u.value);
    }
    if (body.email !== undefined && String(body.email).toLowerCase() !== req.user.email) {
        const e = validateEmail(body.email);
        if (e.error) return res.status(422).json({ message: e.error });
        if (await userModel.emailExists(e.value)) return res.status(409).json({ message: 'Email này đã được dùng cho một tài khoản khác.' });
        await userModel.updateEmail(req.user.id, e.value);
    }

    await profileModel.updateProfile(req.user.id, body);
    await socialModel.syncSocials(req.user.id, body.socials);

    // Trả về trạng thái mới nhất
    const freshUser = await userModel.findById(req.user.id);
    const row = await profileModel.getProfile(req.user.id);
    const socials = await socialModel.listSocials(req.user.id);

    res.json({
        message: 'Đã lưu thay đổi.',
        user: { id: freshUser.id, username: freshUser.username, email: freshUser.email },
        profile: profileModel.parseProfile(row),
        socials
    });
});

/** GET /api/u/:username — public profile (không cần đăng nhập) */
const getPublicProfile = asyncHandler(async (req, res) => {
    const username = String(req.params.username || '').toLowerCase();
    const user = await userModel.findByUsername(username);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy trang này.' });

    const row = await profileModel.getProfile(user.id);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy trang này.' });

    const links = (await require('../models/link.model').listLinks(user.id))
        .filter((l) => l.enabled);

    // Đếm lượt xem + ghi log truy cập (visitor id ẩn danh qua cookie)
    let visitorId = req.cookies.xnvid;
    if (!visitorId || !/^[a-f0-9]{32}$/.test(visitorId)) {
        visitorId = crypto.randomBytes(16).toString('hex');
        res.cookie('xnvid', visitorId, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 365 * 24 * 60 * 60 * 1000
        });
    }
    const device = analyticsModel.detectDevice(req.headers['user-agent']);
    const referrer = analyticsModel.detectReferrer(req.headers.referer, req.hostname);
    await analyticsModel.recordVisit(user.id, visitorId, device, referrer);

    res.json({
        user: { id: user.id, username: user.username },
        profile: profileModel.parseProfile(row),
        socials: await socialModel.listSocials(user.id),
        links
    });
});

/** POST /api/u/:username/clicks — body: { linkId } */
const recordClick = asyncHandler(async (req, res) => {
    const username = String(req.params.username || '').toLowerCase();
    const linkId = Number((req.body || {}).linkId);
    const user = await userModel.findByUsername(username);
    if (!user || !Number.isInteger(linkId)) return res.status(404).json({ message: 'Không tìm thấy liên kết.' });

    const linkModel = require('../models/link.model');
    const link = await linkModel.getLink(user.id, linkId);
    if (!link) return res.status(404).json({ message: 'Không tìm thấy liên kết.' });

    await Promise.all([
        linkModel.incrementClick(user.id, linkId),
        analyticsModel.recordClickLog(user.id, {
            linkId,
            label: link.title,
            visitorId: String(req.cookies.xnvid || ''),
            device: analyticsModel.detectDevice(req.headers['user-agent']),
            referrer: analyticsModel.detectReferrer(req.headers.referer, req.hostname)
        })
    ]);
    res.json({ ok: true });
});

/** GET /api/preferences — tuỳ chọn thông báo của tôi */
const getPreferences = asyncHandler(async (req, res) => {
    if (!req.user) throw httpError(401, 'Bạn cần đăng nhập để thực hiện việc này.');
    res.json({ preferences: await profileModel.getPrefs(req.user.id) });
});

/** PUT /api/preferences */
const updatePreferences = asyncHandler(async (req, res) => {
    if (!req.user) throw httpError(401, 'Bạn cần đăng nhập để thực hiện việc này.');
    const prefs = await profileModel.updatePrefs(req.user.id, req.body || {});
    res.json({ message: 'Đã lưu tuỳ chọn.', preferences: prefs });
});

module.exports = {
    getMyProfile,
    updateMyProfile,
    getPublicProfile,
    recordClick,
    getPreferences,
    updatePreferences
};
