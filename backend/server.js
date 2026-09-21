'use strict';

/**
 * Xn Bio Links — server chính.
 * - Phục vụ frontend tĩnh từ ../frontend
 * - REST API dưới /api/*
 * - Route sạch: /login, /register, /dashboard, /settings, /:username
 * - Frontend KHÔNG BAO GIỜ kết nối database — chỉ gọi API qua fetch().
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./config/database');
const { attachUser } = require('./middleware/auth.middleware');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const userModel = require('./models/user.model');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachUser);

// API có trạng thái session — tuyệt đối không cho trình duyệt/proxy cache,
// tránh lỗi "login xong vẫn bị đá về login" do trả cached authenticated:false
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
});

/* ------------------------- API ------------------------- */
app.use('/api', require('./routes/auth.routes'));
app.use('/api', require('./routes/links.routes'));
app.use('/api', require('./routes/profile.routes'));
app.use('/api', require('./routes/shortlinks.routes'));
app.use('/api', require('./routes/analytics.routes'));
app.use('/api', require('./routes/support.routes'));

// API nào khác dưới /api mà không khớp route => 404 JSON
app.use('/api', notFound);

/* Redirect rút gọn: /s/:slug → đường dẫn gốc (công khai) */
app.get('/s/:slug', require('./controllers/shortlink.controller').handleRedirect);

/* ------------------------- Frontend tĩnh ------------------------- */
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR, { index: false, maxAge: 0, etag: true }));

/* Route sạch — refresh trực tiếp không bị 404 */
const send = (res, file) => res.sendFile(path.join(FRONTEND_DIR, file));

app.get('/', (req, res) => send(res, 'index.html'));
app.get('/login', (req, res) => send(res, 'login.html'));
app.get('/register', (req, res) => send(res, 'register.html'));
app.get('/dashboard', (req, res) => send(res, 'dashboard.html'));
app.get('/short-links', (req, res) => send(res, 'shortlinks.html'));
app.get('/qr', (req, res) => send(res, 'qr.html'));
app.get('/analytics', (req, res) => send(res, 'analytics.html'));
app.get('/settings', (req, res) => send(res, 'settings.html'));
app.get('/support', (req, res) => send(res, 'support.html'));
app.get('/report', (req, res) => send(res, 'report.html'));
app.get('/team', (req, res) => send(res, 'team.html'));
app.get('/terms', (req, res) => send(res, 'terms.html'));
app.get('/privacy', (req, res) => send(res, 'privacy.html'));
app.get('/cookies', (req, res) => send(res, 'cookies.html'));
app.get('/legal', (req, res) => send(res, 'legal.html'));
app.get('/404', (req, res) => send(res, '404.html'));

/* Trang công khai theo chuẩn mới: /user/:username */
app.get('/user/:username', (req, res) => send(res, 'profile.html'));

/* Public profile: /:username — xác minh username tồn tại trước khi trả profile.html */
app.get('/:username', async (req, res, next) => {
    try {
        const username = String(req.params.username || '').toLowerCase();
        if (username.includes('.') || username.includes('-')) {
            return res.status(404).sendFile(path.join(FRONTEND_DIR, '404.html'));
        }
        const user = await userModel.findByUsername(username);
        if (user) return send(res, 'profile.html');
        return res.status(404).sendFile(path.join(FRONTEND_DIR, '404.html'));
    } catch (err) {
        next(err);
    }
});

/* Mọi đường dẫn còn lại → 404 trang đẹp */
app.use((req, res) => res.status(404).sendFile(path.join(FRONTEND_DIR, '404.html')));

/* ------------------------- Khởi động ------------------------- */
const PORT = Number(process.env.PORT) || 3000;

(async () => {
    try {
        await db.ensureConnection();
        await userModel.purgeExpiredSessions();

        // Dọn session hết hạn mỗi 6 giờ
        setInterval(() => {
            userModel.purgeExpiredSessions().catch(() => {});
        }, 6 * 60 * 60 * 1000);

        app.use(errorHandler);

        app.listen(PORT, () => {
            console.log(`[xn] Server đang chạy tại http://localhost:${PORT}`);
            console.log(`[xn] Frontend: ${FRONTEND_DIR}`);
        });
    } catch (err) {
        console.error('[xn] Không thể kết nối database. Kiểm tra DATABASE_URL trong .env');
        console.error('[xn]', err.message);
        process.exit(1);
    }
})();

module.exports = app;
