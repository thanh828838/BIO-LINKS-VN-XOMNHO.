const express = require('express');
const db = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }
  next();
}

// GET /api/stats - Tổng quan stats của user
router.get('/', requireAuth, (req, res) => {
  db.get(
    `SELECT 
      COUNT(*) as total_links,
      COALESCE(SUM(click_count), 0) as total_clicks
     FROM links 
     WHERE user_id = ?`,
    [req.session.userId],
    (err, row) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({
        success: true,
        stats: {
          totalLinks: row.total_links || 0,
          totalClicks: row.total_clicks || 0
        }
      });
    }
  );
});

// GET /api/stats/links - Stats từng link
router.get('/links', requireAuth, (req, res) => {
  db.all(
    `SELECT id, title, url, click_count 
     FROM links 
     WHERE user_id = ? 
     ORDER BY click_count DESC`,
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, links: rows });
    }
  );
});

module.exports = router;
