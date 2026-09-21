'use strict';

const { query } = require('../config/database');

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validation tập trung cho toàn bộ backend.
 * Mỗi hàm trả về object { ok, errors: {field: message} } — message bằng tiếng Việt.
 */

function validateUsername(username) {
    const v = String(username || '').trim().toLowerCase();
    if (!v) return { value: v, error: 'Vui lòng chọn tên đăng nhập.' };
    if (v.length < 3) return { value: v, error: 'Tên đăng nhập cần ít nhất 3 ký tự.' };
    if (v.length > 20) return { value: v, error: 'Tên đăng nhập tối đa 20 ký tự.' };
    if (!USERNAME_RE.test(v)) return { value: v, error: 'Chỉ dùng chữ thường, số, dấu chấm và gạch dưới.' };
    return { value: v, error: '' };
}

function validateEmail(email) {
    const v = String(email || '').trim().toLowerCase();
    if (!v) return { value: v, error: 'Vui lòng nhập địa chỉ email.' };
    if (v.length > 255 || !EMAIL_RE.test(v)) return { value: v, error: 'Địa chỉ email không hợp lệ.' };
    return { value: v, error: '' };
}

function validatePassword(password) {
    const v = String(password || '');
    if (!v) return { value: v, error: 'Vui lòng chọn mật khẩu.' };
    if (v.length < 8) return { value: v, error: 'Mật khẩu cần ít nhất 8 ký tự.' };
    if (v.length > 72) return { value: v, error: 'Mật khẩu tối đa 72 ký tự.' };
    if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return { value: v, error: 'Mật khẩu cần cả chữ cái và số.' };
    return { value: v, error: '' };
}

/** Chuẩn hoá URL người dùng nhập: bắt buộc http(s) hoặc mailto. */
function sanitizeUrl(input) {
    let v = String(input || '').trim();
    if (!v) return '';
    if (/^mailto:/i.test(v)) return v;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
        const u = new URL(v);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
        return u.href;
    } catch {
        return '';
    }
}

const RESERVED = ['login', 'register', 'dashboard', 'settings', 'admin', 'api', 'about',
    'help', 'xn', 'support', 'terms', 'privacy', 'static', 'assets'];

module.exports = {
    validateUsername,
    validateEmail,
    validatePassword,
    sanitizeUrl,
    RESERVED
};
