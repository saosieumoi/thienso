/**
 * kqxs-data.js — Thiên Số
 * Kết nối index.html / kqxs.html với Next.js API để hiển thị dữ liệu thật từ database.
 *
 * Cấu hình: khi serve từ Next.js thì dùng relative URL tự động.
 * Nếu mở file:// trực tiếp: đặt window.THIENSO_API = 'http://localhost:3000' trước script này.
 */
(function () {
    'use strict';

    // ── Cấu hình ─────────────────────────────────────────────────────────────
    // Cùng origin với Next.js → API_BASE = '' → fetch('/api/kqxs/xsmb') hoạt động
    const API_BASE = (typeof THIENSO_API !== 'undefined') ? THIENSO_API : '';

    // ── Nhãn giải thưởng ─────────────────────────────────────────────────────
    const PRIZE_LABELS = {
        DB: 'Đặc biệt', G1: 'Giải nhất', G2: 'Giải nhì', G3: 'Giải ba',
        G4: 'Giải tư', G5: 'Giải năm', G6: 'Giải sáu', G7: 'Giải bảy',
    };

    // Cấu hình bảng kết quả XSMB trong kqxs.html
    const MB_PRIZE_CONFIG = [
        { prize: 'DB', cls: 'rg-row rg-special', numCls: 'rg-num rg-special-num', numGridCls: '', label: 'Đặc biệt', noteType: 'db' },
        { prize: 'G1', cls: 'rg-row', numCls: 'rg-num', numGridCls: '', label: 'Giải nhất', note: '1 số' },
        { prize: 'G2', cls: 'rg-row', numCls: 'rg-num', numGridCls: 'rg-grid-2', label: 'Giải nhì', note: '2 số' },
        { prize: 'G3', cls: 'rg-row', numCls: 'rg-num', numGridCls: 'rg-grid-3', label: 'Giải ba', note: '6 số', noteCls: 'rg-count-multirow' },
        { prize: 'G4', cls: 'rg-row', numCls: 'rg-num rg-4digit', numGridCls: 'rg-grid-4', label: 'Giải tư', note: '4 số' },
        { prize: 'G5', cls: 'rg-row', numCls: 'rg-num rg-4digit', numGridCls: 'rg-grid-3', label: 'Giải năm', note: '6 số', noteCls: 'rg-count-multirow' },
        { prize: 'G6', cls: 'rg-row', numCls: 'rg-num rg-2digit', numGridCls: 'rg-grid-3', label: 'Giải sáu', note: '3 số' },
        { prize: 'G7', cls: 'rg-row rg-last', numCls: 'rg-num rg-2digit rg-g7', numGridCls: 'rg-grid-4', label: 'Giải bảy', note: '' },
    ];

    // XSMN/XSMT: giải hiển thị ở bảng tóm tắt (prize trong DB → nhãn UI)
    const MN_SUMMARY_PRIZES = [
        { dbPrize: 'G7', label: 'G8', cls: '' },
        { dbPrize: 'G6', label: 'G7', cls: '' },
        { dbPrize: 'G5', label: 'G6', cls: '' },
        { dbPrize: 'G4', label: 'G5', cls: '' },
        { dbPrize: 'DB', label: 'ĐB', cls: 'special-row' },
    ];

    // ── Helpers ───────────────────────────────────────────────────────────────
    function tail2(num) {
        return String(num).slice(-2);
    }

    function head2(num) {
        return String(num).slice(0, 2);
    }

    // Format số đặc biệt: "82736" → "82.736"
    function fmtDB(num) {
        if (!num || num.length < 4) return num;
        return num.slice(0, -3) + '.' + num.slice(-3);
    }

    // ── Fetch API ─────────────────────────────────────────────────────────────
    async function fetchJSON(path) {
        const res = await fetch(API_BASE + path);
        if (!res.ok) throw new Error('HTTP ' + res.status + ' từ ' + path);
        return res.json();
    }

    function fetchMB(date) {
        return fetchJSON('/api/kqxs/xsmb' + (date ? '?date=' + date : ''));
    }

    function fetchMN(date) {
        return fetchJSON('/api/kqxs/xsmn' + (date ? '?date=' + date : ''));
    }

    function fetchMT(date) {
        return fetchJSON('/api/kqxs/xsmt' + (date ? '?date=' + date : ''));
    }

    // ── Renderers: INDEX PAGE ─────────────────────────────────────────────────

    /** Render bảng kết quả XSMB kiểu classic trong index.html */
    function renderIndexMBBoard(data) {
        // Cập nhật tiêu đề ngày
        const dayLabel = document.getElementById('idx-day-label');
        if (dayLabel) dayLabel.textContent = data.dateLabel;

        // Ngày trên board header
        const boardDate = document.getElementById('idx-mb-board-date');
        if (boardDate && data.date) {
            const dp = data.date.split('-');
            const d = new Date(data.date);
            const dayName = d.toLocaleDateString('vi-VN', { weekday: 'long' });
            boardDate.textContent = dayName + ' - Ngày ' + dp[2] + '/' + dp[1] + '/' + dp[0];
        }

        // Nội dung bảng giải thưởng
        const body = document.getElementById('idx-mb-board-body');
        if (!body) return;

        if (!data.results || data.results.length === 0) return; // Giữ nguyên placeholder nếu chưa có data

        const BOARD_PRIZES = [
            { prize: 'DB', cls: 'prize-row prize-special', numCls: 'number special', gridCls: '' },
            { prize: 'G1', cls: 'prize-row', numCls: 'number', gridCls: '' },
            { prize: 'G2', cls: 'prize-row', numCls: 'number', gridCls: 'grid-2' },
            { prize: 'G3', cls: 'prize-row', numCls: 'number', gridCls: 'grid-3' },
            { prize: 'G4', cls: 'prize-row', numCls: 'number', gridCls: 'grid-4' },
            { prize: 'G5', cls: 'prize-row', numCls: 'number', gridCls: 'grid-3' },
            { prize: 'G6', cls: 'prize-row', numCls: 'number', gridCls: 'grid-3' },
            { prize: 'G7', cls: 'prize-row', numCls: 'number', gridCls: 'grid-4', last: true },
        ];

        const prizeMap = {};
        data.results.forEach(function (r) { prizeMap[r.prize] = r.numbers; });

        body.innerHTML = BOARD_PRIZES.map(function (cfg) {
            const nums = prizeMap[cfg.prize] || [];
            const numSpans = nums.map(function (n) {
                return '<span class="' + cfg.numCls + '" data-tail="' + tail2(n) + '">' + n + '</span>';
            }).join('');
            const gridCls = cfg.gridCls ? ' ' + cfg.gridCls : '';
            const style = cfg.last ? ' style="border-bottom:none;"' : '';
            return '<div class="' + cfg.cls + '"' + style + '>' +
                '<div class="prize-label">' + PRIZE_LABELS[cfg.prize] + '</div>' +
                '<div class="prize-numbers' + gridCls + '">' + numSpans + '</div>' +
                '</div>';
        }).join('');

        // Cập nhật bảng lô tô đầu-đuôi (#loto-mb)
        const lotoBoard = document.getElementById('loto-mb');
        if (lotoBoard && data.loto) {
            lotoBoard.querySelectorAll('.lt-row').forEach(function (row) {
                const head = parseInt(row.getAttribute('data-hover-head'));
                const tails = data.loto['head' + head] || [];
                const tailsDiv = row.querySelector('.lt-tails');
                if (tailsDiv) tailsDiv.textContent = tails.join(', ');
            });
        }
    }

    /** Render lưới đa đài XSMN/XSMT trong index.html */
    function renderIndexMultiGrid(gridId, data, summaryPrizes) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        const stations = data.stations || [];
        if (stations.length === 0) return;

        const numCols = stations.length;
        const colDef = '50px ' + Array(numCols).fill('1fr').join(' ');

        let html = '<div class="xsmn-header-row">' +
            '<div class="xsmn-hl">Giải</div>' +
            stations.map(function (s) { return '<div class="xsmn-hc">' + s.provinceName + '</div>'; }).join('') +
            '</div>';

        summaryPrizes.forEach(function (p) {
            const rowCls = p.cls ? 'xsmn-row ' + p.cls : 'xsmn-row';
            const cells = stations.map(function (s) {
                const result = s.results.find(function (r) { return r.prize === p.dbPrize; });
                const nums = result ? result.numbers : [];
                const isDB = p.dbPrize === 'DB';
                const spans = nums.map(function (n) {
                    return '<span class="number mn-num' + (isDB ? ' special' : '') + '" data-tail="' + tail2(n) + '">' + n + '</span>';
                }).join('<br>');
                return '<div class="xsmn-cell">' + spans + '</div>';
            }).join('');
            html += '<div class="' + rowCls + '"><div class="xsmn-lbl">' + p.label + '</div>' + cells + '</div>';
        });

        grid.style.gridTemplateColumns = colDef;
        grid.innerHTML = html;
    }

    // ── Renderers: KQXS PAGE ─────────────────────────────────────────────────

    /** Render bảng kết quả chi tiết XSMB trong kqxs.html */
    function renderKqxsMBResults(data) {
        // Cập nhật nhãn ngày trong tiêu đề
        const dayLabel = document.getElementById('xsmb-day-label');
        if (dayLabel) dayLabel.textContent = data.dateLabel;

        const grid = document.getElementById('xsmb-results-grid');
        if (!grid) return;

        if (!data.results || data.results.length === 0) return; // Giữ placeholder

        const prizeMap = {};
        data.results.forEach(function (r) { prizeMap[r.prize] = r.numbers; });

        // Giữ lại header row
        const headerRow = grid.querySelector('.rg-head');
        grid.innerHTML = '';
        if (headerRow) grid.appendChild(headerRow);

        MB_PRIZE_CONFIG.forEach(function (cfg) {
            const nums = prizeMap[cfg.prize] || [];
            const numSpans = nums.map(function (n) {
                return '<span class="' + cfg.numCls + '" data-tail="' + tail2(n) + '" data-full="' + n + '">' + n + '</span>';
            }).join('');
            const gridCls = cfg.numGridCls ? ' ' + cfg.numGridCls : '';

            let noteHtml;
            if (cfg.noteType === 'db' && nums[0]) {
                noteHtml = '<span class="rg-prize">Trúng Đuôi ' + tail2(nums[0]) + '</span>';
            } else {
                const noteCls = cfg.noteCls ? ' class="' + cfg.noteCls + '"' : '';
                noteHtml = '<span' + noteCls + '>' + (cfg.note || '') + '</span>';
            }

            const row = document.createElement('div');
            row.className = cfg.cls;
            row.innerHTML =
                '<div class="rg-label-col">' + cfg.label + '</div>' +
                '<div class="rg-nums-col' + gridCls + '">' + numSpans + '</div>' +
                '<div class="rg-count-col">' + noteHtml + '</div>';
            grid.appendChild(row);
        });

        // Cập nhật header tiêu đề lô tô với ngày
        if (data.date) {
            const dp = data.date.split('-');
            const lotoTitle = document.querySelector('.xsmb-loto-section .res-header-title');
            if (lotoTitle) lotoTitle.textContent = '🎯 Bảng lô tô XSMB — ' + dp[2] + '/' + dp[1] + '/' + dp[0];
        }
    }

    /** Render bảng lô tô 10×10 trong kqxs.html */
    function renderLotoMatrix(data) {
        const table = document.getElementById('loto-matrix-mb');
        if (!table || !data.lotoSet) return;

        const lotoSet = new Set(data.lotoSet);
        const dbResult = data.results && data.results.find(function (r) { return r.prize === 'DB'; });
        const specialTail = dbResult && dbResult.numbers[0] ? parseInt(tail2(dbResult.numbers[0])) : -1;

        table.querySelectorAll('.lm-cell').forEach(function (cell) {
            const num = parseInt(cell.getAttribute('data-num'));
            if (lotoSet.has(num)) {
                cell.classList.add('has-num');
                if (num === specialTail) cell.classList.add('lm-special');
                cell.textContent = String(num).padStart(2, '0');
            } else {
                cell.classList.remove('has-num', 'lm-special');
                cell.textContent = '';
            }
        });
    }

    /** Render bảng lịch sử 7 ngày trong kqxs.html */
    function renderHistory(data) {
        const tbody = document.getElementById('xsmb-history-tbody');
        if (!tbody || !data.history || data.history.length === 0) return;

        tbody.innerHTML = data.history.map(function (h, i) {
            const isToday = h.date === data.date;
            const dp = h.date.split('-');
            const dateStr = dp[2] + '/' + dp[1];
            const thu = h.dateLabel ? h.dateLabel.split(' ')[0] : '';
            return '<tr class="ht-row' + (isToday ? ' ht-today' : '') + '">' +
                '<td>' + dateStr + '</td>' +
                '<td>' + thu + '</td>' +
                '<td class="ht-special">' + (h.db ? fmtDB(h.db) : '—') + '</td>' +
                '<td><span class="ht-head">' + (h.head || '—') + '</span> – ' +
                '<span class="ht-tail">' + (h.tail || '—') + '</span></td>' +
                '<td>' + (h.g1 || '—') + '</td>' +
                '<td><button class="ht-dove-btn" data-db="' + (h.db || '') + '">Dò vé</button></td>' +
                '</tr>';
        }).join('');
    }

    /** Render thống kê nhanh (giải đặc biệt) trong kqxs.html */
    function renderQuickStats(data) {
        const dbResult = data.results && data.results.find(function (r) { return r.prize === 'DB'; });
        if (!dbResult || !dbResult.numbers[0]) return;
        const dbNum = dbResult.numbers[0];

        const specialNum = document.querySelector('.qstat-special-num');
        if (specialNum) specialNum.textContent = fmtDB(dbNum);

        const specialSub = document.querySelector('.special-stat .qstat-sub');
        if (specialSub) specialSub.textContent = 'Đuôi ' + tail2(dbNum) + ' · Đầu ' + head2(dbNum);
    }

    /** Render lưới đa đài XSMN/XSMT trong kqxs.html */
    function renderKqxsMultiGrid(gridId, dateElSelector, data, summaryPrizes) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        const stations = data.stations || [];
        if (stations.length === 0) return;

        const numCols = stations.length;
        const colDef = '50px ' + Array(numCols).fill('1fr').join(' ');

        let html = '<div class="xsmn-header-row">' +
            '<div class="xsmn-hl">Giải</div>' +
            stations.map(function (s) { return '<div class="xsmn-hc">' + s.provinceName + '</div>'; }).join('') +
            '</div>';

        summaryPrizes.forEach(function (p) {
            const rowCls = p.cls ? 'xsmn-row ' + p.cls : 'xsmn-row';
            const cells = stations.map(function (s) {
                const result = s.results.find(function (r) { return r.prize === p.dbPrize; });
                const nums = result ? result.numbers : [];
                const isDB = p.dbPrize === 'DB';
                const spans = nums.map(function (n) {
                    return '<span class="number mn-num' + (isDB ? ' special' : '') + '" data-tail="' + tail2(n) + '">' + n + '</span>';
                }).join('<br>');
                return '<div class="xsmn-cell">' + spans + '</div>';
            }).join('');
            html += '<div class="' + rowCls + '"><div class="xsmn-lbl">' + p.label + '</div>' + cells + '</div>';
        });

        grid.style.gridTemplateColumns = colDef;
        grid.innerHTML = html;

        // Cập nhật ngày trên board header
        if (dateElSelector && data.dateLabel) {
            const dateEl = document.querySelector(dateElSelector);
            if (dateEl) dateEl.textContent = data.dateLabel;
        }
    }

    // ── Navigation ngày ───────────────────────────────────────────────────────
    function updateDayNav(navId, selectedDate) {
        const nav = document.getElementById(navId);
        if (!nav) return;
        nav.querySelectorAll('[data-date]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-date') === selectedDate);
        });
    }

    // ── Load: trang index ─────────────────────────────────────────────────────
    async function loadIndexPage() {
        try {
            const [mbData, mnData, mtData] = await Promise.all([
                fetchMB(null),
                fetchMN(null),
                fetchMT(null),
            ]);
            renderIndexMBBoard(mbData);
            renderIndexMultiGrid('idx-xsmn-grid', mnData, MN_SUMMARY_PRIZES);
            renderIndexMultiGrid('idx-xsmt-grid', mtData, MN_SUMMARY_PRIZES.filter(function (p) {
                // XSMT summary: chỉ hiện G8, G7, ĐB
                return ['G7', 'G6', 'DB'].includes(p.dbPrize);
            }));
        } catch (e) {
            console.warn('[ThienSo] Không thể tải dữ liệu trang chủ:', e.message);
        }
    }

    // ── Load: trang kqxs ──────────────────────────────────────────────────────
    async function loadKqxsPage() {
        const params = new URLSearchParams(window.location.search);
        const loai = params.get('loai') || 'xsmb';
        const dateParam = params.get('date') || null;

        try {
            if (loai === 'xsmb') {
                const data = await fetchMB(dateParam);
                renderKqxsMBResults(data);
                renderLotoMatrix(data);
                renderHistory(data);
                renderQuickStats(data);
            } else if (loai === 'xsmn') {
                const data = await fetchMN(dateParam);
                renderKqxsMultiGrid(
                    'kqxs-xsmn-grid',
                    '#content-xsmn .board-date',
                    data,
                    MN_SUMMARY_PRIZES
                );
            } else if (loai === 'xsmt') {
                const data = await fetchMT(dateParam);
                renderKqxsMultiGrid(
                    'kqxs-xsmt-grid',
                    '#content-xsmt .board-date',
                    data,
                    MN_SUMMARY_PRIZES.filter(function (p) {
                        return ['G7', 'G6', 'DB'].includes(p.dbPrize);
                    })
                );
            }
        } catch (e) {
            console.warn('[ThienSo] Không thể tải dữ liệu kqxs:', e.message);
        }
    }

    // ── Detect trang và khởi động ─────────────────────────────────────────────
    function isIndexPage() {
        return !!document.getElementById('idx-day-nav');
    }

    function isKqxsPage() {
        return !!document.getElementById('xsmb-results-grid') ||
            !!document.getElementById('kqxs-xsmn-grid') ||
            !!document.getElementById('kqxs-xsmt-grid');
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (isIndexPage()) {
            loadIndexPage();
        } else if (isKqxsPage()) {
            loadKqxsPage();
        }
    });

})();
