const express = require('express');
const db = require('../db');

const router = express.Router();

// Middleware: yêu cầu đăng nhập
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }
  next();
}

// ============ GET /api/links - Lấy hết link của user ============
router.get('/', requireAuth, (req, res) => {
  db.all(
    'SELECT * FROM links WHERE user_id = ? ORDER BY order_index ASC',
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, links: rows });
    }
  );
});

// ============ POST /api/links - Thêm link mới ============
router.post('/', requireAuth, (req, res) => {
  let { title, url, icon } = req.body;

  // Trim
  title = title ? title.trim() : '';
  url = url ? url.trim() : '';

  if (!title || !url) {
    return res.status(400).json({ success: false, error: 'Thiếu title hoặc url' });
  }

  // Validate URL
  if (!/^https?:\/\//.test(url)) {
    return res.status(400).json({ success: false, error: 'URL phải bắt đầu bằng http:// hoặc https://' });
  }

  // Kiểm tra link trùng URL
  db.get(
    'SELECT id FROM links WHERE user_id = ? AND url = ?',
    [req.session.userId, url],
    (err, existing) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (existing) {
        return res.status(409).json({ success: false, error: 'Link này đã có trong danh sách' });
      }

      // Lấy order_index cao nhất + 1
      db.get(
        'SELECT MAX(order_index) as max_order FROM links WHERE user_id = ?',
        [req.session.userId],
        (err, row) => {
          if (err) return res.status(500).json({ success: false, error: err.message });
          const nextOrder = (row && row.max_order !== null) ? row.max_order + 1 : 0;

          db.run(
            'INSERT INTO links (user_id, title, url, icon, order_index) VALUES (?, ?, ?, ?, ?)',
            [req.session.userId, title, url, icon || 'link', nextOrder],
            function (err) {
              if (err) return res.status(500).json({ success: false, error: err.message });
              res.status(201).json({ 
                success: true, 
                message: 'Thêm link thành công', 
                linkId: this.lastID 
              });
            }
          );
        }
      );
    }
  );
});

// ============ PUT /api/links/:id - Sửa link ============
router.put('/:id', requireAuth, (req, res) => {
  let { title, url, icon } = req.body;
  const linkId = req.params.id;

  title = title ? title.trim() : '';
  url = url ? url.trim() : '';

  if (!title || !url) {
    return res.status(400).json({ success: false, error: 'Thiếu title hoặc url' });
  }

  if (!/^https?:\/\//.test(url)) {
    return res.status(400).json({ success: false, error: 'URL phải bắt đầu bằng http:// hoặc https://' });
  }

  // Chỉ sửa link của mình
  db.run(
    'UPDATE links SET title = ?, url = ?, icon = ? WHERE id = ? AND user_id = ?',
    [title, url, icon || 'link', linkId, req.session.userId],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy link' });
      }
      res.json({ success: true, message: 'Đã cập nhật' });
    }
  );
});

// ============ DELETE /api/links/:id - Xóa link ============
router.delete('/:id', requireAuth, (req, res) => {
  db.run(
    'DELETE FROM links WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.userId],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy link' });
      }
      res.json({ success: true, message: 'Đã xóa' });
    }
  );
});

// ============ PUT /api/links/reorder - Sắp xếp lại link ============
router.put('/reorder', requireAuth, (req, res) => {
  const { order } = req.body;

  if (!Array.isArray(order)) {
    return res.status(400).json({ success: false, error: 'order phải là mảng' });
  }

  if (order.length === 0) {
    return res.json({ success: true, message: 'Không có gì để sắp xếp' });
  }

  let completed = 0;
  let hasError = false;

  order.forEach((item) => {
    db.run(
      'UPDATE links SET order_index = ? WHERE id = ? AND user_id = ?',
      [item.order, item.id, req.session.userId],
      (err) => {
        if (err && !hasError) {
          hasError = true;
          return res.status(500).json({ success: false, error: err.message });
        }
        completed++;
        if (completed === order.length && !hasError) {
          res.json({ success: true, message: 'Đã sắp xếp lại' });
        }
      }
    );
  });
});

module.exports = router;
