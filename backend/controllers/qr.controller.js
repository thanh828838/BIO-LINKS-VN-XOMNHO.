'use strict';

const QRCode = require('qrcode');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * QR controller — render PNG từ URL/text bằng thư viện qrcode (server-side).
 * GET /api/qr?data=<encoded>&size=<128..1024>
 */
const generate = asyncHandler(async (req, res) => {
    const data = String(req.query.data || '').trim();
    if (!data || data.length > 800) {
        return res.status(422).json({ message: 'Dữ liệu QR không hợp lệ.' });
    }
    let size = Number(req.query.size) || 320;
    if (!Number.isFinite(size) || size < 128) size = 128;
    if (size > 1024) size = 1024;

    const buffer = await QRCode.toBuffer(data, {
        type: 'png',
        width: size,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
        errorCorrectionLevel: 'M'
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(buffer);
});

module.exports = { generate };
