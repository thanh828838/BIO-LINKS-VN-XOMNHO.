'use strict';

/** 404 cho các route API không tồn tại. */
function notFound(req, res) {
    res.status(404).json({ message: 'Không tìm thấy tài nguyên.' });
}

/**
 * Xử lý lỗi tập trung — mọi lỗi từ controllers/models dồn về đây.
 * Không bao giờ lộ stack trace hay chi tiết database cho client.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    if (status >= 500) {
        console.error('[error]', req.method, req.originalUrl, '\n', err);
    }
    const message = status >= 500 && process.env.NODE_ENV === 'production'
        ? 'Đã xảy ra lỗi phía máy chủ. Vui lòng thử lại sau.'
        : (err.expose !== false && err.public ? err.message : 'Đã xảy ra lỗi phía máy chủ. Vui lòng thử lại sau.');
    res.status(status).json({ message });
}

/** Bọc controller async để lỗi promise tự động vào errorHandler. */
function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Tạo lỗi có status + message công khai cho client. */
function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    err.public = true;
    return err;
}

module.exports = { notFound, errorHandler, asyncHandler, httpError };
