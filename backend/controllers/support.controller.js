'use strict';

const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');

const BUG_TYPES = new Set(['bug', 'suggestion', 'account', 'other']);

/**
 * POST /api/bugs — nhận báo lỗi từ người dùng (kể cả khách chưa đăng nhập).
 * Lưu vào database thật, trả 201 khi thành công — không giả lập.
 */
const reportBug = asyncHandler(async (req, res) => {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const type = String(body.type || 'bug');
    const description = String(body.description || '').trim();
    const pageUrl = String(body.url || '').trim().slice(0, 500);

    const errors = {};
    if (!name) errors.name = 'Nhập tên hoặc tên đăng nhập của bạn.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Email không hợp lệ.';
    if (!BUG_TYPES.has(type)) errors.type = 'Chọn loại vấn đề.';
    if (description.length < 10) errors.description = 'Mô tả chi tiết hơn (ít nhất 10 ký tự) để chúng tôi hỗ trợ nhanh.';
    if (pageUrl.length > 500) errors.url = 'Địa chỉ trang quá dài.';

    if (Object.keys(errors).length) {
        return res.status(422).json({ message: Object.values(errors)[0], errors });
    }

    await query(
        `INSERT INTO bug_reports (user_id, name, email, type, description, page_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user ? req.user.id : null, name.slice(0, 60), email, type, description, pageUrl]
    );

    res.status(201).json({ message: 'Đã gửi báo cáo. Cảm ơn bạn, đội ngũ Xn sẽ phản hồi qua email!' });
});

module.exports = { reportBug };
