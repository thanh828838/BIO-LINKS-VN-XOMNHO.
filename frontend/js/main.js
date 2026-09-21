/* ==========================================================================
   Xn — main.js (Frontend dùng chung)
   Frontend chỉ giao tiếp với Backend qua REST API (fetch + cookie httpOnly).
   localStorage chỉ giữ: lựa chọn sáng/tối (xn.theme).

   File này expose window.Xn { api, icon, toast, Modal, ... } để js/app.js
   (các trang trong app) dùng lại.

   Sections
     1  Helpers
     2  API client
     3  Icon set
     4  Theme
     5  Validation
     6  Toasts, modals, confirm
     7  Profile canvas renderer (public /user)
     8  Shared chrome + footer
     9  Page: home
    10  Page: login / register
    11  Page: public profile (/user/:username)
    12  Expose window.Xn + boot
   ========================================================================== */

(function () {
    'use strict';

    /* ======================================================================
       1. Helpers
       ====================================================================== */

    var PUBLIC_HOST = 'xomnho.meorap.site';
    var RESERVED = ['login', 'register', 'dashboard', 'settings', 'admin', 'api', 'about', 'help',
        'xn', 'support', 'terms', 'privacy', 'cookies', 'legal', 'user', 's', 'short-links',
        'qr', 'analytics', 'team', '404'];

    var DEFAULT_APPEARANCE = {
        background: 'mist',
        buttonStyle: 'fill',
        font: 'sans',
        accent: '#0EA5E9'
    };

    var DEFAULT_AVATAR = '/assets/avatar-default.png';

    var SOCIAL_FIELDS = [
        { key: 'instagram', label: 'Instagram', prefix: 'instagram.com/' },
        { key: 'tiktok', label: 'TikTok', prefix: 'tiktok.com/@' },
        { key: 'youtube', label: 'YouTube', prefix: 'youtube.com/@' },
        { key: 'x', label: 'X', prefix: 'x.com/' },
        { key: 'facebook', label: 'Facebook', prefix: 'facebook.com/' },
        { key: 'discord', label: 'Discord', prefix: 'discord.gg/' },
        { key: 'github', label: 'GitHub', prefix: 'github.com/' }
    ];

    var LINK_ICONS = ['link', 'globe', 'github', 'instagram', 'youtube', 'tiktok', 'x',
        'facebook', 'discord', 'twitch', 'spotify', 'soundcloud', 'mail', 'music', 'camera',
        'store', 'book', 'calendar', 'coffee', 'sparkle', 'pin'];

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function normalizeUrl(value) {
        var v = String(value || '').trim();
        if (!v) return '';
        if (/^(https?:)?\/\//i.test(v)) return v.replace(/^\/\//, 'https://');
        if (/^mailto:/i.test(v)) return v;
        return 'https://' + v;
    }

    function shortUrl(url) {
        return String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
    }

    function readableOn(hex) {
        var c = String(hex || '').replace('#', '');
        if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        if (c.length !== 6) return '#ffffff';
        var r = parseInt(c.slice(0, 2), 16) / 255,
            g = parseInt(c.slice(2, 4), 16) / 255,
            b = parseInt(c.slice(4, 6), 16) / 255;
        var lin = [r, g, b].map(function (v) {
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        var L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
        return L > 0.55 ? '#14172A' : '#ffffff';
    }

    function formatCount(n) {
        n = Number(n) || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
        return String(n);
    }

    function countUp(el, target) {
        if (!el) return;
        var from = Number(el.dataset.value || 0);
        target = Number(target) || 0;
        el.dataset.value = String(target);
        if (from === target) { el.textContent = formatCount(target); return; }
        var start = performance.now();
        var DURATION = 600;
        function frame(now) {
            var t = Math.min((now - start) / DURATION, 1);
            var eased = 1 - Math.pow(1 - t, 3);
            el.textContent = formatCount(Math.round(from + (target - from) * eased));
            if (t < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    /* ======================================================================
       2. API client
       ====================================================================== */

    async function apiRequest(url, options) {
        options = options || {};
        var config = {
            method: options.method || 'GET',
            credentials: 'include',
            headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {})
        };
        if (options.body !== undefined) config.body = JSON.stringify(options.body);

        var response;
        try {
            response = await fetch(url, config);
        } catch (networkErr) {
            throw new Error('Không thể kết nối tới máy chủ. Kiểm tra mạng và thử lại.');
        }

        var data = null;
        try { data = await response.json(); } catch (e) { /* body rỗng */ }

        if (!response.ok) {
            var err = new Error((data && data.message) || 'Đã xảy ra lỗi. Vui lòng thử lại.');
            err.status = response.status;
            err.errors = (data && data.errors) || null;
            throw err;
        }
        return data;
    }

    var api = {
        me: function () { return apiRequest('/api/me'); },
        register: function (body) { return apiRequest('/api/register', { method: 'POST', body: body }); },
        login: function (body) { return apiRequest('/api/login', { method: 'POST', body: body }); },
        logout: function () { return apiRequest('/api/logout', { method: 'POST' }); },
        changePassword: function (body) { return apiRequest('/api/password', { method: 'POST', body: body }); },
        deleteAccount: function (body) { return apiRequest('/api/account/delete', { method: 'POST', body: body }); },
        revokeAll: function () { return apiRequest('/api/sessions/revoke-all', { method: 'POST' }); },

        getProfile: function () { return apiRequest('/api/profile'); },
        saveProfile: function (body) { return apiRequest('/api/profile', { method: 'PUT', body: body }); },
        getPublic: function (username) { return apiRequest('/api/u/' + encodeURIComponent(username)); },
        trackClick: function (username, linkId) {
            return apiRequest('/api/u/' + encodeURIComponent(username) + '/clicks',
                { method: 'POST', body: { linkId: linkId } });
        },

        getPreferences: function () { return apiRequest('/api/preferences'); },
        savePreferences: function (body) { return apiRequest('/api/preferences', { method: 'PUT', body: body }); },

        getLinks: function () { return apiRequest('/api/links'); },
        addLink: function (body) { return apiRequest('/api/links', { method: 'POST', body: body }); },
        updateLink: function (id, body) { return apiRequest('/api/links/' + id, { method: 'PUT', body: body }); },
        deleteLink: function (id) { return apiRequest('/api/links/' + id, { method: 'DELETE' }); },
        reorderLinks: function (order) { return apiRequest('/api/links/order', { method: 'PUT', body: { order: order } }); },

        getShorts: function () { return apiRequest('/api/shortlinks'); },
        addShort: function (body) { return apiRequest('/api/shortlinks', { method: 'POST', body: body }); },
        updateShort: function (id, body) { return apiRequest('/api/shortlinks/' + id, { method: 'PUT', body: body }); },
        deleteShort: function (id) { return apiRequest('/api/shortlinks/' + id, { method: 'DELETE' }); },

        getAnalytics: function () { return apiRequest('/api/analytics'); },

        reportBug: function (body) { return apiRequest('/api/bugs', { method: 'POST', body: body }); }
    };

    /* ======================================================================
       3. Icon set — SVG đồng bộ toàn site
       ====================================================================== */

    var ICONS = {
        link: { s: '<path d="M10.5 13.5a4.5 4.5 0 0 0 6.6.4l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.6-.4l-2.6 2.6a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5"/>' },
        scissors: { s: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>' },
        qr: { s: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M13.5 13.5h3.2v3.2h-3.2zM16.8 16.8h3.7v3.7h-3.7M20.5 13.5v1.8"/>' },
        globe: { s: '<circle cx="12" cy="12" r="9"/><path d="M3.2 9h17.6M3.2 15h17.6"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>' },
        plus: { s: '<path d="M12 5v14M5 12h14"/>' },
        check: { s: '<path d="M4 12.5 9 17.5 20 6.5"/>' },
        checkCircle: { s: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>' },
        alert: { s: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.2v.3"/>' },
        copy: { s: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 6.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.5"/>' },
        share: { s: '<path d="M12 3.5v11"/><path d="m8 7.2 4-3.7 4 3.7"/><path d="M5 13v5.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V13"/>' },
        trash: { s: '<path d="M4.5 6.5h15"/><path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5"/><path d="M6.5 6.5 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12.5"/>' },
        pencil: { s: '<path d="M4 20.5h4L20 8.5a2.6 2.6 0 0 0-3.7-3.7L4.5 16.5Z"/><path d="m15.2 6 3.5 3.5"/>' },
        grip: { s: '<circle cx="9.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9.5" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.5" cy="18" r="1.3" fill="currentColor" stroke="none"/>' },
        chevron: { s: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>' },
        external: { s: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M18 14v4.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5"/>' },
        menu: { s: '<path d="M4 7h16M4 12h16M4 17h16"/>' },
        close: { s: '<path d="M6 6 18 18M18 6 6 18"/>' },
        eye: { s: '<path d="M2.6 12S6 5.9 12 5.9 21.4 12 21.4 12 18 18.1 12 18.1 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="3"/>' },
        eyeOff: { s: '<path d="M4 4.5 20 20.5"/><path d="M9.6 6.4A9.6 9.6 0 0 1 12 6.1c6 0 9.4 6 9.4 6a17 17 0 0 1-3.2 3.9"/><path d="M6.4 8.2A16.6 16.6 0 0 0 2.6 12s3.4 6.1 9.4 6.1a9.7 9.7 0 0 0 3.2-.5"/><path d="M10.2 10.3a2.6 2.6 0 0 0 3.5 3.6"/>' },
        sun: { s: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M4.4 4.4l1.4 1.4M18.2 18.2l1.4 1.4M2.8 12h2M19.2 12h2M4.4 19.6l1.4-1.4M18.2 5.8l1.4-1.4"/>' },
        moon: { s: '<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z"/>' },
        home: { s: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V19a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V9.5"/>' },
        user: { s: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c.9-3.4 3.8-5.3 7.2-5.3s6.3 1.9 7.2 5.3"/>' },
        sliders: { s: '<path d="M5 7h9M18 7h1M5 12h3M12 12h7M5 17h8M17 17h2"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="15" cy="17" r="2"/>' },
        logout: { s: '<path d="M14 4.5H7A2 2 0 0 0 5 6.5v11a2 2 0 0 0 2 2h7"/><path d="M17 8.5 20.5 12 17 15.5"/><path d="M20 12h-9"/>' },
        chart: { s: '<path d="M4 20V10M10 20V5M16 20v-7M22 20H2"/>' },
        eyeStat: { s: '<path d="M2.6 12S6 5.9 12 5.9 21.4 12 21.4 12 18 18.1 12 18.1 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.6"/>' },
        cursor: { s: '<path d="m6 4 12 6.6-5.2 1.6L11 18Z"/>' },
        layers: { s: '<path d="m12 3.5 8.5 4.3L12 12 3.5 7.8Z"/><path d="m4 12.2 8 4 8-4"/><path d="m4 16.4 8 4 8-4"/>' },
        upload: { s: '<path d="M12 16V5"/><path d="m8 8.6 4-3.6 4 3.6"/><path d="M4.5 15v3.5A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5V15"/>' },
        download: { s: '<path d="M12 4v11"/><path d="m8 11.4 4 3.6 4-3.6"/><path d="M4.5 16.5V17A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5v-.5"/>' },
        lock: { s: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>' },
        shield: { s: '<path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6Z"/><path d="m9 11.5 2.2 2.2L15.5 9.5"/>' },
        bell: { s: '<path d="M18 9a6 6 0 0 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z"/><path d="M13.7 19.5a2 2 0 0 1-3.4 0"/>' },
        mail: { s: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7.5 7 4.6a2 2 0 0 0 2 0l7-4.6"/>' },
        help: { s: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.5a2.8 2.8 0 0 1 5.4.9c0 1.8-2.7 2.2-2.7 3.6"/><path d="M12 17h.01"/>' },
        people: { s: '<circle cx="9" cy="8.5" r="3.4"/><path d="M2.8 19.5c.8-3 3.4-4.8 6.2-4.8s5.4 1.8 6.2 4.8"/><path d="M15.5 5.6a3.4 3.4 0 0 1 0 6"/><path d="M17.6 14.9c1.9.6 3.2 2.1 3.7 4.1"/>' },
        arrowLeft: { s: '<path d="M19 12H5"/><path d="m10.5 6.5-5.5 5.5 5.5 5.5"/>' },
        phone: { s: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>' },
        monitor: { s: '<rect x="3" y="4.5" width="18" height="12.5" rx="2"/><path d="M9 20.5h6M12 17v3.5"/>' },
        tablet: { s: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M10.5 17.5h3"/>' },
        bug: { s: '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M10 7a2 2 0 0 1 4 0"/><path d="M4.5 13h3.5M16 13h3.5M5.5 8l2.8 1.7M18.5 8l-2.8 1.7M5.5 18l2.8-1.7M18.5 18l-2.8-1.7"/>' },

        github: { s: '<path d="M9.2 19.1c-3.8 1.1-3.8-2.1-5.3-2.5m10.6 4.4v-3.1c0-.9-.3-1.4-.7-1.8 2.5-.3 5.1-1.2 5.1-5.5a4.3 4.3 0 0 0-1.2-3 4 4 0 0 0-.1-3s-1-.3-3.2 1.2a10.9 10.9 0 0 0-5.7 0C6.5 4.3 5.5 4.6 5.5 4.6a4 4 0 0 0-.1 3 4.3 4.3 0 0 0-1.2 3c0 4.3 2.6 5.2 5.1 5.5-.3.3-.6.8-.7 1.5V21"/>' },
        instagram: { s: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none"/>' },
        youtube: { s: '<rect x="2.5" y="5.2" width="19" height="13.6" rx="4.4"/><path d="m10.3 9.4 5.1 2.6-5.1 2.6Z"/>' },
        tiktok: { s: '<path d="M14.2 3.5v10.9a3.9 3.9 0 1 1-3.9-3.9c.3 0 .7 0 1 .1"/><path d="M14.2 3.5c.3 2.6 2.1 4.4 4.7 4.6"/>' },
        x: { s: '<path d="M4.5 4.5 19.5 19.5M19.5 4.5 4.5 19.5"/>' },
        facebook: { f: '<path d="M13.6 21v-7.6h2.6l.4-3h-3V8.5c0-.9.2-1.4 1.5-1.4h1.6V4.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.1H7.6v3h2.7V21Z"/>' },
        discord: { f: '<path d="M19.6 5.6A17.3 17.3 0 0 0 15.4 4.2c-.2.4-.4.8-.6 1.3a16 16 0 0 0-4.8 0c-.2-.5-.4-.9-.6-1.3A17.2 17.2 0 0 0 5.2 5.6C2.6 9.4 1.9 13.1 2.2 16.8a17.5 17.5 0 0 0 5.3 2.7c.4-.6.8-1.2 1.1-1.9-.6-.2-1.2-.5-1.8-.9l.4-.3a12.4 12.4 0 0 0 10.6 0l.4.3c-.6.4-1.2.7-1.8.9.3.7.7 1.3 1.1 1.9a17.4 17.4 0 0 0 5.3-2.7c.4-4.3-.7-8-3.2-11.2ZM8.7 14.5c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 2 1 1.9 2.1c0 1.2-.9 2.1-1.9 2.1Zm6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 2 1 1.9 2.1c0 1.2-.8 2.1-1.9 2.1Z"/>' },
        twitch: { s: '<path d="M4.5 4.5h15v9.2l-3.8 3.8h-3L9.8 21H7.4v-3.5H4.5Z"/><path d="M11 8.5v4M15 8.5v4"/>' },
        spotify: { s: '<circle cx="12" cy="12" r="8.8"/><path d="M7.5 14.6c2.9-.8 5.9-.5 8.3.9"/><path d="M6.9 11.4c3.4-1 7-.6 9.8 1.1"/><path d="M7.4 8.2c3.8-1 7.7-.5 10.5 1.3"/>' },
        soundcloud: { s: '<path d="M4 16.5v-4M7 16.5v-6.5M10 16.5V8M13 16.5V6.8"/><path d="M15.8 16.5h3.4a2.8 2.8 0 0 0 .2-5.6 4.8 4.8 0 0 0-3.6-3.6"/>' },
        music: { s: '<path d="M9 18V6.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>' },
        camera: { s: '<path d="M4 8.5h3l1.4-2.4h7.2L17 8.5h3a1.5 1.5 0 0 1 1.5 1.5v7.5A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5V10A1.5 1.5 0 0 1 4 8.5Z"/><circle cx="12" cy="13.3" r="3.3"/>' },
        store: { s: '<path d="M4.4 9.5h15.2l-1 10.1a1.5 1.5 0 0 1-1.5 1.4H6.9a1.5 1.5 0 0 1-1.5-1.4Z"/><path d="M8.6 9.5V7a3.4 3.4 0 0 1 6.8 0v2.5"/>' },
        book: { s: '<path d="M5 4.5h9.5A3.5 3.5 0 0 1 18 8v11.5H8.5A3.5 3.5 0 0 1 5 16Z"/><path d="M5 16.2a3.4 3.4 0 0 1 3.5-2.2H18"/>' },
        calendar: { s: '<rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8.5 3.5v3.6M15.5 3.5v3.6"/>' },
        coffee: { s: '<path d="M4 9h13v6.5a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 4 15.5Z"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3.5v2.2M12 3.5v2.2"/>' },
        sparkle: { s: '<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9Z"/><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>' },
        pin: { s: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.8"/>' }
    };

    /** Icon màu riêng cho các nền tảng xã hội (dùng ở preview home). */
    var SOCIAL_COLORS = {
        instagram: '#E1306C',
        youtube: '#FF0000',
        tiktok: '#111827',
        discord: '#5865F2',
        website: '#0EA5E9'
    };

    function icon(name, extraClass) {
        var it = ICONS[name] || ICONS.link;
        var cls = extraClass ? ' class="' + extraClass + '"' : '';
        if (it.f) {
            return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"' + cls + '>' + it.f + '</svg>';
        }
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + cls + '>' + it.s + '</svg>';
    }

    /* ======================================================================
       4. Theme — localStorage chỉ lưu lựa chọn sáng/tối
       ====================================================================== */

    function applyTheme(mode) {
        var resolved = mode;
        if (mode === 'system' || !mode) {
            resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', resolved);
        $$('[data-theme-toggle]').forEach(function (btn) {
            btn.innerHTML = icon(resolved === 'dark' ? 'sun' : 'moon');
            btn.setAttribute('aria-label', resolved === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
        });
    }

    function getThemePref() { return localStorage.getItem('xn.theme') || 'system'; }

    function setThemePref(mode) {
        localStorage.setItem('xn.theme', mode);
        applyTheme(mode);
    }

    /* ======================================================================
       5. Validation (client-side — server vẫn kiểm tra lại)
       ====================================================================== */

    function setFieldState(input, message) {
        var field = input.closest('.field') || input.parentElement;
        if (!field) return !message;
        var slot = $('.field-error', field);
        if (message) {
            field.classList.add('is-invalid');
            input.setAttribute('aria-invalid', 'true');
            if (slot) slot.textContent = message;
        } else {
            field.classList.remove('is-invalid');
            input.removeAttribute('aria-invalid');
            if (slot) slot.textContent = '';
        }
        return !message;
    }

    function liveField(input, check) {
        if (!input) return;
        on(input, 'blur', function () { setFieldState(input, check()); });
        on(input, 'input', function () {
            var field = input.closest('.field');
            if (field && field.classList.contains('is-invalid')) setFieldState(input, check());
        });
    }

    function checkUsername(value) {
        var v = String(value || '').trim().toLowerCase();
        if (!v) return 'Chọn một tên đăng nhập cho liên kết của bạn.';
        if (v.length < 3) return 'Tên đăng nhập cần ít nhất 3 ký tự.';
        if (v.length > 20) return 'Tên đăng nhập tối đa 20 ký tự.';
        if (!/^[a-z0-9_.]+$/.test(v)) return 'Chỉ dùng chữ thường, số, dấu chấm và gạch dưới.';
        if (RESERVED.indexOf(v) > -1) return 'Tên này đã được đặt trước, hãy chọn tên khác.';
        return '';
    }

    function checkEmail(value) {
        var v = String(value || '').trim();
        if (!v) return 'Nhập địa chỉ email của bạn.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Địa chỉ email không hợp lệ.';
        return '';
    }

    function checkPassword(value) {
        var v = String(value || '');
        if (!v) return 'Hãy chọn mật khẩu.';
        if (v.length < 8) return 'Dùng ít nhất 8 ký tự.';
        if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return 'Mật khẩu cần cả chữ cái và số.';
        return '';
    }

    /* ======================================================================
       6. Toasts, modals, confirm
       ====================================================================== */

    function toastRegion() {
        var region = $('.toast-region');
        if (!region) {
            region = document.createElement('div');
            region.className = 'toast-region';
            region.setAttribute('role', 'status');
            region.setAttribute('aria-live', 'polite');
            document.body.appendChild(region);
        }
        return region;
    }

    function toast(message, type) {
        var region = toastRegion();
        var el = document.createElement('div');
        el.className = 'toast toast--' + (type || 'success');
        el.innerHTML = icon(type === 'error' ? 'alert' : 'checkCircle') + '<span>' + escapeHtml(message) + '</span>';
        region.appendChild(el);
        setTimeout(function () {
            el.classList.add('is-leaving');
            setTimeout(function () { el.remove(); }, 220);
        }, 2800);
    }

    var Modal = {
        last: null,
        open: function (el) {
            if (!el) return;
            Modal.last = document.activeElement;
            el.classList.add('is-open');
            el.removeAttribute('aria-hidden');
            document.body.style.overflow = 'hidden';
            var focusable = $('[data-autofocus]', el) || $('input, button, textarea, select', el);
            if (focusable) setTimeout(function () { focusable.focus(); }, 60);
        },
        close: function (el) {
            if (!el) return;
            el.classList.remove('is-open');
            el.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            if (Modal.last && Modal.last.focus) Modal.last.focus();
        }
    };

    function initModals() {
        $$('.modal').forEach(function (modal) {
            modal.setAttribute('aria-hidden', 'true');
            on(modal, 'mousedown', function (e) {
                if (e.target === modal) Modal.close(modal);
            });
            $$('[data-close-modal]', modal).forEach(function (btn) {
                on(btn, 'click', function () { Modal.close(modal); });
            });
            on(modal, 'keydown', function (e) {
                if (e.key !== 'Tab') return;
                var items = $$('a[href], button:not([disabled]), input:not([type="hidden"]), textarea, select', modal)
                    .filter(function (el) { return el.offsetParent !== null; });
                if (!items.length) return;
                var first = items[0], last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            });
        });
        on(document, 'keydown', function (e) {
            if (e.key === 'Escape') {
                var open = $('.modal.is-open');
                if (open) Modal.close(open);
            }
        });
    }

    function confirmDialog(opts) {
        return new Promise(function (resolve) {
            var modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML =
                '<div class="modal-panel" role="dialog" aria-modal="true" aria-label="' + escapeHtml(opts.title) + '">' +
                '<div class="modal-head"><h2>' + escapeHtml(opts.title) + '</h2></div>' +
                '<div class="modal-body"><p class="muted">' + escapeHtml(opts.message) + '</p></div>' +
                '<div class="modal-foot">' +
                '<button class="btn btn--soft" data-no>Hủy</button>' +
                '<button class="btn ' + (opts.tone === 'danger' ? 'btn--danger' : 'btn--primary') + '" data-yes data-autofocus>' +
                escapeHtml(opts.confirmLabel || 'Xác nhận') + '</button>' +
                '</div></div>';
            document.body.appendChild(modal);

            function done(value) {
                Modal.close(modal);
                setTimeout(function () { modal.remove(); }, 200);
                resolve(value);
            }
            on($('[data-yes]', modal), 'click', function () { done(true); });
            on($('[data-no]', modal), 'click', function () { done(false); });
            on(modal, 'mousedown', function (e) { if (e.target === modal) done(false); });
            on(modal, 'keydown', function (e) { if (e.key === 'Escape') done(false); });
            requestAnimationFrame(function () { Modal.open(modal); });
        });
    }

    /* ======================================================================
       7. Profile canvas renderer — trang công khai /user/:username
       ====================================================================== */

    function appearanceOf(profile) {
        return {
            background: profile.background,
            buttonStyle: profile.buttonStyle,
            font: profile.font,
            accent: profile.accentColor
        };
    }

    function socialsToMap(socialList) {
        var map = {};
        (socialList || []).forEach(function (s) {
            var value = s.url;
            SOCIAL_FIELDS.forEach(function (f) {
                if (value.indexOf('https://' + f.prefix) === 0) value = value.replace('https://' + f.prefix, '');
            });
            map[s.platform] = String(value).replace(/^@/, '');
        });
        return map;
    }

    function renderCanvas(el, model, options) {
        if (!el) return;
        var opts = options || {};
        var ap = Object.assign({}, DEFAULT_APPEARANCE, model.appearance || {});
        var links = (model.links || []).filter(function (l) { return l.enabled !== false; });

        el.classList.add('xn-canvas');
        el.dataset.bg = ap.background;
        el.dataset.buttons = ap.buttonStyle;
        el.dataset.font = ap.font;
        el.style.setProperty('--c-accent', ap.accent);
        el.style.setProperty('--c-on-accent', readableOn(ap.accent));

        var displayName = model.displayName || model.username || 'Tên của bạn';
        var handle = model.username || 'username';
        var tag = opts.interactive ? 'a' : 'div';

        var html = '<div class="xn-profile">';
        html += '<img class="xn-avatar reveal" style="--i:0" src="' + escapeHtml(model.avatar || DEFAULT_AVATAR) +
            '" alt="' + escapeHtml(displayName) + '" width="92" height="92">';
        html += '<h1 class="xn-name reveal" style="--i:2">' + escapeHtml(displayName) + '</h1>';
        html += '<p class="xn-handle reveal" style="--i:3">@' + escapeHtml(handle) + '</p>';
        if (model.bio) html += '<p class="xn-bio reveal" style="--i:4">' + escapeHtml(model.bio) + '</p>';

        // Social icons nằm TRÊN link cards (theo cấu trúc /user)
        var socials = model.socials || {};
        var socialKeys = SOCIAL_FIELDS.filter(function (s) { return socials[s.key]; });
        if (socialKeys.length) {
            html += '<div class="xn-socials reveal" style="--i:5">';
            socialKeys.forEach(function (s, si) {
                var value = socials[s.key];
                var href = /^https?:\/\//i.test(value) ? value : 'https://' + s.prefix + String(value).replace(/^@/, '');
                var sTag = opts.interactive ? 'a' : 'div';
                var sAttrs = opts.interactive ? ' href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer" aria-label="' + escapeHtml(s.label) + '"' : '';
                html += '<' + sTag + ' class="xn-social" style="--s:' + si + '"' + sAttrs + '>' + icon(s.key) + '</' + sTag + '>';
            });
            html += '</div>';
        }

        if (links.length) {
            html += '<div class="xn-links">';
            links.forEach(function (link, i) {
                var attrs = opts.interactive
                    ? ' href="' + escapeHtml(normalizeUrl(link.url)) + '" target="_blank" rel="noopener noreferrer"' +
                      ' data-link-id="' + escapeHtml(link.id) + '"'
                    : '';
                html += '<' + tag + ' class="xn-link reveal" style="--i:' + (7 + i) + '"' + attrs + '>' +
                    icon(link.icon || 'link') +
                    '<span>' + escapeHtml(link.title) + '</span>' +
                    icon('chevron', 'chev') +
                    '</' + tag + '>';
            });
            html += '</div>';
        } else if (opts.showEmpty) {
            html += '<div class="xn-empty reveal" style="--i:7">Liên kết của bạn sẽ xuất hiện tại đây. Hãy thêm liên kết đầu tiên trong Bio-link.</div>';
        }

        var mark = 'Tạo bằng <b>Xn</b>';
        html += opts.interactive
            ? '<a class="xn-footmark reveal" style="--i:' + (9 + links.length) + '" href="/">' + mark + '</a>'
            : '<p class="xn-footmark reveal" style="--i:' + (9 + links.length) + '">' + mark + '</p>';
        html += '</div>';

        el.innerHTML = html;
    }

    function renderSkeleton(el) {
        if (!el) return;
        el.classList.add('xn-canvas');
        el.innerHTML =
            '<div class="xn-profile">' +
            '<div class="skel skel--avatar"></div>' +
            '<div class="skel skel--name"></div>' +
            '<div class="skel skel--handle"></div>' +
            '<div class="skel skel--link"></div>' +
            '<div class="skel skel--link"></div>' +
            '<div class="skel skel--link skel--short"></div>' +
            '</div>';
    }

    /* ======================================================================
       8. Shared chrome + footer
       ====================================================================== */

    function profileUrl(username) {
        return 'https://' + PUBLIC_HOST + '/user/' + encodeURIComponent(username);
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); resolve(); } catch (err) { reject(err); }
            ta.remove();
        });
    }

    function shareProfile(username) {
        var url = profileUrl(username);
        if (navigator.share) {
            navigator.share({ title: '@' + username + ' trên Xn', url: url }).catch(function () { });
            return;
        }
        copyText(url).then(function () {
            toast('Đã sao chép liên kết. Dán vào bất cứ đâu.');
        }).catch(function () {
            toast('Không thể sao chép. Hãy chọn URL thủ công.', 'error');
        });
    }

    /** Footer render một lần cho mọi trang public. */
    function renderFooter() {
        var el = $('[data-footer]');
        if (!el) return;
        el.className = 'site-footer';
        el.innerHTML =
            '<div class="container">' +
            '<div class="footer-grid">' +
            '<div class="footer-brand">' +
            '<a class="brand" href="/" aria-label="Trang chủ Xn">' +
            '<span class="brand-mark" aria-hidden="true">' + icon('link') + '</span><span>Xn</span></a>' +
            '<p>Đưa tất cả liên kết của bạn về một nơi.</p>' +
            '</div>' +
            '<div class="footer-col"><h4>Sản phẩm</h4><ul>' +
            '<li><a href="/dashboard">Bio-link</a></li>' +
            '<li><a href="/short-links">Short link</a></li>' +
            '<li><a href="/qr">QR code</a></li>' +
            '<li><a href="/analytics">Analytics</a></li>' +
            '</ul></div>' +
            '<div class="footer-col"><h4>Hỗ trợ</h4><ul>' +
            '<li><a href="/support">Trung tâm hỗ trợ</a></li>' +
            '<li><a href="/report">Báo lỗi</a></li>' +
            '<li><a href="/support#lien-he">Liên hệ hỗ trợ</a></li>' +
            '<li><a href="/team">Đội ngũ Xn</a></li>' +
            '</ul></div>' +
            '<div class="footer-col"><h4>Pháp lý</h4><ul>' +
            '<li><a href="/terms">Điều khoản dịch vụ</a></li>' +
            '<li><a href="/privacy">Chính sách riêng tư</a></li>' +
            '<li><a href="/cookies">Cookies</a></li>' +
            '<li><a href="/legal">Pháp lý</a></li>' +
            '</ul></div>' +
            '<div class="footer-col"><h4>Cộng đồng</h4><ul>' +
            '<li><a href="https://discord.gg" target="_blank" rel="noopener">Discord</a></li>' +
            '<li><a href="https://youtube.com" target="_blank" rel="noopener">YouTube</a></li>' +
            '<li><a href="https://instagram.com" target="_blank" rel="noopener">Instagram</a></li>' +
            '</ul></div>' +
            '</div>' +
            '<div class="footer-note">' +
            '<span>© <span data-year></span> Xn. All rights reserved.</span>' +
            '<span>Your links. One simple page.</span>' +
            '</div></div>';
        $$('[data-year]', el).forEach(function (n) { n.textContent = new Date().getFullYear(); });
    }

    function initChrome() {
        $$('[data-theme-toggle]').forEach(function (btn) {
            on(btn, 'click', function () {
                var current = document.documentElement.getAttribute('data-theme');
                setThemePref(current === 'dark' ? 'light' : 'dark');
            });
        });
        applyTheme(getThemePref());
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            if (getThemePref() === 'system') applyTheme('system');
        });

        var toggle = $('[data-nav-toggle]');
        var drawer = $('#mobile-nav');
        if (toggle && drawer) {
            on(toggle, 'click', function () {
                var open = drawer.classList.toggle('is-open');
                toggle.setAttribute('aria-expanded', String(open));
                toggle.innerHTML = icon(open ? 'close' : 'menu');
            });
            $$('a', drawer).forEach(function (a) {
                on(a, 'click', function () {
                    drawer.classList.remove('is-open');
                    toggle.setAttribute('aria-expanded', 'false');
                    toggle.innerHTML = icon('menu');
                });
            });
        }

        var header = $('.site-header');
        if (header) {
            var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 6); };
            on(window, 'scroll', onScroll, { passive: true });
            onScroll();
        }

        $$('[data-reveal]').forEach(function (btn) {
            on(btn, 'click', function () {
                var input = $('#' + btn.dataset.reveal);
                if (!input) return;
                var show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
                btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
                input.focus();
            });
        });

        $$('[data-open-modal]').forEach(function (btn) {
            on(btn, 'click', function () { Modal.open($(btn.dataset.openModal)); });
        });

        $$('[data-icon]').forEach(function (el) {
            el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
        });

        $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

        renderFooter();

        /* Scroll reveal cho trang marketing */
        var revealTargets = $$('.feature, .section-head, .theme-picker, .showcase .phone-wrap, .cta-band, .card-grid');
        if ('IntersectionObserver' in window && revealTargets.length) {
            revealTargets.forEach(function (el, i) {
                el.classList.add('js-reveal');
                el.style.setProperty('--d', (i % 4) * 70 + 'ms');
            });
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        io.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.15 });
            revealTargets.forEach(function (el) { io.observe(el); });
        }

        initModals();
    }

    /** Chuyển trang nội bộ mượt: fade nhẹ rồi điều hướng. */
    function initPageTransitions() {
        on(document, 'click', function (e) {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            var a = e.target.closest('a[href]');
            if (!a || a.target === '_blank') return;
            var href = a.getAttribute('href');
            if (!href || href.charAt(0) === '#' || /^(https?:)?\/\//i.test(href) || a.hasAttribute('download')) return;
            var url = new URL(a.href, location.href);
            if (url.origin !== location.origin) return;
            if (url.pathname === location.pathname && url.search === location.search) return;

            e.preventDefault();
            document.body.classList.add('page-exit');
            setTimeout(function () { location.href = a.href; }, 140);
        });
    }

    /* ======================================================================
       9. Page: home
       ====================================================================== */

    var SAMPLE_MODEL = {
        username: 'minhanh',
        displayName: 'Minh Anh',
        bio: 'Sáng tạo nội dung • Du lịch & ẩm thực',
        avatar: '',
        links: [
            { id: 's1', title: 'Website của tôi', url: 'https://example.com', icon: 'globe', enabled: true },
            { id: 's2', title: 'Kênh YouTube', url: 'https://youtube.com/', icon: 'youtube', enabled: true },
            { id: 's3', title: 'TikTok', url: 'https://tiktok.com/@', icon: 'tiktok', enabled: true },
            { id: 's4', title: 'Instagram', url: 'https://instagram.com/', icon: 'instagram', enabled: true }
        ],
        socials: { instagram: 'minhanh', youtube: 'minhanh', tiktok: 'minhanh' },
        appearance: Object.assign({}, DEFAULT_APPEARANCE)
    };

    function initHome() {
        var preview = $('#hero-preview');
        if (preview) renderCanvas(preview, SAMPLE_MODEL, {});

        var claimInput = $('#claim-username');
        var claimForm = $('#claim-form');
        if (claimInput) {
            on(claimInput, 'input', function () {
                var value = claimInput.value.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
                claimInput.value = value;
                SAMPLE_MODEL.username = value || 'minhanh';
                SAMPLE_MODEL.displayName = value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Minh Anh';
                renderCanvas(preview, SAMPLE_MODEL, {});
            });
        }
        if (claimForm) {
            on(claimForm, 'submit', function (e) {
                e.preventDefault();
                var name = claimInput.value.trim();
                location.href = '/register' + (name ? '?u=' + encodeURIComponent(name) : '');
            });
        }

        var showcase = $('#showcase-preview');
        if (showcase) {
            var showModel = JSON.parse(JSON.stringify(SAMPLE_MODEL));
            renderCanvas(showcase, showModel, {});
            $$('[data-theme-chip]').forEach(function (chip) {
                on(chip, 'click', function () {
                    $$('[data-theme-chip]').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
                    chip.setAttribute('aria-pressed', 'true');
                    showModel.appearance.background = chip.dataset.themeChip;
                    showModel.appearance.buttonStyle = chip.dataset.buttons || 'fill';
                    showModel.appearance.accent = chip.dataset.accent || DEFAULT_APPEARANCE.accent;
                    showModel.appearance.font = chip.dataset.font || 'sans';
                    renderCanvas(showcase, showModel, {});
                });
            });
        }

        /* Đã đăng nhập? CTA chính đưa về dashboard */
        api.me().then(function (data) {
            if (data && data.authenticated) {
                var cta = $('[data-cta-main]');
                if (cta) { cta.textContent = 'Mở bảng điều khiển'; cta.setAttribute('href', '/dashboard'); }
            }
        }).catch(function () { });
    }

    /* ======================================================================
       10. Page: login / register
       ====================================================================== */

    function initLogin() {
        var form = $('#login-form');
        if (!form) return;

        var username = $('#login-username'),
            password = $('#login-password'),
            submit = $('#login-submit'),
            alertBox = $('#login-alert');

        var preview = $('#login-preview');
        if (preview) renderCanvas(preview, SAMPLE_MODEL, {});

        function fail(message) {
            alertBox.innerHTML = icon('alert') + '<span>' + escapeHtml(message) + '</span>';
            alertBox.classList.add('is-visible');
            submit.classList.remove('is-loading');
            submit.disabled = false;
        }

        on(form, 'submit', function (e) {
            e.preventDefault();
            alertBox.classList.remove('is-visible');
            var ok = [
                setFieldState(username, username.value.trim() ? '' : 'Nhập tên đăng nhập.'),
                setFieldState(password, password.value ? '' : 'Nhập mật khẩu.')
            ].every(Boolean);
            if (!ok) return;

            submit.classList.add('is-loading');
            submit.disabled = true;

            api.login({ username: username.value.trim(), password: password.value })
                .then(async function () {
                    // Xác nhận session đã được ghi nhận trước khi chuyển trang —
                    // phòng trường hợp proxy/mạng làm mất cookie ở request đầu tiên
                    try {
                        var check = await api.me();
                        if (!check.authenticated) {
                            await new Promise(function (r) { setTimeout(r, 400); });
                            await api.me();
                        }
                    } catch (e) { /* cứ chuyển trang, dashboard sẽ tự kiểm tra lại */ }
                    var next = new URLSearchParams(location.search).get('next');
                    var allowed = ['/dashboard', '/short-links', '/qr', '/analytics', '/settings'];
                    location.href = allowed.indexOf(next) > -1 ? next : '/dashboard';
                })
                .catch(fail);
        });
    }

    function initRegister() {
        var form = $('#register-form');
        if (!form) return;

        var username = $('#reg-username'),
            email = $('#reg-email'),
            password = $('#reg-password'),
            confirm = $('#reg-confirm'),
            legal = $('#reg-legal'),
            submit = $('#reg-submit'),
            alertBox = $('#reg-alert'),
            preview = $('#reg-preview'),
            urlEcho = $('#reg-url');

        var params = new URLSearchParams(location.search);
        if (params.get('u')) username.value = params.get('u').toLowerCase().replace(/[^a-z0-9_.]/g, '');

        var model = {
            username: '', displayName: '', bio: 'Hãy kể mọi người nghe bạn làm những gì.',
            links: [
                { id: 'p1', title: 'Website của tôi', url: 'https://example.com', icon: 'globe', enabled: true },
                { id: 'p2', title: 'Kênh YouTube', url: 'https://youtube.com/', icon: 'youtube', enabled: true }
            ],
            socials: {}, appearance: Object.assign({}, DEFAULT_APPEARANCE)
        };

        function paint() {
            var name = username.value.trim().toLowerCase();
            model.username = name || 'minhanh';
            model.displayName = name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Tên của bạn';
            renderCanvas(preview, model, {});
            if (urlEcho) urlEcho.textContent = PUBLIC_HOST + '/user/' + (name || 'ten-cua-ban');
        }
        paint();

        on(username, 'input', function () {
            username.value = username.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
            paint();
        });

        liveField(username, function () { return checkUsername(username.value); });
        liveField(email, function () { return checkEmail(email.value); });
        liveField(password, function () { return checkPassword(password.value); });
        liveField(confirm, function () {
            return confirm.value !== password.value ? 'Mật khẩu chưa khớp.' : '';
        });

        // Nút Đăng ký chỉ bật khi tick đồng ý điều khoản
        function syncLegal() {
            submit.disabled = !legal.checked;
        }
        on(legal, 'change', syncLegal);
        syncLegal();

        on(form, 'submit', function (e) {
            e.preventDefault();
            alertBox.classList.remove('is-visible');

            if (!legal.checked) {
                alertBox.innerHTML = icon('alert') +
                    '<span>Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách riêng tư trước khi đăng ký.</span>';
                alertBox.classList.add('is-visible');
                return;
            }

            var ok = [
                setFieldState(username, checkUsername(username.value)),
                setFieldState(email, checkEmail(email.value)),
                setFieldState(password, checkPassword(password.value)),
                setFieldState(confirm, confirm.value !== password.value ? 'Mật khẩu chưa khớp.' : '')
            ].every(Boolean);
            if (!ok) {
                var firstBad = $('.field.is-invalid .input');
                if (firstBad) firstBad.focus();
                return;
            }

            submit.classList.add('is-loading');
            submit.disabled = true;

            api.register({
                username: username.value.trim(),
                email: email.value.trim(),
                password: password.value,
                legalAccepted: true
            }).then(function () {
                location.href = '/dashboard?welcome=1';
            }).catch(function (err) {
                submit.classList.remove('is-loading');
                submit.disabled = !legal.checked;
                if (err.errors) {
                    if (err.errors.username) setFieldState(username, err.errors.username);
                    if (err.errors.email) setFieldState(email, err.errors.email);
                    if (err.errors.password) setFieldState(password, err.errors.password);
                }
                alertBox.innerHTML = icon('alert') + '<span>' + escapeHtml(err.message) + '</span>';
                alertBox.classList.add('is-visible');
            });
        });
    }

    /* ======================================================================
       11. Page: public profile — /user/:username (và /:username cũ)
       ====================================================================== */

    function initProfile() {
        var path = decodeURIComponent(location.pathname).toLowerCase();
        var username = path.indexOf('/user/') === 0
            ? path.slice(6)
            : path.replace(/^\//, '');
        username = username.split('/')[0].trim();
        if (!username || RESERVED.indexOf(username) > -1) {
            location.replace('/404');
            return;
        }

        var shell = $('#profile-shell');
        renderSkeleton(shell);

        api.getPublic(username).then(function (data) {
            var user = data.user;
            var profile = data.profile;
            var socials = socialsToMap(data.socials);

            document.title = (profile.displayName || user.username) + ' (@' + user.username + ') — Xn';

            // Nền ambient phía sau canvas
            if (!$('.profile-bg', document.body)) {
                var bg = document.createElement('div');
                bg.className = 'profile-bg';
                bg.innerHTML = '<div class="p-glow"></div><div class="p-blob p-blob--a"></div><div class="p-blob p-blob--b"></div>';
                document.body.insertBefore(bg, document.body.firstChild);
            }

            renderCanvas(shell, {
                username: user.username,
                displayName: profile.displayName,
                bio: profile.bio,
                avatar: profile.avatarUrl,
                links: data.links,
                socials: socials,
                appearance: appearanceOf(profile)
            }, { interactive: true });

            document.body.classList.add('xn-canvas');
            document.body.classList.add('profile-page');
            document.body.dataset.bg = profile.background;
            document.body.dataset.buttons = profile.buttonStyle;
            document.body.dataset.font = profile.font;
            document.body.style.setProperty('--c-accent', profile.accentColor);
            document.body.style.setProperty('--c-on-accent', readableOn(profile.accentColor));
            document.body.style.setProperty('--c-bg', '');
            document.body.style.background = '';

            /* Đếm lượt nhấp qua API (lượt xem do server ghi khi GET) */
            on(shell, 'click', function (e) {
                var link = e.target.closest('[data-link-id]');
                if (!link) return;
                api.trackClick(user.username, Number(link.dataset.linkId)).catch(function () { });
            });

            requestAnimationFrame(function () { shell.classList.add('is-ready'); });
        }).catch(function () {
            location.replace('/404?u=' + encodeURIComponent(username));
        });

        on($('#profile-copy'), 'click', function () {
            copyText(location.href).then(function () { toast('Đã sao chép liên kết.'); });
        });
        on($('#profile-share'), 'click', function () { shareProfile(username); });
    }

    /* ======================================================================
       12. Expose + boot
       ====================================================================== */

    window.Xn = {
        api: api,
        apiRequest: apiRequest,
        icon: icon,
        ICONS: ICONS,
        SOCIAL_FIELDS: SOCIAL_FIELDS,
        LINK_ICONS: LINK_ICONS,
        DEFAULT_APPEARANCE: DEFAULT_APPEARANCE,
        DEFAULT_AVATAR: DEFAULT_AVATAR,
        PUBLIC_HOST: PUBLIC_HOST,
        appearanceOf: appearanceOf,
        socialsToMap: socialsToMap,
        renderCanvas: renderCanvas,
        renderSkeleton: renderSkeleton,
        toast: toast,
        Modal: Modal,
        confirmDialog: confirmDialog,
        copyText: copyText,
        shareProfile: shareProfile,
        profileUrl: profileUrl,
        formatCount: formatCount,
        countUp: countUp,
        setFieldState: setFieldState,
        liveField: liveField,
        checkUsername: checkUsername,
        checkEmail: checkEmail,
        checkPassword: checkPassword,
        getThemePref: getThemePref,
        setThemePref: setThemePref,
        $: $,
        $$: $$,
        on: on,
        escapeHtml: escapeHtml,
        normalizeUrl: normalizeUrl,
        shortUrl: shortUrl,
        resizeImage: function resizeImage(file, size) {
            return new Promise(function (resolve, reject) {
                if (!/^image\//.test(file.type)) { reject(new Error('not an image')); return; }
                var reader = new FileReader();
                reader.onerror = function () { reject(new Error('read error')); };
                reader.onload = function () {
                    var img = new Image();
                    img.onerror = function () { reject(new Error('decode error')); };
                    img.onload = function () {
                        var canvas = document.createElement('canvas');
                        canvas.width = size;
                        canvas.height = size;
                        var ctx = canvas.getContext('2d');
                        var min = Math.min(img.width, img.height);
                        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
                        resolve(canvas.toDataURL('image/jpeg', 0.86));
                    };
                    img.src = reader.result;
                };
                reader.readAsDataURL(file);
            });
        }
    };

    function boot() {
        initChrome();
        initPageTransitions();

        switch (document.body.dataset.page) {
            case 'home': initHome(); break;
            case 'register': initRegister(); break;
            case 'login': initLogin(); break;
            case 'profile': initProfile(); break;
            /* dashboard/shortlinks/qr/analytics/settings do js/app.js xử lý */
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
