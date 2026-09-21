'use strict';

const userModel = require('../models/user.model');
const { COOKIE_NAME, COOKIE_OPTIONS } = require('../middleware/auth.middleware');
const { asyncHandler, httpError } = require('../middleware/error.middleware');
const { validateUsername, validateEmail, validatePassword, RESERVED } = require('../utils/validate');

/** Phiên bản hiện tại của Điều khoản/Chính sách — tăng khi sửa văn bản pháp lý. */
const LEGAL_VERSION = '1.0';

/**
 * Auth controller — register / login / logout / me.
 * Response JSON luôn kèm { message } tiếng Việt khi có lỗi.
 */

/** POST /api/register */
const register = asyncHandler(async (req, res) => {
    const body = req.body || {};

    // Legal consent là bắt buộc — không chỉ dựa vào frontend
    if (body.legalAccepted !== true) {
        return res.status(400).json({
            message: 'Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách riêng tư trước khi đăng ký.'
        });
    }

    const errors = {};
    const u = validateUsername(body.username);
    const e = validateEmail(body.email);
    const p = validatePassword(body.password);
    if (u.error) errors.username = u.error;
    if (e.error) errors.email = e.error;
    if (p.error) errors.password = p.error;
    if (RESERVED.includes(u.value)) errors.username = 'Tên này đã được đặt trước. Hãy chọn tên khác.';

    if (!Object.keys(errors).length) {
        if (await userModel.usernameExists(u.value)) errors.username = 'Tên đăng nhập này đã có người dùng.';
        if (await userModel.emailExists(e.value)) errors.email = 'Email này đã được dùng cho một tài khoản khác.';
    }
    if (Object.keys(errors).length) {
        return res.status(422).json({ message: Object.values(errors)[0], errors });
    }

    const user = await userModel.createUser({
        username: u.value,
        email: e.value,
        password: p.value,
        legal: { accepted: true, version: LEGAL_VERSION }
    });

    // Đăng nhập luôn sau đăng ký
    const session = await userModel.createSession(user.id);
    res.cookie(COOKIE_NAME, session.id, COOKIE_OPTIONS);

    res.status(201).json({
        message: 'Tạo tài khoản thành công.',
        user: { id: user.id, username: user.username }
    });
});

/** POST /api/login — chỉ username + password */
const login = asyncHandler(async (req, res) => {
    const body = req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!username || !password) {
        return res.status(422).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
    }

    const user = await userModel.findByUsername(username);
    const valid = await userModel.verifyPassword(user, password);
    if (!valid) {
        return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    const session = await userModel.createSession(user.id);
    res.cookie(COOKIE_NAME, session.id, COOKIE_OPTIONS);

    res.json({
        message: 'Đăng nhập thành công.',
        user: { id: user.id, username: user.username }
    });
});

/** POST /api/logout — huỷ session trên server, xoá cookie */
const logout = asyncHandler(async (req, res) => {
    if (req.sessionId) {
        await userModel.destroySession(req.sessionId);
    }
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ message: 'Đã đăng xuất.' });
});

/** GET /api/me */
const me = asyncHandler(async (req, res) => {
    if (!req.user) {
        return res.json({ authenticated: false, user: null });
    }
    res.json({
        authenticated: true,
        user: { id: req.user.id, username: req.user.username }
    });
});

/** POST /api/password — đổi mật khẩu (đã đăng nhập) */
const changePassword = asyncHandler(async (req, res) => {
    if (!req.user) throw httpError(401, 'Bạn cần đăng nhập để thực hiện việc này.');
    const currentPw = String((req.body || {}).currentPassword || '');
    const newPw = String((req.body || {}).newPassword || '');

    const row = await userModel.findById(req.user.id);
    const ok = await userModel.verifyPassword(row, currentPw);
    if (!ok) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });

    const p = validatePassword(newPw);
    if (p.error) return res.status(422).json({ message: p.error });

    await userModel.updatePassword(req.user.id, p.value);
    res.json({ message: 'Đã đổi mật khẩu.' });
});

/** POST /api/account/delete — xoá tài khoản (đã đăng nhập) */
const deleteAccount = asyncHandler(async (req, res) => {
    if (!req.user) throw httpError(401, 'Bạn cần đăng nhập để thực hiện việc này.');
    const password = String((req.body || {}).password || '');
    const row = await userModel.findById(req.user.id);
    const ok = await userModel.verifyPassword(row, password);
    if (!ok) return res.status(400).json({ message: 'Mật khẩu không đúng. Tài khoản chưa được xoá.' });

    await userModel.deleteUser(req.user.id);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ message: 'Tài khoản đã được xoá.' });
});

/** POST /api/sessions/revoke-all — đăng xuất khỏi mọi thiết bị */
const revokeAllSessions = asyncHandler(async (req, res) => {
    if (!req.user) throw httpError(401, 'Bạn cần đăng nhập để thực hiện việc này.');
    await userModel.destroyAllSessions(req.user.id);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ message: 'Đã đăng xuất khỏi mọi thiết bị.' });
});

/** GET /api/export — tải toàn bộ dữ liệu của tài khoản (JSON) */
const exportData = asyncHandler(async (req, res) => {
    if (!req.user) throw httpError(401, 'Bạn cần đăng nhập để thực hiện việc này.');

    const profileModel = require('../models/profile.model');
    const linkModel = require('../models/link.model');
    const shortlinkModel = require('../models/shortlink.model');
    const socialModel = require('../models/social.model');

    const [row, links, socials, shorts, prefs, legal] = await Promise.all([
        profileModel.getProfile(req.user.id),
        linkModel.listLinks(req.user.id),
        socialModel.listSocials(req.user.id),
        shortlinkModel.listShorts(req.user.id),
        profileModel.getPrefs(req.user.id),
        userModel.getLegalInfo(req.user.id)
    ]);

    res.setHeader('Content-Disposition', `attachment; filename="xn-data-${req.user.username}.json"`);
    res.json({
        exportedAt: new Date().toISOString(),
        user: { username: req.user.username, email: req.user.email, createdAt: req.user.createdAt },
        profile: profileModel.parseProfile(row),
        links,
        socials,
        shortLinks: shorts,
        preferences: prefs,
        legal
    });
});

module.exports = { register, login, logout, me, changePassword, deleteAccount, revokeAllSessions, exportData };
