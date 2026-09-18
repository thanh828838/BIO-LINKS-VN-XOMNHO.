require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

const authRoutes = require('./src/routes/auth');
const linkRoutes = require('./src/routes/links');
const profileRoutes = require('./src/routes/profile');
app.use('/api/profile', profileRoutes);
app.use('/api/links', linkRoutes);
app.use('/api', authRoutes);

app.get('/', (req, res) => {
  res.send('<h1>Xóm Nhỏ - Bio Link</h1><p>Server đang chạy!</p>');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});
