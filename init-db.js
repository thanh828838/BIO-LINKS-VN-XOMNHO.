const fs = require('fs');
const path = require('path');
const db = require('./src/db');

const schema = fs.readFileSync(path.join(__dirname, 'src/schema.sql'), 'utf8');

db.exec(schema, (err) => {
  if (err) {
    console.error('Lỗi tạo bảng:', err.message);
    process.exit(1);
  }
  console.log('Tạo bảng thành công!');

  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) console.error(err);
    else console.log('Các bảng hiện có:', rows.map(r => r.name).join(', '));
    db.close();
  });
});
