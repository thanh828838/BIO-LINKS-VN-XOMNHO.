const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }
  next();
}

// Cấu hình lưu file upload
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${req.session.userId}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ nhận file jpg, png, webp'));
    }
  }
});

// GET /api/settings - Lấy info settings
router.get('/', requireAuth, (req, res) => {
  db.get(
    'SELECT id, username, email, display_name, bio, avatar_url, created_at FROM users WHERE id = ?',
    [req.session.userId],
    (err, user) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!user) return res.status(404).json({ success: false, error: 'User không tồn tại' });
      res.json({ success: true, user });
    }
  );
});

// PUT /api/settings - Cập nhật display_name + bio
router.put('/', requireAuth, (req, res) => {
  let { display_name, bio } = req.body;

  display_name = display_name ? display_name.trim() : '';
  bio = bio ? bio.trim() : '';

  if (display_name.length > 50) {
    return res.status(400).json({ success: false, error: 'Tên hiển thị tối đa 50 ký tự' });
  }

  if (bio.length > 200) {
    return res.status(400).json({ success: false, error: 'Bio tối đa 200 ký tự' });
  }

  db.run(
    'UPDATE users SET display_name = ?, bio = ? WHERE id = ?',
    [display_name || null, bio || null, req.session.userId],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: 'Đã lưu thay đổi' });
    }
  );
});

// POST /api/settings/avatar - Upload avatar
router.post('/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Chưa chọn file' });
  }

  const avatarUrl = `/uploads/${req.file.filename}`;

  // Xóa avatar cũ (nếu có)
  db.get(
    'SELECT avatar_url FROM users WHERE id = ?',
    [req.session.userId],
    (err, row) => {
      if (row && row.avatar_url) {
        const oldPath = path.join(__dirname, '../public', row.avatar_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      db.run(
        'UPDATE users SET avatar_url = ? WHERE id = ?',
        [avatarUrl, req.session.userId],
        function (err) {
          if (err) return res.status(500).json({ success: false, error: err.message });
          res.json({ success: true, message: 'Đã upload avatar', avatar_url: avatarUrl });
        }
      );
    }
  );
});

module.exports = router;
