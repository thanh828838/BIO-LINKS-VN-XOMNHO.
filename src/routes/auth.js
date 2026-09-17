const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

// ============ ĐĂNG KÝ ============
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'Thiếu username, email hoặc password' });
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ success: false, error: 'Username phải từ 3-20 ký tự' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password phải từ 6 ký tự trở lên' });
  }

  db.get(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email],
    async (err, row) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (row) return res.status(409).json({ success: false, error: 'Username hoặc email đã tồn tại' });

      try {
        const passwordHash = await bcrypt.hash(password, 10);
        db.run(
          'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
          [username, email, passwordHash],
          function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.status(201).json({ success: true, message: 'Đăng ký thành công', userId: this.lastID });
          }
        );
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );
});

// ============ ĐĂNG NHẬP ============
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Thiếu username hoặc password' });
  }

  db.get(
    'SELECT id, username, email, password_hash FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!user) return res.status(401).json({ success: false, error: 'Sai username hoặc password' });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ success: false, error: 'Sai username hoặc password' });

      req.session.userId = user.id;
      req.session.username = user.username;

      res.json({
        success: true,
        message: 'Đăng nhập thành công',
        user: { id: user.id, username: user.username, email: user.email }
      });
    }
  );
});

// ============ ĐĂNG XUẤT ============
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Đã đăng xuất' });
  });
});

// ============ LẤY INFO USER ĐANG LOGIN ============
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }

  db.get(
    'SELECT id, username, email, created_at FROM users WHERE id = ?',
    [req.session.userId],
    (err, user) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!user) return res.status(404).json({ success: false, error: 'User không tồn tại' });
      res.json({ success: true, user });
    }
  );
});

module.exports = router;
