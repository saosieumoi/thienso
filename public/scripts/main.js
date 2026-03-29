document.addEventListener('DOMContentLoaded', () => {
  // Intersection Observer for highlighting nav links
  const sections = document.querySelectorAll('.kq-section, .stat-section, .goiy-section, .dove-section, .lich-section, .info-section');
  const navLinks = document.querySelectorAll('.tb-nav .tb-link');

  const observerOptions = {
    root: null,
    rootMargin: '-80px 0px -60% 0px',
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + entry.target.id) {
            link.classList.add('active');
            // horizontal scroll into view for mobile nav
            const navContainer = document.querySelector('.tb-nav');
            if (window.innerWidth <= 768) {
              const linkRect = link.getBoundingClientRect();
              const containerRect = navContainer.getBoundingClientRect();
              if (linkRect.left < containerRect.left || linkRect.right > containerRect.right) {
                navContainer.scrollBy({ left: linkRect.left - containerRect.left - 20, behavior: 'smooth' });
              }
            }
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(sec => {
    if (sec.id) observer.observe(sec);
  });

  // Smooth scroll for nav links (fallback / explicit handler)
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetSec = document.querySelector(targetId);
      if (targetSec) {
        window.scrollTo({
          top: targetSec.offsetTop - 70, // offset for fixed header
          behavior: 'smooth'
        });
      }
    });
  });

  // Toggles & Tabs
  const tabs = document.querySelectorAll('.kq-tab');

  function switchTab(tabName) {
    if (!tabName) return;
    const tabNameUpper = tabName.toUpperCase();

    // Deactivate all
    tabs.forEach(t => t.classList.remove('active'));
    // Hide all matching content blocks
    document.querySelectorAll('[id^="content-"]').forEach(c => c.classList.add('hidden'));

    // Activate target tab button(s)
    tabs.forEach(t => {
      if (t.dataset.tab === tabName) t.classList.add('active');
    });

    // Activate target content
    const targetContent = document.getElementById(`content-${tabName}`);
    if (targetContent) {
      targetContent.classList.remove('hidden');
    } else if (tabName === 'xsmb' || tabName === 'xsmn' || tabName === 'xsmt') {
       // Fallback for index.html where these 3 are inside 'content-xskt'
       const xskt = document.getElementById('content-xskt');
       if (xskt) {
         xskt.classList.remove('hidden');
         // Also update the 'XSKT' tab as active
         tabs.forEach(t => { if (t.dataset.tab === 'xskt') t.classList.add('active'); });
       }
    }

    // --- DYNAMIC TEXT UPDATES ---
    // 1. Breadcrumb & Titles
    const breadcrumbCurrent = document.querySelector('.responsible-strip span:last-of-type');
    if (breadcrumbCurrent) {
      breadcrumbCurrent.textContent = `${tabNameUpper} — Thứ Hai 23/03/2026`;
    }

    // 2. Page Title (Tag)
    document.title = `Kết quả ${tabNameUpper} Thứ Hai 23/03/2026 — Thiên Số`;

    // 3. Side Column Header Updates
    const sideDoveTitle = document.querySelector('.sc-dove-title');
    if (sideDoveTitle) sideDoveTitle.textContent = `🔍 Dò vé nhanh — ${tabNameUpper}`;

    const sideLoganTitle = document.querySelector('.sc-lc-title');
    if (sideLoganTitle) sideLoganTitle.textContent = `❄️ Lô gan hôm nay — ${tabNameUpper}`;

    const aiBadge = document.querySelector('.sc-ai-badge');
    if (aiBadge) aiBadge.textContent = `AI Thiên Số — ${tabNameUpper}`;

    // 4. Sync active state in navigation menu
    document.querySelectorAll('.tb-nav .tb-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes('loai=')) {
        link.classList.toggle('active', href.includes(`loai=${tabName}`));
      }
    });

    // 5. Sync active state in sub-tab selector (kq-detail-tab)
    document.querySelectorAll('.kq-detail-tab').forEach(tab => {
      const href = tab.getAttribute('href');
      tab.classList.toggle('active', href && href.includes(`loai=${tabName}`));
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      // Sync URL without reloading
      const url = new URL(window.location);
      url.searchParams.set('loai', tabName);
      window.history.pushState({}, '', url);
      switchTab(tabName);
    });
  });

  // KQ Detail Sub-tabs (Breadcrumb selector)
  document.querySelectorAll('.kq-detail-tab').forEach(tab => {
    tab.addEventListener('click', function(e) {
      // If it's the same page, intercept and switch tab without reload
      const href = this.getAttribute('href');
      if (href.startsWith('kqxs.html')) {
        e.preventDefault();
        const loaiParam = new URLSearchParams(href.split('?')[1]).get('loai');
        if (loaiParam) {
          const url = new URL(window.location);
          url.searchParams.set('loai', loaiParam);
          window.history.pushState({}, '', url);
          switchTab(loaiParam);
        }
      }
    });
  });

  // Handle URL parameters (deep-linking)
  const urlParams = new URLSearchParams(window.location.search);
  const loai = urlParams.get('loai');
  if (loai) {
    switchTab(loai);
  }

  document.querySelectorAll('.goiy-opt').forEach(o => {
    o.addEventListener('click', function() {
      document.querySelectorAll('.goiy-opt').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // Mock API Loading Animation (from V1 UX)
  const highlights = document.querySelectorAll('.vl-jackpot, .kq-special');
  highlights.forEach(el => {
    const originalText = el.innerText;
    el.innerHTML = '<div class="loader-spin"></div>';
    setTimeout(() => {
      el.innerHTML = originalText;
      el.style.animation = 'fadeIn 0.5s ease';
    }, 1000 + Math.random() * 1500);
  });

  // --- UNIFIED RESULT RENDERING ---
  function updateBoardResults(board) {
    const radio = board.querySelector('input[name^="showed-digits"]:checked');
    const viewMode = radio ? radio.value : '0'; // '0', '2', '3'
    const activeDigitItem = board.querySelector('.digit-item.active');
    const activeDigit = activeDigitItem ? activeDigitItem.dataset.digit : null;

    const targetNumbers = board.querySelectorAll('.number, .mn-num');
    targetNumbers.forEach(num => {
      const full = num.dataset.full;
      let displayText = full;

      // 1. Length Filter
      if (viewMode !== '0') {
        const len = parseInt(viewMode, 10);
        displayText = (full.length > len) ? '...' + full.slice(-len) : full;
      }

      // 2. Digit Highlight (Only on last 2)
      const tail = full.slice(-2);
      if (activeDigit && tail.includes(activeDigit)) {
        // If display text is long enough to have the tail visible
        if (displayText.length >= 2) {
          const mainPart = displayText.slice(0, -2);
          const tailPart = displayText.slice(-2);
          num.innerHTML = `${mainPart}<span class="digit-hl-span">${tailPart}</span>`;
          num.classList.add('digit-highlight-parent');
        } else {
          // If only 1 digit is showing (edge case), just highlight it
          num.innerHTML = `<span class="digit-hl-span">${displayText}</span>`;
          num.classList.add('digit-highlight-parent');
        }
      } else {
        num.textContent = displayText;
        num.classList.remove('digit-highlight-parent');
      }
    });
  }

  // INIT FULL NUMBERS
  document.querySelectorAll('.number, .mn-num').forEach(n => {
    if (!n.dataset.full) n.dataset.full = n.textContent.trim();
  });

  // FILTER RADIOS
  const filterForms = document.querySelectorAll('.digits-form');
  filterForms.forEach(form => {
    const radios = form.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        const board = form.closest('.kq-classic-container') || form.closest('.kq-multi-container');
        if (board) updateBoardResults(board);
      });
    });
  });

  // QUICK DIGIT FILTER (0-9) - Single Selection
  const digitItems = document.querySelectorAll('.digit-item');
  digitItems.forEach(item => {
    item.addEventListener('click', () => {
      const parentRow = item.closest('.digit-list');
      const board = item.closest('.kq-classic-container') || item.closest('.kq-multi-container');

      if (item.classList.contains('active')) {
        item.classList.remove('active');
      } else {
        // Remove active from others in the same board
        parentRow.querySelectorAll('.digit-item').forEach(d => d.classList.remove('active'));
        item.classList.add('active');
      }

      if (board) updateBoardResults(board);
    });
  });

  // LOTO HOVER HIGHLIGHT (XSMB)
  const mbLtRows = document.querySelectorAll('#loto-mb .lt-row');
  const mbNumbers = document.querySelectorAll('.kq-classic-container .classic-board .number');
  mbLtRows.forEach(row => {
    row.addEventListener('mouseenter', () => {
      const head = row.getAttribute('data-hover-head');
      if (!head) return;
      row.style.backgroundColor = 'rgba(209, 72, 54, 0.1)';
      mbNumbers.forEach(num => {
        const tailStr = num.getAttribute('data-tail');
        if (tailStr && tailStr.length >= 2 && tailStr.charAt(0) === head) {
          num.classList.add('highlight-loto');
        }
      });
    });
    row.addEventListener('mouseleave', () => {
      row.style.backgroundColor = '';
      mbNumbers.forEach(num => num.classList.remove('highlight-loto'));
    });
  });

  // LOTO HOVER HIGHLIGHT MULTI-STATION (XSMN & XSMT)
  const multiLtRows = document.querySelectorAll('.xsmn-loto .lt-row-multi-header, .xsmn-loto .lt-row-multi, .xsmn-loto .xsmn-row');
  // Wait, I need to check the actual classes for the loto rows in XSMN/XSMT
  const multiLotoRows = document.querySelectorAll('.xsmn-loto .lt-row-multi');
  multiLotoRows.forEach(row => {
    row.addEventListener('mouseenter', () => {
      const head = row.getAttribute('data-hover-head');
      if (!head) return;

      const boardContainer = row.closest('.kq-multi-container');
      if (!boardContainer) return;

      const numbers = boardContainer.querySelectorAll('.multi-board .mn-num');
      numbers.forEach(num => {
        const val = num.dataset.full || num.textContent.trim();
        const tailStr = num.dataset.tail || val.slice(-2);
        if (tailStr && tailStr.length >= 2 && tailStr.slice(-2).charAt(0) === head) {
          num.classList.add('highlight-loto');
        }
      });
    });
    row.addEventListener('mouseleave', () => {
      const boardContainer = row.closest('.kq-multi-container');
      if (boardContainer) {
        boardContainer.querySelectorAll('.multi-board .mn-num').forEach(num => num.classList.remove('highlight-loto'));
      }
    });
  });
  // ── DAY NAV & DATE PICKER SYNC ──
  const dayBtns = document.querySelectorAll('.day-btn');
  const dnBtns = document.querySelectorAll('.dn-btn');
  const dayLabel = document.getElementById('xsmb-day-label');

  function syncDaySelection(date, dayText) {
    dayBtns.forEach(b => b.classList.toggle('active', b.dataset.date === date));
    dnBtns.forEach(b => b.classList.toggle('active', b.dataset.date === date));
    if (dayLabel && dayText) dayLabel.textContent = dayText;
  }

  dayBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const date = btn.dataset.date;
      const day = btn.dataset.day;
      const label = `Thứ ${day} ${date}/2026`;
      syncDaySelection(date, label);
    });
  });

  dnBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const date = btn.dataset.date;
      const span = btn.querySelector('span');
      const thu = span ? span.textContent.trim() : '';
      const label = thu === 'CN' ? `Chủ Nhật ${date}/2026` : `Thứ ${thu.replace('T','')} ${date}/2026`;
      syncDaySelection(date, label);
    });
  });

  // ── LOTO VIEW BUTTONS ──
  const lotoViewBtns = document.querySelectorAll('.loto-view-btn');
  lotoViewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      lotoViewBtns.forEach(b => b.classList.remove('loto-view-active'));
      btn.classList.add('loto-view-active');
    });
  });

  // ── LOTO MATRIX CELL CLICK: highlight row + col ──
  document.querySelectorAll('.lm-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const num = cell.dataset.num;
      if (!num) return;
      const head = parseInt(num[0]);
      const tail = parseInt(num[1]);
      // Highlight row (same head)
      document.querySelectorAll(`#loto-matrix-mb tr[data-head="${head}"] .lm-cell`).forEach(c => {
        c.style.background = '';
      });
      // Highlight col (same tail index col = tail+1 since first col is lm-head)
      document.querySelectorAll('#loto-matrix-mb .lm-cell').forEach(c => {
        c.style.background = '';
      });
      const row = cell.closest('tr');
      if (row) {
        row.querySelectorAll('.lm-cell').forEach(c => c.style.background = 'rgba(220,38,38,0.06)');
      }
      cell.style.background = 'rgba(220,38,38,0.18)';
    });
  });

});  // end DOMContentLoaded

// ── DÒ VÉ NHANH ──
const XSMB_RESULTS_TODAY = [
  '82736', // Đặc biệt
  '19284', // Giải nhất
  '47291', '83746', // Giải nhì
  '28453', '91378', '46382', '55818', '73264', '19047', // Giải ba
  '2847', '9173', '4628', '7385', // Giải tư
  '284', '917', '463', '551', '738', '190', // Giải năm
  '28', '91', '46', // Giải sáu
  '72', '38'  // Giải bảy
];

function doVe() {
  const input = document.getElementById('doveInput');
  const resultEl = document.getElementById('doveResult');
  if (!input || !resultEl) return;

  const query = input.value.trim().replace(/\D/g, '');
  if (!query || query.length < 2) {
    resultEl.className = 'sc-dove-result miss';
    resultEl.textContent = '⚠️ Vui lòng nhập ít nhất 2 chữ số.';
    resultEl.style.display = 'block';
    return;
  }

  const hits = XSMB_RESULTS_TODAY.filter(n => n.endsWith(query));
  resultEl.style.display = 'block';
  if (hits.length > 0) {
    resultEl.className = 'sc-dove-result hit';
    resultEl.innerHTML = `🎉 <b>Trúng! Số "${query}" khớp:</b><br>${hits.map(h => `• ${h}`).join('<br>')}`;
  } else {
    resultEl.className = 'sc-dove-result miss';
    resultEl.textContent = `😔 Số "${query}" không khớp với bất kỳ giải nào hôm nay.`;
  }
}

// ── AI HỎI ĐÁP (DEMO) ──
const AI_ANSWERS = {
  '36': 'Số <b>36</b> về <b>4 lần trong 10 ngày qua</b> — đang trong chu kỳ nóng. Hay về Thứ 2 và Thứ 5. Xác suất về trong 3 ngày tới: ~65% theo chu kỳ lịch sử.',
  '72': 'Số <b>72</b> đã vắng <b>38 kỳ liên tiếp</b> — thuộc nhóm gan dài nhất tháng 3. Theo lịch sử, số gan trên 30 kỳ thường hồi phục mạnh.',
  'db': 'Đặc biệt hôm nay <b>82.736</b>. Đầu 82 xuất hiện lần đầu sau 45 ngày. Đuôi 36 đang hot.',
  'default': 'Thiên Số AI đang phân tích dữ liệu 20 năm cho câu hỏi của bạn. Tính năng đầy đủ sẽ ra mắt sớm — hãy đăng ký để được thử nghiệm miễn phí!'
};

function handleAiAsk() {
  const input = document.getElementById('aiInput');
  const resultEl = document.getElementById('aiResult');
  if (!input || !resultEl) return;

  const q = input.value.toLowerCase();
  let answer = AI_ANSWERS.default;

  if (q.includes('36')) answer = AI_ANSWERS['36'];
  else if (q.includes('72')) answer = AI_ANSWERS['72'];
  else if (q.includes('đặc biệt') || q.includes('db') || q.includes('special')) answer = AI_ANSWERS['db'];

  resultEl.innerHTML = `🤖 <b>AI Thiên Số:</b><br>${answer}`;
  resultEl.style.display = 'block';
}

// Allow Enter key on inputs
document.addEventListener('DOMContentLoaded', () => {
  const doveIn = document.getElementById('doveInput');
  if (doveIn) doveIn.addEventListener('keydown', e => { if (e.key === 'Enter') doVe(); });

  const aiIn = document.getElementById('aiInput');
  if (aiIn) aiIn.addEventListener('keydown', e => { if (e.key === 'Enter') handleAiAsk(); });
});
