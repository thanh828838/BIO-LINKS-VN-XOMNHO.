/* ==========================================================================
   Xn — app.js
   Các trang trong app: dashboard (Bio-link), short-links, qr, analytics, settings.
   Phụ thuộc window.Xn từ js/main.js (phải load trước).
   ========================================================================== */

(function () {
    'use strict';

    if (!window.Xn) return;
    var Xn = window.Xn;
    var $ = Xn.$, $$ = Xn.$$, on = Xn.on, icon = Xn.icon, api = Xn.api;
    var toast = Xn.toast, Modal = Xn.Modal, confirmDialog = Xn.confirmDialog;
    var escapeHtml = Xn.escapeHtml, formatCount = Xn.formatCount, countUp = Xn.countUp;
    var normalizeUrl = Xn.normalizeUrl, shortUrl = Xn.shortUrl;
    var setFieldState = Xn.setFieldState, liveField = Xn.liveField;
    var checkUsername = Xn.checkUsername, checkEmail = Xn.checkEmail, checkPassword = Xn.checkPassword;
    var renderCanvas = Xn.renderCanvas, appearanceOf = Xn.appearanceOf, socialsToMap = Xn.socialsToMap;
    var DEFAULT_AVATAR = Xn.DEFAULT_AVATAR, PUBLIC_HOST = Xn.PUBLIC_HOST;
    var SOCIAL_FIELDS = Xn.SOCIAL_FIELDS, LINK_ICONS = Xn.LINK_ICONS;

    /* ======================================================================
       Navigation — sidebar + bottom nav
       ====================================================================== */

    var NAV = [
        { id: 'dashboard', href: '/dashboard', icon: 'link', label: 'Bio-link', desc: 'Quản lý trang của bạn' },
        { id: 'shortlinks', href: '/short-links', icon: 'scissors', label: 'Short link', desc: 'Rút gọn đường dẫn' },
        { id: 'qr', href: '/qr', icon: 'qr', label: 'QR code', desc: 'Tạo mã QR' },
        { id: 'analytics', href: '/analytics', icon: 'chart', label: 'Analytics', desc: 'Lượt xem & nhấp' },
        { id: 'settings', href: '/settings', icon: 'sliders', label: 'Cài đặt', desc: 'Hồ sơ & tuỳ chọn' }
    ];

    function injectShell(active) {
        var side = $('[data-app-sidebar]');
        if (side) {
            var html =
                '<a class="brand" href="/" aria-label="Trang chủ Xn">' +
                '<span class="brand-mark" aria-hidden="true">' + icon('link') + '</span><span>Xn</span></a>' +
                '<p class="side-section">Menu</p>' +
                '<nav aria-label="Điều hướng chính" style="display:flex;flex-direction:column;gap:4px">';
            NAV.forEach(function (item) {
                html += '<a class="side-link" href="' + item.href + '"' +
                    (item.id === active ? ' aria-current="page"' : '') + '>' +
                    icon(item.icon) +
                    '<span class="sl-text"><span>' + item.label + '</span><span class="sl-desc">' + item.desc + '</span></span></a>';
            });
            html += '</nav>';
            html += '<div class="side-foot">' +
                '<div class="side-card"><strong>Xem trang của bạn</strong>Các liên kết người khác sẽ thấy.' +
                '<button class="btn btn--soft btn--sm" type="button" data-open-profile data-icon="external">Mở trang</button></div>' +
                '<button class="side-link" type="button" data-logout>' + icon('logout') +
                '<span class="sl-text"><span>Đăng xuất</span></span></button>' +
                '</div>';
            side.innerHTML = html;
            on($('[data-open-profile]', side), 'click', function () {
                if (shellUser) window.open('/user/' + shellUser.username, '_blank', 'noopener');
            });
            bindLogout(side);
        }

        var bottom = $('[data-app-bottomnav]');
        if (bottom) {
            var bhtml = '<ul>';
            NAV.forEach(function (item) {
                bhtml += '<li><a href="' + item.href + '"' +
                    (item.id === active ? ' aria-current="page"' : '') + '>' +
                    icon(item.icon) + '<span>' + item.label + '</span></a></li>';
            });
            bhtml += '</ul>';
            bottom.innerHTML = bhtml;
        }

        // Nút mở trang trên topbar
        $$('[data-open-profile-top]').forEach(function (a) {
            on(a, 'click', function (e) {
                if (!shellUser) { e.preventDefault(); }
            });
        });
    }

    var shellUser = null;

    function bindLogout(root) {
        $$('[data-logout]', root).forEach(function (btn) {
            on(btn, 'click', function () {
                confirmDialog({
                    title: 'Đăng xuất khỏi Xn?',
                    message: 'Trang của bạn vẫn hoạt động. Bạn có thể đăng nhập lại bất cứ lúc nào.',
                    confirmLabel: 'Đăng xuất'
                }).then(function (yes) {
                    if (!yes) return;
                    api.logout().catch(function () { }).finally(function () {
                        location.href = '/login';
                    });
                });
            });
        });
    }

    function paintShell(user, profile) {
        shellUser = user;
        $$('[data-user-avatar]').forEach(function (img) { img.src = (profile && profile.avatarUrl) || DEFAULT_AVATAR; });
        $$('[data-user-handle]').forEach(function (el) { el.textContent = '@' + user.username; });
        $$('[data-open-profile]').forEach(function (a) { a.href = '/user/' + user.username; });
        $$('[data-open-profile-top]').forEach(function (a) { a.href = '/user/' + user.username; });
    }

    /** Bảo vệ trang app: xác minh session qua /api/me. Trả về user hoặc null (đã redirect). */
    async function requireAuth() {
        try {
            var data = await api.me();
            if (data && data.authenticated) return data.user;
        } catch (err) { /* lỗi mạng — vẫn chuyển về login */ }
        location.replace('/login?next=' + encodeURIComponent(location.pathname));
        return null;
    }

    /* ======================================================================
       Trang: dashboard (Bio-link)
       ====================================================================== */

    function initDashboard() {
        injectShell('dashboard');

        var user = null, profile = null, links = [], stats = { views: 0, history: [] }, socialsList = [];
        var preview = $('#dash-preview');
        var listEl = $('#link-list');
        var emptyEl = $('#link-empty');

        (async function load() {
            var me = await requireAuth();
            if (!me) return;
            var data = await api.getProfile();
            user = data.user;
            profile = data.profile;
            links = data.links || [];
            stats = data.stats || stats;
            socialsList = data.socials || [];
            paintShell(user, profile);
            paintAll();
        })().catch(function (err) { toast(err.message, 'error'); });

        function paintSummary() {
            $('#summary-avatar').src = (profile && profile.avatarUrl) || DEFAULT_AVATAR;
            $('#summary-name').textContent = (profile && profile.displayName) || user.username;
            $('#summary-handle').textContent = '@' + user.username;
            var bio = $('#summary-bio');
            bio.textContent = profile && profile.bio ? profile.bio : 'Chưa có giới thiệu — thêm một dòng để mọi người biết bạn là ai.';
            bio.classList.toggle('muted', !(profile && profile.bio));
            $('#summary-url span').textContent = PUBLIC_HOST + '/user/' + user.username;
        }

        function paintStats() {
            var clicks = links.reduce(function (sum, l) { return sum + (l.clicks || 0); }, 0);
            countUp($('#stat-views'), stats.views);
            countUp($('#stat-clicks'), clicks);
            $('#stat-rate').textContent = stats.views ? Math.round((clicks / stats.views) * 100) + '%' : '—';
            $('#stat-active').textContent =
                links.filter(function (l) { return l.enabled !== false; }).length + '/' + links.length;
            var top = links.slice().sort(function (a, b) { return (b.clicks || 0) - (a.clicks || 0); })[0];
            $('#stat-top').textContent = top && top.clicks ? top.title : 'Chưa có lượt nhấp';

            var chart = $('#views-chart');
            var days = stats.history && stats.history.length ? stats.history : [];
            var max = Math.max.apply(null, days.map(function (d) { return d.views; }).concat([1]));
            chart.innerHTML = days.map(function (d, idx) {
                var label = new Date(d.day + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short' }).slice(0, 2);
                var height = Math.max(4, Math.round((d.views / max) * 100));
                return '<div class="chart-col' + (idx === days.length - 1 ? ' is-today' : '') + '" title="' + d.views + ' lượt xem ngày ' + d.day + '">' +
                    '<div class="chart-bar" style="height:' + height + '%"></div><small>' + label + '</small></div>';
            }).join('');
        }

        function paintLinks() {
            emptyEl.hidden = links.length > 0;
            listEl.hidden = links.length === 0;
            listEl.innerHTML = links.map(function (link) {
                return '<li class="link-card' + (link.enabled === false ? ' is-off' : '') + '" data-id="' + escapeHtml(link.id) + '">' +
                    '<button class="drag-handle" type="button" aria-label="Sắp xếp ' + escapeHtml(link.title) +
                    '. Dùng phím mũi tên để di chuyển." data-drag>' + icon('grip') + '</button>' +
                    '<span class="link-icon">' + icon(link.icon || 'link') + '</span>' +
                    '<span class="link-info"><strong>' + escapeHtml(link.title) + '</strong>' +
                    '<span>' + escapeHtml(shortUrl(link.url)) + '</span></span>' +
                    '<span class="link-clicks">' + formatCount(link.clicks || 0) + ' lượt nhấp</span>' +
                    '<span class="link-actions">' +
                    '<input class="switch" type="checkbox" data-toggle ' + (link.enabled === false ? '' : 'checked') +
                    ' aria-label="Hiện ' + escapeHtml(link.title) + ' trên trang của bạn">' +
                    '<button class="icon-btn" type="button" data-edit aria-label="Sửa ' + escapeHtml(link.title) + '">' + icon('pencil') + '</button>' +
                    '<button class="icon-btn icon-btn--danger" type="button" data-delete aria-label="Xóa ' + escapeHtml(link.title) + '">' + icon('trash') + '</button>' +
                    '</span></li>';
            }).join('');
        }

        function paintPreview() {
            renderCanvas(preview, {
                username: user.username,
                displayName: profile && profile.displayName,
                bio: profile && profile.bio,
                avatar: profile && profile.avatarUrl,
                links: links,
                socials: socialsToMap(socialsList),
                appearance: appearanceOf(profile)
            }, { showEmpty: true });
        }

        function paintAll() { paintSummary(); paintStats(); paintLinks(); paintPreview(); }

        /* ---- Link modal ---- */
        var linkModal = $('#link-modal');
        var titleInput = $('#link-title');
        var urlInput = $('#link-url');
        var enabledInput = $('#link-enabled');
        var iconPicker = $('#icon-picker');
        var modalTitle = $('#link-modal-title');
        var editingId = null;
        var chosenIcon = 'link';
        var iconTouched = false;

        iconPicker.innerHTML = LINK_ICONS.map(function (name) {
            return '<button type="button" class="icon-option" data-icon-name="' + name + '" aria-pressed="false" aria-label="Biểu tượng ' + name + '" style="display:grid;place-items:center;width:36px;height:36px;border-radius:9px;border:1px solid var(--border);color:var(--muted)">' +
                icon(name) + '</button>';
        }).join('');
        $$('[data-icon-name]', iconPicker).forEach(function (b) {
            on(b, 'click', function () {
                chosenIcon = b.dataset.iconName;
                $$('[data-icon-name]', iconPicker).forEach(function (x) {
                    var active = x.dataset.iconName === chosenIcon;
                    x.setAttribute('aria-pressed', String(active));
                    x.style.borderColor = active ? 'var(--primary-bright)' : 'var(--border)';
                    x.style.color = active ? 'var(--primary)' : 'var(--muted)';
                });
                iconTouched = true;
            });
        });

        function guessIcon(url) {
            var host = shortUrl(url).toLowerCase();
            var map = ['github', 'instagram', 'youtube', 'tiktok', 'facebook', 'twitch', 'spotify', 'soundcloud'];
            for (var i = 0; i < map.length; i++) if (host.indexOf(map[i]) === 0 || host.indexOf('.' + map[i]) > -1 || host.indexOf(map[i] + '.') > -1) return map[i];
            if (host.indexOf('x.com') === 0 || host.indexOf('twitter') > -1) return 'x';
            if (host.indexOf('discord') > -1) return 'discord';
            if (host.indexOf('mailto:') === 0) return 'mail';
            return 'globe';
        }

        function openLinkModal(link) {
            editingId = link ? link.id : null;
            modalTitle.textContent = link ? 'Sửa liên kết' : 'Thêm liên kết';
            titleInput.value = link ? link.title : '';
            urlInput.value = link ? link.url : '';
            enabledInput.checked = link ? link.enabled !== false : true;
            chosenIcon = link ? (link.icon || 'link') : 'link';
            $$('[data-icon-name]', iconPicker).forEach(function (x) {
                var active = x.dataset.iconName === chosenIcon;
                x.setAttribute('aria-pressed', String(active));
                x.style.borderColor = active ? 'var(--primary-bright)' : 'var(--border)';
                x.style.color = active ? 'var(--primary)' : 'var(--muted)';
            });
            setFieldState(titleInput, '');
            setFieldState(urlInput, '');
            $('#link-submit').textContent = link ? 'Lưu liên kết' : 'Thêm liên kết';
            Modal.open(linkModal);
        }

        on($('#add-link'), 'click', function () { openLinkModal(null); });
        on($('#add-first-link'), 'click', function () { openLinkModal(null); });
        on(urlInput, 'input', function () {
            if (!iconTouched) {
                chosenIcon = guessIcon(urlInput.value);
                $$('[data-icon-name]', iconPicker).forEach(function (x) {
                    var active = x.dataset.iconName === chosenIcon;
                    x.setAttribute('aria-pressed', String(active));
                    x.style.borderColor = active ? 'var(--primary-bright)' : 'var(--border)';
                    x.style.color = active ? 'var(--primary)' : 'var(--muted)';
                });
            }
        });

        on($('#link-form'), 'submit', function (e) {
            e.preventDefault();
            var ok = [
                setFieldState(titleInput, titleInput.value.trim() ? '' : 'Đặt nhãn cho liên kết để mọi người nhận ra.'),
                setFieldState(urlInput, urlInput.value.trim() ? '' : 'Thêm địa chỉ mà liên kết sẽ mở.')
            ].every(Boolean);
            if (!ok) return;

            var submitBtn = $('#link-submit');
            submitBtn.classList.add('is-loading');
            submitBtn.disabled = true;

            var payload = {
                title: titleInput.value.trim(),
                url: normalizeUrl(urlInput.value),
                icon: chosenIcon,
                enabled: enabledInput.checked
            };
            var request = editingId ? api.updateLink(editingId, payload) : api.addLink(payload);

            request.then(function (data) {
                submitBtn.classList.remove('is-loading');
                submitBtn.disabled = false;
                if (editingId) {
                    var idx = links.findIndex(function (l) { return l.id === editingId; });
                    if (idx > -1) links[idx] = data.link;
                    paintLinks();
                    toast('Đã lưu liên kết.');
                } else {
                    links.push(data.link);
                    paintLinks();
                    var freshCard = listEl.querySelector('[data-id="' + data.link.id + '"]');
                    if (freshCard) freshCard.classList.add('is-new');
                    toast('Đã thêm liên kết vào trang của bạn.');
                }
                paintStats();
                paintPreview();
                Modal.close(linkModal);
            }).catch(function (err) {
                submitBtn.classList.remove('is-loading');
                submitBtn.disabled = false;
                toast(err.message, 'error');
            });
        });

        /* ---- Tương tác danh sách ---- */
        on(listEl, 'click', function (e) {
            var card = e.target.closest('.link-card');
            if (!card) return;
            var id = Number(card.dataset.id);
            var link = links.find(function (l) { return l.id === id; });
            if (!link) return;

            if (e.target.closest('[data-edit]')) openLinkModal(link);

            if (e.target.closest('[data-delete]')) {
                confirmDialog({
                    title: 'Xóa liên kết này?',
                    message: '“' + link.title + '” sẽ bị gỡ khỏi trang của bạn. Không thể hoàn tác.',
                    confirmLabel: 'Xóa liên kết',
                    tone: 'danger'
                }).then(function (yes) {
                    if (!yes) return;
                    api.deleteLink(id).then(function () {
                        card.classList.add('is-leaving');
                        setTimeout(function () {
                            links = links.filter(function (l) { return l.id !== id; });
                            paintLinks(); paintStats(); paintPreview();
                        }, 200);
                        toast('Đã xóa liên kết.');
                    }).catch(function (err) { toast(err.message, 'error'); });
                });
            }
        });

        on(listEl, 'change', function (e) {
            var toggle = e.target.closest('[data-toggle]');
            if (!toggle) return;
            var card = toggle.closest('.link-card');
            var id = Number(card.dataset.id);
            api.updateLink(id, { enabled: toggle.checked }).then(function (data) {
                var idx = links.findIndex(function (l) { return l.id === id; });
                if (idx > -1) links[idx] = data.link;
                paintLinks(); paintPreview();
                toast(data.link.enabled ? 'Liên kết đã hiện trên trang.' : 'Liên kết đã được ẩn.');
            }).catch(function (err) {
                toggle.checked = !toggle.checked;
                toast(err.message, 'error');
            });
        });

        on(listEl, 'keydown', function (e) {
            var handle = e.target.closest('[data-drag]');
            if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
            e.preventDefault();
            var card = handle.closest('.link-card');
            var index = links.findIndex(function (l) { return l.id === Number(card.dataset.id); });
            var target = e.key === 'ArrowUp' ? index - 1 : index + 1;
            if (target < 0 || target >= links.length) return;
            var moved = links.splice(index, 1)[0];
            links.splice(target, 0, moved);
            persistOrder();
            paintLinks();
            var newHandle = $$('.link-card', listEl)[target].querySelector('[data-drag]');
            if (newHandle) newHandle.focus();
        });

        function persistOrder() {
            api.reorderLinks(links.map(function (l) { return l.id; }))
                .then(function (data) { links = data.links; toast('Đã lưu thứ tự mới.'); })
                .catch(function (err) { toast(err.message, 'error'); });
        }

        initDragSort(listEl, function (orderedIds) {
            var ids = orderedIds.map(Number);
            links.sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
            persistOrder();
        });

        /* ---- Copy / share / open ---- */
        on($('#copy-url'), 'click', function () {
            Xn.copyText(Xn.profileUrl(user.username)).then(function () { toast('Đã sao chép liên kết.'); })
                .catch(function () { toast('Không thể sao chép.', 'error'); });
        });
        on($('#share-profile'), 'click', function () { Xn.shareProfile(user.username); });
        on($('#preview-open'), 'click', function () { window.open('/user/' + user.username, '_blank', 'noopener'); });
        on($('#preview-copy'), 'click', function () {
            Xn.copyText(Xn.profileUrl(user.username)).then(function () { toast('Đã sao chép liên kết.'); });
        });

        if (new URLSearchParams(location.search).get('welcome')) {
            setTimeout(function () { toast('Trang của bạn đã hoạt động. Hãy thêm liên kết đầu tiên.'); }, 400);
            history.replaceState({}, '', '/dashboard');
        }
    }

    /* Kéo để sắp xếp — chuột lẫn cảm ứng */
    function initDragSort(list, onDrop) {
        if (!list) return;
        var dragEl = null, startY = 0, moved = false;

        function onPointerDown(e) {
            var handle = e.target.closest('[data-drag]');
            if (!handle || e.button === 2) return;
            dragEl = handle.closest('.link-card');
            if (!dragEl) return;
            e.preventDefault();
            moved = false;
            startY = e.clientY;
            dragEl.classList.add('is-dragging');
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerUp);
        }

        function onPointerMove(e) {
            if (!dragEl) return;
            var dy = e.clientY - startY;
            if (Math.abs(dy) > 3) moved = true;
            dragEl.style.transform = 'translateY(' + dy + 'px)';
            var rect = dragEl.getBoundingClientRect();
            var middle = rect.top + rect.height / 2;
            var cards = Array.prototype.slice.call(list.children);
            var dragIndex = cards.indexOf(dragEl);
            for (var i = 0; i < cards.length; i++) {
                var other = cards[i];
                if (other === dragEl) continue;
                var r = other.getBoundingClientRect();
                var otherMiddle = r.top + r.height / 2;
                if (middle < otherMiddle && i < dragIndex) { swap(other, dy, e); break; }
                if (middle > otherMiddle && i > dragIndex) { swap(other.nextSibling, dy, e); break; }
            }
        }

        function swap(before, dy, e) {
            var slotBefore = dragEl.getBoundingClientRect().top - dy;
            list.insertBefore(dragEl, before);
            var slotAfter = dragEl.getBoundingClientRect().top - dy;
            startY += slotAfter - slotBefore;
            dragEl.style.transform = 'translateY(' + (e.clientY - startY) + 'px)';
        }

        function onPointerUp() {
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
            if (!dragEl) return;
            dragEl.style.transform = '';
            dragEl.classList.remove('is-dragging');
            dragEl = null;
            if (!moved) return;
            var ids = Array.prototype.slice.call(list.children).map(function (el) { return el.dataset.id; });
            onDrop(ids);
        }

        list.addEventListener('pointerdown', onPointerDown);
    }

    /* ======================================================================
       Trang: short links
       ====================================================================== */

    function initShortlinks() {
        injectShell('shortlinks');
        var listEl = $('#short-list');
        var emptyEl = $('#short-empty');
        var shorts = [];

        (async function load() {
            var me = await requireAuth();
            if (!me) return;
            paintShell(me, null);
            var data = await api.getShorts();
            shorts = data.shorts || [];
            paint();
        })().catch(function (err) { toast(err.message, 'error'); });

        function shortHref(slug) {
            return location.origin + '/s/' + slug;
        }

        function paint() {
            emptyEl.hidden = shorts.length > 0;
            listEl.hidden = shorts.length === 0;
            listEl.innerHTML = shorts.map(function (s) {
                return '<li class="short-row" data-id="' + s.id + '">' +
                    '<span class="short-icon">' + icon('scissors') + '</span>' +
                    '<span class="short-info">' +
                    '<strong>' + escapeHtml(s.title || 'Không có tiêu đề') + '</strong>' +
                    '<button type="button" class="short-url" data-copy="' + s.id + '" title="Bấm để sao chép">' +
                    shortHref(s.slug) + icon('copy') + '</button>' +
                    '<span class="short-orig">' + escapeHtml(shortUrl(s.originalUrl)) + '</span>' +
                    '</span>' +
                    '<span class="short-clicks"><strong>' + formatCount(s.clicks) + '</strong>lượt nhấp</span>' +
                    '<span class="short-actions">' +
                    '<button class="icon-btn" type="button" data-qr="' + s.id + '" aria-label="Tạo QR cho đường dẫn này">' + icon('qr') + '</button>' +
                    '<button class="icon-btn" type="button" data-edit="' + s.id + '" aria-label="Sửa">' + icon('pencil') + '</button>' +
                    '<button class="icon-btn icon-btn--danger" type="button" data-delete="' + s.id + '" aria-label="Xóa">' + icon('trash') + '</button>' +
                    '</span></li>';
            }).join('');
        }

        var urlInput = $('#short-url');
        var titleInput = $('#short-title');
        var createBtn = $('#short-create');

        on($('#short-form'), 'submit', function (e) {
            e.preventDefault();
            if (!setFieldState(urlInput, urlInput.value.trim() ? '' : 'Nhập đường dẫn gốc cần rút gọn.')) return;

            createBtn.classList.add('is-loading');
            createBtn.disabled = true;

            api.addShort({ url: normalizeUrl(urlInput.value), title: titleInput.value.trim() })
                .then(function (data) {
                    shorts.unshift(data.short);
                    paint();
                    urlInput.value = '';
                    titleInput.value = '';
                    createBtn.classList.remove('is-loading');
                    createBtn.disabled = false;
                    toast('Đã tạo đường dẫn rút gọn.');
                })
                .catch(function (err) {
                    createBtn.classList.remove('is-loading');
                    createBtn.disabled = false;
                    setFieldState(urlInput, err.message);
                });
        });

        on(listEl, 'click', function (e) {
            var copyBtn = e.target.closest('[data-copy]');
            if (copyBtn) {
                var s1 = shorts.find(function (x) { return x.id === Number(copyBtn.dataset.copy); });
                if (s1) Xn.copyText(shortHref(s1.slug)).then(function () { toast('Đã sao chép liên kết rút gọn.'); });
                return;
            }

            var qrBtn = e.target.closest('[data-qr]');
            if (qrBtn) {
                var s2 = shorts.find(function (x) { return x.id === Number(qrBtn.dataset.qr); });
                if (s2) location.href = '/qr?data=' + encodeURIComponent(shortHref(s2.slug));
                return;
            }

            var editBtn = e.target.closest('[data-edit]');
            if (editBtn) {
                var s3 = shorts.find(function (x) { return x.id === Number(editBtn.dataset.edit); });
                if (!s3) return;
                var newUrl = prompt('Đường dẫn mới:', s3.originalUrl);
                if (newUrl === null) return;
                var newTitle = prompt('Tiêu đề:', s3.title || '');
                if (newTitle === null) return;
                api.updateShort(s3.id, { url: newUrl, title: newTitle }).then(function (data) {
                    var idx = shorts.findIndex(function (x) { return x.id === s3.id; });
                    if (idx > -1) shorts[idx] = data.short;
                    paint();
                    toast('Đã lưu thay đổi.');
                }).catch(function (err) { toast(err.message, 'error'); });
                return;
            }

            var delBtn = e.target.closest('[data-delete]');
            if (delBtn) {
                var s4 = shorts.find(function (x) { return x.id === Number(delBtn.dataset.delete); });
                if (!s4) return;
                confirmDialog({
                    title: 'Xóa đường dẫn rút gọn?',
                    message: '“' + (s4.title || s4.slug) + '” sẽ không còn hoạt động. Không thể hoàn tác.',
                    confirmLabel: 'Xóa',
                    tone: 'danger'
                }).then(function (yes) {
                    if (!yes) return;
                    api.deleteShort(s4.id).then(function () {
                        var row = listEl.querySelector('[data-id="' + s4.id + '"]');
                        if (row) row.classList.add('is-leaving');
                        setTimeout(function () {
                            shorts = shorts.filter(function (x) { return x.id !== s4.id; });
                            paint();
                        }, 200);
                        toast('Đã xóa đường dẫn rút gọn.');
                    }).catch(function (err) { toast(err.message, 'error'); });
                });
            }
        });
    }

    /* ======================================================================
       Trang: QR
       ====================================================================== */

    function initQr() {
        injectShell('qr');

        var source = $('#qr-source');
        var urlInput = $('#qr-url');
        var generateBtn = $('#qr-generate');
        var box = $('#qr-box');
        var echo = $('#qr-url-echo');
        var downloadBtn = $('#qr-download');
        var copyBtn = $('#qr-copy');
        var quickWrap = $('#qr-quick');
        var currentData = '';

        (async function load() {
            var me = await requireAuth();
            if (!me) return;
            paintShell(me, null);

            // Mặc định: QR cho bio-link của chính user
            var target = new URLSearchParams(location.search).get('data');
            if (target) { urlInput.value = target; }
            else { urlInput.value = location.origin + '/user/' + me.username; }
            generate();

            // Danh sách short link để chọn nhanh
            var data = await api.getShorts();
            (data.shorts || []).slice(0, 6).forEach(function (s) {
                var chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'chip';
                chip.innerHTML = icon('scissors') + '<span>' + escapeHtml(location.origin + '/s/' + s.slug) + '</span>';
                on(chip, 'click', function () {
                    urlInput.value = location.origin + '/s/' + s.slug;
                    generate();
                });
                quickWrap.appendChild(chip);
            });
        })().catch(function (err) { toast(err.message, 'error'); });

        function generate() {
            var value = normalizeUrl(urlInput.value).trim();
            if (!value) { toast('Nhập đường dẫn để tạo QR.', 'error'); return; }
            currentData = value;
            var img = document.createElement('img');
            img.alt = 'Mã QR cho ' + value;
            img.src = '/api/qr?size=512&data=' + encodeURIComponent(value);
            box.innerHTML = '';
            box.appendChild(img);
            echo.textContent = value;
            downloadBtn.disabled = false;
            copyBtn.disabled = false;
        }

        on($('#qr-form'), 'submit', function (e) { e.preventDefault(); generate(); });

        on(downloadBtn, 'click', function () {
            if (!currentData) return;
            var a = document.createElement('a');
            a.href = '/api/qr?size=1024&data=' + encodeURIComponent(currentData);
            a.download = 'xn-qr.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast('Đang tải mã QR.');
        });

        on(copyBtn, 'click', function () {
            if (!currentData) return;
            Xn.copyText(currentData).then(function () { toast('Đã sao chép liên kết.'); });
        });
    }

    /* ======================================================================
       Trang: analytics
       ====================================================================== */

    function deviceIcon(device) {
        return icon(device === 'mobile' ? 'phone' : device === 'tablet' ? 'tablet' : 'monitor');
    }

    function initAnalytics() {
        injectShell('analytics');

        (async function load() {
            var me = await requireAuth();
            if (!me) return;
            paintShell(me, null);
            var data = await api.getAnalytics();

            countUp($('#an-views'), data.totals.bioViews);
            countUp($('#an-unique'), data.totals.uniqueVisitors);
            countUp($('#an-linkclicks'), data.totals.linkClicks);
            countUp($('#an-shortclicks'), data.totals.shortClicks);

            // Chart 7 ngày
            var chart = $('#an-chart');
            var days = data.viewsHistory || [];
            var max = Math.max.apply(null, days.map(function (d) { return d.views; }).concat([1]));
            chart.innerHTML = days.map(function (d, idx) {
                var label = new Date(d.day + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short' }).slice(0, 2);
                var height = Math.max(4, Math.round((d.views / max) * 100));
                return '<div class="chart-col' + (idx === days.length - 1 ? ' is-today' : '') + '" title="' + d.views + ' lượt xem ngày ' + d.day + '">' +
                    '<div class="chart-bar" style="height:' + height + '%"></div><small>' + label + '</small></div>';
            }).join('');

            // Top links
            var top = $('#an-top');
            top.innerHTML = data.topLinks.length
                ? data.topLinks.map(function (l) {
                    return '<div class="an-item"><span class="ai-icon">' + icon(l.icon || 'link') + '</span>' +
                        '<span class="ai-label">' + escapeHtml(l.title) + '</span>' +
                        '<span class="ai-value">' + formatCount(l.clicks) + '</span></div>';
                }).join('')
                : '<p class="muted" style="font-size:.88rem;padding:8px 0">Chưa có liên kết nào được nhấp. Thêm liên kết trong Bio-link để bắt đầu.</p>';

            // Recent clicks
            var recent = $('#an-recent');
            recent.innerHTML = data.recentClicks.length
                ? data.recentClicks.map(function (c) {
                    var when = new Date(c.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                    return '<div class="an-item"><span class="ai-icon">' + deviceIcon(c.device) + '</span>' +
                        '<span class="ai-label">' + escapeHtml(c.label || 'Liên kết') + '</span>' +
                        '<span class="ai-meta">' + escapeHtml(c.referrer) + ' • ' + when + '</span></div>';
                }).join('')
                : '<p class="muted" style="font-size:.88rem;padding:8px 0">Chưa có lượt nhấp nào. Chia sẻ trang của bạn để nhận lượt truy cập đầu tiên!</p>';

            // Devices
            var devices = $('#an-devices');
            devices.innerHTML = data.devices.length
                ? data.devices.map(function (d) {
                    var label = d.device === 'mobile' ? 'Điện thoại' : d.device === 'tablet' ? 'Tablet' : 'Máy tính';
                    return '<span class="device-chip">' + deviceIcon(d.device) + label + ' <strong>' + formatCount(d.count) + '</strong></span>';
                }).join('')
                : '<span class="muted" style="font-size:.88rem">Chưa có dữ liệu thiết bị.</span>';

            // Referrers
            var refs = $('#an-referrers');
            var maxRef = Math.max.apply(null, data.referrers.map(function (r) { return r.count; }).concat([1]));
            refs.innerHTML = data.referrers.length
                ? data.referrers.map(function (r) {
                    var pct = Math.round((r.count / maxRef) * 100);
                    return '<div class="bar-row"><div class="bar-label"><strong>' + escapeHtml(r.referrer) + '</strong><span>' +
                        formatCount(r.count) + '</span></div>' +
                        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
                }).join('')
                : '<p class="muted" style="font-size:.88rem;padding:8px 0">Chưa có dữ liệu nguồn truy cập.</p>';
        })().catch(function (err) { toast(err.message, 'error'); });
    }

    /* ======================================================================
       Trang: settings
       ====================================================================== */

    var BACKGROUNDS = [
        { key: 'mist', label: 'Bầu trời', swatch: 'linear-gradient(140deg,#F5FAFF,#DBEEFC)' },
        { key: 'ink', label: 'Đêm', swatch: 'linear-gradient(140deg,#16243A,#0B1220)' },
        { key: 'dusk', label: 'Chạng vạng', swatch: 'linear-gradient(140deg,#1E1846,#0D0A20)' },
        { key: 'citrus', label: 'Vàng nắng', swatch: 'linear-gradient(140deg,#FFE7A8,#FFF6E4)' },
        { key: 'forest', label: 'Rừng', swatch: 'linear-gradient(140deg,#0E4636,#07231C)' },
        { key: 'rose', label: 'Hồng', swatch: 'linear-gradient(140deg,#FFC2D2,#FFF1F4)' }
    ];
    var BUTTON_STYLES = [
        { key: 'fill', label: 'Đặc' },
        { key: 'outline', label: 'Viền' },
        { key: 'soft', label: 'Nhẹ' },
        { key: 'glass', label: 'Kính mờ' }
    ];
    var FONTS = [
        { key: 'sans', label: 'Sans', stack: 'var(--font-sans)' },
        { key: 'serif', label: 'Seri', stack: 'var(--font-serif)' },
        { key: 'mono', label: 'Mono', stack: 'var(--font-mono)' },
        { key: 'round', label: 'Tròn', stack: 'var(--font-round)' }
    ];
    var ACCENTS = ['#0EA5E9', '#2563EB', '#06B6D4', '#6366F1', '#059669', '#0F172A'];

    function initSettings() {
        injectShell('settings');

        var me = null, profile = null;
        var draft = {
            username: '', email: '', displayName: '', bio: '', avatar: '',
            background: 'mist', buttonStyle: 'fill', font: 'sans', accent: '#0EA5E9',
            socials: {}
        };
        var dirty = false;
        var preview = $('#settings-preview');
        var saveBtn = $('#settings-save');
        var dirtyNote = $('#settings-dirty');
        var hydrated = false;

        (async function load() {
            var meData = await requireAuth();
            if (!meData) return;
            var data = await api.getProfile();
            me = data.user;
            profile = data.profile;

            draft.username = me.username;
            draft.email = me.email;
            draft.displayName = profile.displayName;
            draft.bio = profile.bio;
            draft.avatar = profile.avatarUrl;
            draft.background = profile.background;
            draft.buttonStyle = profile.buttonStyle;
            draft.font = profile.font;
            draft.accent = profile.accentColor;
            (data.socials || []).forEach(function (s) {
                var value = s.url;
                SOCIAL_FIELDS.forEach(function (f) {
                    if (value.indexOf('https://' + f.prefix) === 0) value = value.replace('https://' + f.prefix, '');
                });
                draft.socials[s.platform] = value.replace(/^@/, '');
            });

            paintShell(me, profile);
            hydrate();
            paintPreview();
            markDirty(false);
        })().catch(function (err) { toast(err.message, 'error'); });

        function paintPreview() {
            renderCanvas(preview, {
                username: draft.username || 'ten-cua-ban',
                displayName: draft.displayName,
                bio: draft.bio,
                avatar: draft.avatar,
                links: [],
                socials: draft.socials,
                appearance: {
                    background: draft.background,
                    buttonStyle: draft.buttonStyle,
                    font: draft.font,
                    accent: draft.accent
                }
            }, { showEmpty: true });
        }

        function markDirty(state) {
            dirty = state;
            dirtyNote.textContent = state ? 'Bạn có thay đổi chưa lưu.' : 'Mọi thay đổi đã được lưu.';
            saveBtn.disabled = !state;
        }

        function hydrate() {
            if (hydrated) return;
            hydrated = true;

            var sUsername = $('#set-username'),
                sName = $('#set-name'),
                sBio = $('#set-bio'),
                sBioCount = $('#set-bio-count'),
                sAvatar = $('#set-avatar'),
                sEmail = $('#set-email');

            sUsername.value = draft.username;
            sName.value = draft.displayName;
            sBio.value = draft.bio;
            sBioCount.textContent = draft.bio.length + '/140';
            sAvatar.src = draft.avatar || DEFAULT_AVATAR;
            sEmail.value = draft.email;
            $('#set-url').textContent = PUBLIC_HOST + '/user/' + draft.username;

            on(sUsername, 'input', function () {
                sUsername.value = sUsername.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
                draft.username = sUsername.value;
                $('#set-url').textContent = PUBLIC_HOST + '/user/' + (draft.username || 'ten-cua-ban');
                paintPreview(); markDirty(true);
            });
            on(sName, 'input', function () { draft.displayName = sName.value; paintPreview(); markDirty(true); });
            on(sBio, 'input', function () {
                draft.bio = sBio.value.slice(0, 140);
                sBioCount.textContent = draft.bio.length + '/140';
                paintPreview(); markDirty(true);
            });
            on($('#set-avatar-input'), 'change', function () {
                var file = this.files && this.files[0];
                if (!file) return;
                Xn.resizeImage(file, 320).then(function (dataUrl) {
                    draft.avatar = dataUrl;
                    sAvatar.src = dataUrl;
                    paintPreview(); markDirty(true);
                }).catch(function () { toast('Không đọc được ảnh này. Hãy thử ảnh JPG hoặc PNG.', 'error'); });
            });
            on($('#set-avatar-remove'), 'click', function () {
                draft.avatar = '';
                sAvatar.src = DEFAULT_AVATAR;
                paintPreview(); markDirty(true);
            });
            on(sEmail, 'input', function () { draft.email = sEmail.value.trim(); markDirty(true); });

            /* ---- Giao diện ---- */
            var bgGrid = $('#background-grid');
            bgGrid.innerHTML = BACKGROUNDS.map(function (bg) {
                return '<button type="button" class="option" data-bg="' + bg.key + '" aria-pressed="' +
                    (draft.background === bg.key) + '"><span class="swatch" style="background:' + bg.swatch + '"></span>' + bg.label + '</button>';
            }).join('');
            on(bgGrid, 'click', function (e) {
                var btn = e.target.closest('[data-bg]');
                if (!btn) return;
                draft.background = btn.dataset.bg;
                $$('[data-bg]', bgGrid).forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
                paintPreview(); markDirty(true);
            });

            var btnGrid = $('#button-grid');
            btnGrid.innerHTML = BUTTON_STYLES.map(function (b) {
                var sampleStyle = b.key === 'fill' ? 'background:var(--primary);color:var(--on-primary)'
                    : b.key === 'outline' ? 'border:1.5px solid var(--primary);color:var(--primary);background:transparent'
                    : b.key === 'soft' ? 'background:var(--primary-soft);color:var(--primary)'
                    : 'background:color-mix(in srgb,var(--primary) 12%,transparent);border-radius:999px;color:var(--text)';
                return '<button type="button" class="option" data-btnstyle="' + b.key + '" aria-pressed="' +
                    (draft.buttonStyle === b.key) + '"><span class="sample" style="' + sampleStyle + '">Liên kết</span>' + b.label + '</button>';
            }).join('');
            on(btnGrid, 'click', function (e) {
                var btn = e.target.closest('[data-btnstyle]');
                if (!btn) return;
                draft.buttonStyle = btn.dataset.btnstyle;
                $$('[data-btnstyle]', btnGrid).forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
                paintPreview(); markDirty(true);
            });

            var fontGrid = $('#font-grid');
            fontGrid.innerHTML = FONTS.map(function (f) {
                return '<button type="button" class="option" data-font="' + f.key + '" aria-pressed="' +
                    (draft.font === f.key) + '"><span class="sample" style="font-family:' + f.stack + '">Ag</span>' + f.label + '</button>';
            }).join('');
            on(fontGrid, 'click', function (e) {
                var btn = e.target.closest('[data-font]');
                if (!btn) return;
                draft.font = btn.dataset.font;
                $$('[data-font]', fontGrid).forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
                paintPreview(); markDirty(true);
            });

            var accentRow = $('#accent-row');
            var accentCustom = $('#accent-custom');
            accentRow.insertAdjacentHTML('afterbegin', ACCENTS.map(function (color) {
                return '<button type="button" class="accent-dot" data-accent="' + color + '" style="background:' + color +
                    '" aria-label="Màu nhấn ' + color + '" aria-pressed="' + (draft.accent === color) + '"></button>';
            }).join(''));
            accentCustom.value = draft.accent;

            function setAccent(color) {
                draft.accent = color;
                accentCustom.value = color;
                $$('[data-accent]', accentRow).forEach(function (b) {
                    b.setAttribute('aria-pressed', String(b.dataset.accent.toLowerCase() === color.toLowerCase()));
                });
                paintPreview(); markDirty(true);
            }
            on(accentRow, 'click', function (e) {
                var btn = e.target.closest('[data-accent]');
                if (btn) setAccent(btn.dataset.accent);
            });
            on(accentCustom, 'input', function () { setAccent(accentCustom.value); });

            /* Theme giao diện editor */
            $$('[data-theme-option]').forEach(function (btn) {
                btn.setAttribute('aria-pressed', String(btn.dataset.themeOption === Xn.getThemePref()));
                on(btn, 'click', function () {
                    Xn.setThemePref(btn.dataset.themeOption);
                    $$('[data-theme-option]').forEach(function (b) {
                        b.setAttribute('aria-pressed', String(b === btn));
                    });
                    toast('Đã chuyển giao diện.');
                });
            });

            /* ---- Bio-link: socials ---- */
            var socialWrap = $('#social-fields');
            socialWrap.innerHTML = SOCIAL_FIELDS.map(function (s) {
                return '<div class="social-row">' +
                    '<span class="badge">' + icon(s.key) + '</span>' +
                    '<span class="input-group"><span class="prefix">' + s.prefix + '</span>' +
                    '<input class="input" type="text" value="' + escapeHtml(draft.socials[s.key] || '') +
                    '" data-social="' + s.key + '" aria-label="Tên ' + s.label + '" placeholder="ten-nguoi-dung"></span>' +
                    '</div>';
            }).join('');
            on(socialWrap, 'input', function (e) {
                var input = e.target.closest('[data-social]');
                if (!input) return;
                var value = input.value.trim().replace(/^@/, '');
                if (value) draft.socials[input.dataset.social] = value;
                else delete draft.socials[input.dataset.social];
                paintPreview(); markDirty(true);
            });

            /* ---- Lưu hồ sơ + giao diện + socials ---- */
            on($('#settings-form'), 'submit', function (e) {
                e.preventDefault();

                var usernameError = checkUsername(draft.username);
                var emailError = checkEmail(draft.email);
                var nameError = draft.displayName.trim() ? '' : 'Trang của bạn cần một tên hiển thị.';

                if (usernameError) { setFieldState(sUsername, usernameError); $('[data-tab="profile"]').click(); sUsername.focus(); toast(usernameError, 'error'); return; }
                if (nameError) { setFieldState(sName, nameError); $('[data-tab="profile"]').click(); sName.focus(); return; }
                if (emailError) { setFieldState(sEmail, emailError); $('[data-tab="account"]').click(); sEmail.focus(); return; }
                setFieldState(sUsername, ''); setFieldState(sName, ''); setFieldState(sEmail, '');

                saveBtn.classList.add('is-loading');
                saveBtn.disabled = true;

                api.saveProfile({
                    username: draft.username.toLowerCase(),
                    email: draft.email,
                    displayName: draft.displayName.trim(),
                    bio: draft.bio,
                    avatar: draft.avatar,
                    background: draft.background,
                    buttonStyle: draft.buttonStyle,
                    font: draft.font,
                    accentColor: draft.accent,
                    socials: draft.socials
                }).then(function (data) {
                    me = data.user;
                    profile = data.profile;
                    draft.username = me.username;
                    draft.email = me.email;
                    paintShell(me, profile);
                    saveBtn.classList.remove('is-loading');
                    markDirty(false);
                    toast(data.message || 'Đã lưu thay đổi.');
                }).catch(function (err) {
                    saveBtn.classList.remove('is-loading');
                    saveBtn.disabled = false;
                    toast(err.message, 'error');
                });
            });

            on(window, 'beforeunload', function (e) {
                if (!dirty) return;
                e.preventDefault();
                e.returnValue = '';
            });

            /* ---- Bảo mật: đổi mật khẩu ---- */
            on($('#password-form'), 'submit', function (e) {
                e.preventDefault();
                var currentPw = $('#pw-current'), newPw = $('#pw-new');
                var ok = [
                    setFieldState(currentPw, currentPw.value ? '' : 'Nhập mật khẩu hiện tại.'),
                    setFieldState(newPw, checkPassword(newPw.value))
                ].every(Boolean);
                if (!ok) return;

                api.changePassword({ currentPassword: currentPw.value, newPassword: newPw.value })
                    .then(function (data) {
                        currentPw.value = '';
                        newPw.value = '';
                        toast(data.message || 'Đã đổi mật khẩu.');
                    })
                    .catch(function (err) { toast(err.message, 'error'); });
            });

            /* ---- Bảo mật: đăng xuất mọi thiết bị ---- */
            on($('#revoke-all'), 'click', function () {
                confirmDialog({
                    title: 'Đăng xuất mọi thiết bị?',
                    message: 'Mọi phiên đăng nhập (kể cả thiết bị này) sẽ kết thúc. Bạn sẽ phải đăng nhập lại.',
                    confirmLabel: 'Đăng xuất tất cả'
                }).then(function (yes) {
                    if (!yes) return;
                    api.revokeAll().then(function () { location.href = '/login'; })
                        .catch(function (err) { toast(err.message, 'error'); });
                });
            });

            /* ---- Bảo mật: xóa tài khoản ---- */
            on($('#delete-account'), 'click', function () {
                confirmDialog({
                    title: 'Xóa tài khoản Xn?',
                    message: 'Trang của bạn tại ' + PUBLIC_HOST + '/user/' + draft.username + ', mọi liên kết và đường dẫn rút gọn sẽ bị xóa vĩnh viễn.',
                    confirmLabel: 'Xóa tài khoản',
                    tone: 'danger'
                }).then(function (yes) {
                    if (!yes) return;
                    var password = prompt('Nhập mật khẩu để xác nhận xóa tài khoản:');
                    if (!password) return;
                    api.deleteAccount({ password: password })
                        .then(function () { location.href = '/'; })
                        .catch(function (err) { toast(err.message, 'error'); });
                });
            });

            /* ---- Thông báo: toggles lưu ngay qua API ---- */
            api.getPreferences().then(function (data) {
                var prefs = data.preferences || {};
                $$('[data-pref]').forEach(function (input) {
                    input.checked = !!prefs[input.dataset.pref];
                    on(input, 'change', function () {
                        var payload = {};
                        payload[input.dataset.pref] = input.checked;
                        api.savePreferences(payload).then(function (res) {
                            toast(res.message || 'Đã lưu tuỳ chọn.');
                        }).catch(function (err) {
                            input.checked = !input.checked;
                            toast(err.message, 'error');
                        });
                    });
                });
            }).catch(function () { });

            /* ---- Pháp lý: trạng thái đồng ý + export ---- */
            $('#legal-version').textContent = 'v1.0';
            $('#legal-accepted').textContent = 'Bạn đã đồng ý Điều khoản & Chính sách riêng tư (v1.0) khi tạo tài khoản.';
        }

        /* ---- Tabs ---- */
        $$('[data-tab]').forEach(function (tab) {
            on(tab, 'click', function () {
                $$('[data-tab]').forEach(function (t) { t.setAttribute('aria-selected', 'false'); });
                tab.setAttribute('aria-selected', 'true');
                $$('.settings-panel').forEach(function (panel) {
                    panel.hidden = panel.id !== 'panel-' + tab.dataset.tab;
                });
            });
        });
    }

    /* ======================================================================
       Boot theo data-page
       ====================================================================== */

    function boot() {
        switch (document.body.dataset.page) {
            case 'dashboard': initDashboard(); break;
            case 'shortlinks': initShortlinks(); break;
            case 'qr': initQr(); break;
            case 'analytics': initAnalytics(); break;
            case 'settings': initSettings(); break;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
