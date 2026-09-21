Xn BioLinks

> Nền tảng bio-link full-stack cho người Việt — dự án cá nhân của mình, hoàn thành trong 4 ngày (tháng 9/2026).

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🎯 Về dự án

Mình 16 tuổi, học Quản trị mạng máy tính. Đây là dự án cá nhân đầu tiên mình làm từ A-Z — từ setup VPS, code backend, deploy production, đến thiết kế database.

**Mục tiêu:** Tạo nền tảng bio-link cho người Việt, có tính năng mà Linktree/zyo.lol không có (icon Zalo/Momo/Shopee, analytics chi tiết, hỗ trợ tiếng Việt).

**Kết quả:** Web chạy production tại `xomnho.meorap.site` với 10+ tính năng, deploy hoàn toàn trên điện thoại Android (Termux).

## 🛠️ Tech Stack

| Layer | Công nghệ |
|---|---|
| **Frontend** | HTML5 + CSS3 + JavaScript thuần (không framework) |
| **Backend** | Node.js 20 + Express |
| **Database** | PostgreSQL 16 |
| **Server** | VPS iNET (Ubuntu 24.04) |
| **Web Server** | Nginx (reverse proxy) |
| **Process Manager** | PM2 (auto-restart) |
| **SSL** | Let's Encrypt |
| **Deploy** | Git + GitHub + SSH |

## ✨ Tính năng

### Core
- Bio-link cá nhân (`/username`)
- Quản lý link (thêm/sửa/xóa/sắp xếp)
- Bật/tắt link
- Upload avatar
- Tùy chỉnh theme, màu, font, kiểu button
- 6 background preset

### Nâng cao
- **Short link** — rút gọn URL (`/s/:slug`)
- **QR code** — tạo QR cho bio-link hoặc URL bất kỳ
- **Analytics** — view, click, device, referrer, top link
- **Support form** — báo lỗi, gửi ticket
- **Legal pages** — terms, privacy, cookies

### Bảo mật
- Password hash bằng bcrypt (12 rounds)
- Session lưu PostgreSQL (httpOnly cookie)
- Rate limiting chống spam
- SQL parameterized (chống injection)
- Legal consent bắt buộc khi đăng ký

## 🏗️ Kiến trúc

```

Browser (HTML/CSS/JS)
↓ fetch()
Backend API (Node.js + Express)
↓ pg
PostgreSQL

```

Frontend không kết nối trực tiếp database. Backend là lớp duy nhất truy cập DB. Mọi secret nằm ở `.env` (không commit).

## 📁 Cấu trúc

```

bio-link-vn2/
├── frontend/              # HTML/CSS/JS thuần
│   ├── index.html         # Trang chủ
│   ├── dashboard.html     # Quản lý bio-link
│   ├── shortlinks.html    # Short link
│   ├── qr.html            # QR code
│   ├── analytics.html     # Analytics
│   ├── settings.html      # Cài đặt
│   └── ...
├── backend/               # Express API
│   ├── server.js          # Entry point
│   ├── routes/            # API routes
│   ├── controllers/       # Business logic
│   ├── models/            # Database queries
│   ├── middleware/        # Auth, error handling
│   └── utils/             # Helpers, validation
├── database/
│   └── schema.sql         # PostgreSQL schema
└── README.md

```

## 🚀 Cài đặt local

**Yêu cầu:** Node.js 18+, PostgreSQL 13+

```bash
# Clone
git clone git@github.com:thanh828838/bio-link-vn2.git
cd bio-link-vn2

# Cài dependencies
cd backend
npm install

# Setup environment
cp .env.example .env
# Sửa .env: DATABASE_URL, SESSION_SECRET

# Tạo database
psql -U postgres -c "CREATE DATABASE xn;"
psql -U postgres -d xn -f ../database/schema.sql

# Chạy
npm start
```

Truy cập http://localhost:3000
