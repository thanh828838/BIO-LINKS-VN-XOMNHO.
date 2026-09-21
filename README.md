# Xn Bio Links — Nền tảng bio-link Full-Stack

Xn giúp người dùng tạo một trang bio-link cá nhân: gom website, mạng xã hội,
YouTube, TikTok, Discord... vào **một đường dẫn duy nhất** — kèm short link,
mã QR, analytics và báo lỗi hỗ trợ.

```text
Browser
   ↓
Frontend HTML / CSS / JavaScript
   ↓ fetch()
Backend REST API (Node.js + Express)
   ↓
PostgreSQL
```

Frontend **không** kết nối trực tiếp database. Backend là lớp duy nhất được
phép truy cập database. Mọi secret nằm ở backend và `.env`.

---

## Tính năng

- **Bio-link** — trang cá nhân tại `/user/:username`: avatar, bio, social icons,
  link cards với hiệu ứng stagger, 6 theme nền, 4 kiểu nút, 4 phông chữ, màu nhấn
- **Short link** — rút gọn đường dẫn (`/s/:slug` redirect 302) + đếm lượt nhấp
- **QR code** — tạo/tải mã QR cho bio-link, URL bất kỳ hoặc short link (PNG, server-side)
- **Analytics** — lượt xem, khách duy nhất (cookie ẩn danh), lượt nhấp, liên kết
  nổi bật, nguồn truy cập, loại thiết bị, lượt nhấp gần đây
- **Tài khoản** — đăng ký/đăng nhập session httpOnly, đổi mật khẩu, đăng xuất
  mọi thiết bị, xóa tài khoản, xuất toàn bộ dữ liệu (JSON)
- **Báo lỗi** — form gửi báo cáo lưu vào database (cả khách vãng lai)
- **Pháp lý** — bắt buộc đồng ý Điều khoản & Chính sách riêng tư khi đăng ký
  (validate cả frontend lẫn backend, lưu phiên bản + thời điểm đồng ý);
  các trang `/terms`, `/privacy`, `/cookies`, `/legal`

## Cấu trúc project

```text
Xn-BioLinks/
├── frontend/
│   ├── index.html          # Trang chủ
│   ├── login.html          # Đăng nhập
│   ├── register.html       # Đăng ký (legal consent bắt buộc)
│   ├── dashboard.html      # Bio-link manager (trang trong app)
│   ├── shortlinks.html     # Short link
│   ├── qr.html             # QR code
│   ├── analytics.html      # Analytics
│   ├── settings.html       # Cài đặt (7 mục)
│   ├── profile.html        # Trang công khai /user/:username
│   ├── support.html        # Hỗ trợ + form báo lỗi
│   ├── team.html           # Đội ngũ
│   ├── terms/privacy/cookies/legal.html
│   ├── 404.html
│   ├── css/ (style.css, dashboard.css)
│   ├── js/  (main.js dùng chung, app.js cho trang trong app)
│   └── assets/
│
├── backend/
│   ├── server.js           # HTTP server + route sạch + redirect /s/:slug
│   ├── routes/             # auth, links, profile, shortlinks, analytics, support
│   ├── controllers/
│   ├── middleware/         # auth (session), error (tập trung)
│   ├── models/             # user, profile, link, social, shortlink, analytics
│   ├── config/database.js
│   └── utils/validate.js
│
├── database/schema.sql
├── .env.example
├── .gitignore
└── README.md
```

## Cài đặt & chạy

### 1. Cài Node.js 18+ và PostgreSQL

### 2. Cài dependencies

```bash
cd backend
npm install
```

### 3. Tạo database

```sql
CREATE DATABASE xnbiolinks;
```

### 4. Import schema

```bash
psql -U postgres -d xnbiolinks -f database/schema.sql
```

### 5. Tạo `.env`

Sao chép `.env.example` thành `backend/.env`:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://user:password@localhost:5432/xnbiolinks
SESSION_SECRET=<chuỗi ngẫu nhiên dài ít nhất 32 ký tự>
```

### 6. Chạy

```bash
cd backend
npm start        # hoặc npm run dev
```

Mở `http://localhost:3000`. Database ban đầu **trống** — không có tài khoản demo.

### 7. Deploy

- `NODE_ENV=production` (cookie tự Secure), reverse proxy miền
  `xomnho.meorap.site` về cổng `PORT`, chạy nền bằng pm2/systemd.

---

## REST API

### Tài khoản & phiên
| Method | Đường dẫn | Mô tả |
|--------|-----------|-------|
| POST | `/api/register` | Đăng ký — **bắt buộc `legalAccepted: true`**, thiếu → 400 |
| POST | `/api/login` | Đăng nhập (username + password) |
| POST | `/api/logout` | Hủy session hiện tại |
| GET | `/api/me` | Trạng thái đăng nhập |
| POST | `/api/password` | Đổi mật khẩu 🔒 |
| POST | `/api/sessions/revoke-all` | Đăng xuất mọi thiết bị 🔒 |
| POST | `/api/account/delete` | Xóa tài khoản (cần mật khẩu) 🔒 |
| GET | `/api/export` | Tải toàn bộ dữ liệu (JSON) 🔒 |

### Bio-link
| Method | Đường dẫn | Mô tả |
|--------|-----------|-------|
| GET / POST | `/api/links` | Danh sách / thêm liên kết 🔒 |
| PUT / DELETE | `/api/links/:id` | Sửa / xóa liên kết 🔒 |
| PUT | `/api/links/order` | Lưu thứ tự `{ order: [id…] }` 🔒 |
| GET / PUT | `/api/profile` | Hồ sơ + socials + thống kê 🔒 |
| GET / PUT | `/api/preferences` | Tuỳ chọn thông báo 🔒 |
| GET | `/api/u/:username` | Trang công khai (tự ghi lượt xem) |
| POST | `/api/u/:username/clicks` | Đếm lượt nhấp `{ linkId }` |

### Công cụ
| Method | Đường dẫn | Mô tả |
|--------|-----------|-------|
| GET / POST | `/api/shortlinks` | Danh sách / tạo short link 🔒 |
| PUT / DELETE | `/api/shortlinks/:id` | Sửa / xóa 🔒 |
| GET | `/s/:slug` | Redirect 302 tới đường dẫn gốc + đếm nhấp |
| GET | `/api/qr?data=...&size=512` | Mã QR (PNG) 🔒 |
| GET | `/api/analytics` | Tổng hợp analytics 🔒 |
| POST | `/api/bugs` | Gửi báo lỗi (công khai) |

🔒 = yêu cầu đăng nhập. Mọi truy vấn dữ liệu lọc theo `user_id`.

## Bảo mật

- bcrypt cost 12, parameterized queries, session cookie httpOnly
- Legal consent validate backend (400 nếu thiếu) + lưu
  `terms_accepted / privacy_accepted / legal_accepted_at / legal_version`
- Input validate tập trung ở cả client và server; URL chỉ nhận http(s)/mailto

## Motion system

Motion tokens thống nhất: `--motion-fast 150ms / normal 250ms / medium 350ms /
slow 500ms`, easing `--ease-out cubic-bezier(.16,1,.3,1)` và
`--ease-smooth cubic-bezier(.2,.8,.2,1)`. Toàn bộ animation dùng
transform/opacity; hỗ trợ `prefers-reduced-motion` (tắt hiệu ứng trang trí).
