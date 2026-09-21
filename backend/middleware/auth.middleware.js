'use strict';

const userModel = require('../models/user.model');

/**
 * Middleware xác thực bằng session cookie (httpOnly).
 * Cookie name: xn.sid
 */
const COOKIE_NAME = 'xn.sid';

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 ngày
};

/** Gắn req.user nếu có session hợp lệ; không chặn request. */
async function attachUser(req, res, next) {
    try {
        const sid = req.cookies[COOKIE_NAME];
        if (sid) {
            const found = await userModel.findSession(sid);
            if (found) {
                req.sessionId = found.session.id;
                req.user = found.user;
            }
        }
        next();
    } catch (err) {
        next(err);
    }
}

/** Bắt buộc đăng nhập — dùng cho mọi API private. */
function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: 'Bạn cần đăng nhập để thực hiện việc này.' });
    }
    next();
}

module.exports = { COOKIE_NAME, COOKIE_OPTIONS, attachUser, requireAuth };
