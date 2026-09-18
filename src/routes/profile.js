const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/profile/:username - Lấy profile public
router.get('/:username', (req, res) => {
  const { username } = req.params;

  db.get(
    'SELECT id, username, created_at FROM users WHERE username = ?',
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Không tìm thấy user này' 
        });
      }

      db.all(
        'SELECT id, title, url, icon, order_index, click_count FROM links WHERE user_id = ? ORDER BY order_index ASC',
        [user.id],
        (err, links) => {
          if (err) {
            return res.status(500).json({ success: false, error: err.message });
          }

          res.json({
            success: true,
            profile: {
              username: user.username,
              created_at: user.created_at,
              links: links
            }
          });
        }
      );
    }
  );
});

// POST /api/profile/click/:linkId - Tăng click count
router.post('/click/:linkId', (req, res) => {
  const { linkId } = req.params;

  db.run(
    'UPDATE links SET click_count = click_count + 1 WHERE id = ?',
    [linkId],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Link không tồn tại' });
      }
      res.json({ success: true, message: 'Đã ghi nhận click' });
    }
  );
});

module.exports = router;
