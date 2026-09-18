require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const db = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ MIDDLEWARE ============
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));

// ============ SESSION ============
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24  // 24 giờ
  }
}));

// ============ VIEW ENGINE ============
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// ============ ROUTES ============
const authRoutes = require('./src/routes/auth');
app.use('/api', authRoutes);

const linkRoutes = require('./src/routes/links');
app.use('/api/links', linkRoutes);

const profileRoutes = require('./src/routes/profile');
app.use('/api/profile', profileRoutes);

// ============ PAGE ROUTES ============
app.get('/', (req, res) => {
  res.send('<h1>Xóm Nhỏ - Bio Link</h1><p>Server đang chạy!</p>');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Route profile public - PHẢI ĐẶT CUỐI CÙNG
app.get('/:username', (req, res) => {
  const { username } = req.params;

  db.get(
    'SELECT id, username, created_at FROM users WHERE username = ?',
    [username],
    (err, user) => {
      if (err || !user) {
        return res.status(404).send('<h1>Không tìm thấy user này</h1><a href="/">Về trang chủ</a>');
      }

      db.all(
        'SELECT id, title, url, icon, order_index FROM links WHERE user_id = ? ORDER BY order_index ASC',
        [user.id],
        (err, links) => {
          if (err) return res.status(500).send('Lỗi server');
          res.render('profile', { profile: { username: user.username, links: links } });
        }
      );
    }
  );
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});
