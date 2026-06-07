/* THE ROOT MAP — interactive tracker */
(function () {
  'use strict';

  var STORE_KEY = 'rootmap.v1';
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MAX_SCORE = 100;

  /* ---------------------------------------------------------------- state */
  var state = load();

  function blankState() {
    return {
      archetype: null,
      baseline: { sp: 40, ph: 40, mn: 40 },
      week: 0,
      weeks: {},        // { weekIndex: { sourceId: [bool x7] | bool } }
      missions: {},     // { missionId: bool }   one-time onboarding bonuses
      scores: {},       // { weekIndex: { start:{sp,ph,mn}, end:{sp,ph,mn} } }
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return blankState();
      var s = JSON.parse(raw);
      return Object.assign(blankState(), s);
    } catch (e) {
      return blankState();
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ------------------------------------------------------------- helpers */
  function arch() { return ARCHETYPES[state.archetype]; }

  // Every trackable source for the current archetype = Tier One + specific.
  function allSources() { return TIER_ONE.concat(arch().sources); }

  function weekData(w) {
    if (!state.weeks[w]) state.weeks[w] = {};
    return state.weeks[w];
  }

  function weekScores(w) {
    if (!state.scores[w]) {
      state.scores[w] = { start: { sp: '', ph: '', mn: '' }, end: { sp: '', ph: '', mn: '' } };
    }
    return state.scores[w];
  }

  function getToggle(w, src) {
    var wd = weekData(w);
    if (src.freq === 'daily') {
      if (!Array.isArray(wd[src.id])) wd[src.id] = [false, false, false, false, false, false, false];
      return wd[src.id];
    }
    if (typeof wd[src.id] !== 'boolean') wd[src.id] = false;
    return wd[src.id];
  }

  // Sum XP earned in every pillar across all weeks + completed missions.
  function totalEarned() {
    var e = { sp: 0, ph: 0, mn: 0 };
    var srcs = allSources();
    Object.keys(state.weeks).forEach(function (w) {
      srcs.forEach(function (src) {
        var t = state.weeks[w][src.id];
        var count = 0;
        if (src.freq === 'daily') {
          if (Array.isArray(t)) count = t.filter(Boolean).length;
        } else if (t === true) {
          count = 1;
        }
        if (!count) return;
        for (var p in src.pts) e[p] += src.pts[p] * count;
      });
    });
    // one-time onboarding missions
    arch().missions.forEach(function (m) {
      if (state.missions[m.id]) {
        for (var p in m.xp) e[p] += m.xp[p];
      }
    });
    return e;
  }

  function weekEarned(w) {
    var e = { sp: 0, ph: 0, mn: 0 };
    allSources().forEach(function (src) {
      var t = weekData(w)[src.id];
      var count = 0;
      if (src.freq === 'daily') { if (Array.isArray(t)) count = t.filter(Boolean).length; }
      else if (t === true) count = 1;
      if (!count) return;
      for (var p in src.pts) e[p] += src.pts[p] * count;
    });
    return e;
  }

  function scores() {
    var e = totalEarned();
    return {
      sp: Math.min(MAX_SCORE, state.baseline.sp + e.sp),
      ph: Math.min(MAX_SCORE, state.baseline.ph + e.ph),
      mn: Math.min(MAX_SCORE, state.baseline.mn + e.mn),
      earned: e,
    };
  }

  function condMet(cond, sc) {
    if (cond.all != null) {
      return sc.sp >= cond.all && sc.ph >= cond.all && sc.mn >= cond.all;
    }
    for (var p in cond) { if (sc[p] < cond[p]) return false; }
    return true;
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function ptsLabel(pts) {
    return Object.keys(pts).map(function (p) {
      return '+' + pts[p] + ' ' + p.toUpperCase();
    }).join('  ');
  }

  /* ------------------------------------------------------------ rendering */
  var root = document.getElementById('app');

  function render() {
    if (!state.archetype) { renderOnboarding(); return; }
    root.innerHTML = '';
    root.appendChild(renderHeader());
    root.appendChild(renderPillars());
    root.appendChild(renderLevelUp());
    root.appendChild(renderTracker());
    root.appendChild(renderMissions());
    root.appendChild(renderUnlocks());
    root.appendChild(renderGuidance());
    root.appendChild(renderFooter());
    window.scrollTo(0, 0);
  }

  /* --- onboarding ------------------------------------------------------ */
  function renderOnboarding() {
    root.innerHTML = '';
    var wrap = el('div', 'onboard');
    wrap.appendChild(el('p', 'kicker', 'THE ROOT WORK'));
    wrap.appendChild(el('h1', 'display', 'The Root Map'));
    wrap.appendChild(el('p', 'subtitle', 'Your archetype cheat sheet, made playable. Choose your character and set your starting stats.'));

    var grid = el('div', 'arch-grid');
    ARCHETYPE_ORDER.forEach(function (key) {
      var a = ARCHETYPES[key];
      var card = el('button', 'arch-card');
      card.innerHTML = '<span class="arch-name">' + a.name + '</span>' +
        '<span class="arch-tag">' + a.tagline + '</span>' +
        '<span class="arch-bleed">' + a.bleed + '</span>';
      card.addEventListener('click', function () {
        state.archetype = key;
        // ensure a week exists
        weekData(0);
        save();
        render();
      });
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    root.appendChild(wrap);
  }

  /* --- header ---------------------------------------------------------- */
  function renderHeader() {
    var a = arch();
    var h = el('header', 'hero');
    h.innerHTML =
      '<p class="kicker">THE ROOT WORK · SELF SCALE</p>' +
      '<div class="hero-row">' +
        '<div>' +
          '<h1 class="display">' + a.name + '</h1>' +
          '<p class="subtitle">' + a.tagline + '</p>' +
        '</div>' +
        '<button class="ghost-btn" id="changeArch">Change archetype</button>' +
      '</div>' +
      '<div class="bleed-badge"><span>STAT BLEED</span>' + a.bleed + '</div>';
    h.querySelector('#changeArch').addEventListener('click', function () {
      if (confirm('Switch archetype? Your stats and history are kept, but the tracker shows the new archetype\'s practices.')) {
        state.archetype = null;
        render();
      }
    });
    return h;
  }

  /* --- pillar dashboard ------------------------------------------------ */
  function renderPillars() {
    var sc = scores();
    var sec = el('section', 'card');
    sec.appendChild(el('h2', 'sec-title', 'Self Scale'));
    sec.appendChild(el('p', 'sec-sub', 'Baseline + every XP point you have banked. Cap 100.'));
    var row = el('div', 'pillar-row');
    PILLARS.forEach(function (p) {
      var val = sc[p.key];
      var earned = sc.earned[p.key];
      var c = el('div', 'pillar pillar-' + p.key);
      c.innerHTML =
        '<div class="pillar-name">' + p.name + '</div>' +
        '<div class="pillar-val">' + val + '</div>' +
        '<div class="pillar-bar"><span style="width:' + val + '%"></span></div>' +
        '<div class="pillar-earned">' + (earned > 0 ? '+' + earned + ' earned' : 'no XP yet') + '</div>';
      row.appendChild(c);
    });
    sec.appendChild(row);
    return sec;
  }

  /* --- level up requirement ------------------------------------------- */
  function renderLevelUp() {
    var sc = scores();
    var need = arch().need;
    var sec = el('section', 'card');
    sec.appendChild(el('h2', 'sec-title', 'To level up you need'));
    var list = el('div', 'need-row');
    var allMet = true;
    Object.keys(need).forEach(function (p) {
      var target = need[p];
      var got = sc.earned[p];
      var done = got >= target;
      if (!done) allMet = false;
      var item = el('div', 'need-item' + (done ? ' met' : ''));
      var pct = Math.min(100, Math.round((got / target) * 100));
      item.innerHTML =
        '<div class="need-head"><span>' + PILLAR_NAME[p] + ' +' + target + '</span>' +
        '<span class="need-count">' + Math.min(got, target) + '/' + target + '</span></div>' +
        '<div class="mini-bar"><span style="width:' + pct + '%"></span></div>';
      list.appendChild(item);
    });
    sec.appendChild(list);
    var msg = el('p', 'need-msg' + (allMet ? ' ready' : ''),
      allMet ? '✦ Requirement met — you have levelled up.' : 'Raise your weakest required pillars through consistent practice.');
    sec.appendChild(msg);
    return sec;
  }

  /* --- weekly tracker -------------------------------------------------- */
  function renderTracker() {
    var sec = el('section', 'card');
    var head = el('div', 'tracker-head');
    head.innerHTML =
      '<div><h2 class="sec-title">Weekly Tracker</h2>' +
      '<p class="sec-sub">Mark each practice the day you complete it. Tier One is your passive base; the rest is your archetype\'s active XP.</p></div>';
    var nav = el('div', 'week-nav');
    nav.innerHTML =
      '<button class="ghost-btn" id="prevWeek">‹</button>' +
      '<span class="week-label">Week ' + (state.week + 1) + '</span>' +
      '<button class="ghost-btn" id="nextWeek">›</button>';
    head.appendChild(nav);
    sec.appendChild(head);

    sec.appendChild(buildTable('Tier One — Base Stats', TIER_ONE));
    sec.appendChild(buildTable(arch().name + ' — XP Sources', arch().sources));

    // weekly tally
    var we = weekEarned(state.week);
    var tally = el('div', 'tally');
    tally.innerHTML =
      '<div class="tally-cell"><span>Spiritual</span><b>+' + we.sp + '</b></div>' +
      '<div class="tally-cell"><span>Physical</span><b>+' + we.ph + '</b></div>' +
      '<div class="tally-cell"><span>Mental</span><b>+' + we.mn + '</b></div>' +
      '<div class="tally-cell total"><span>Total XP</span><b>+' + (we.sp + we.ph + we.mn) + '</b></div>';
    sec.appendChild(el('h3', 'mini-title', 'XP earned this week'));
    sec.appendChild(tally);

    sec.appendChild(buildScoreTable(state.week, we));

    sec.querySelector('#prevWeek').addEventListener('click', function () {
      if (state.week > 0) { state.week--; save(); render(); }
    });
    sec.querySelector('#nextWeek').addEventListener('click', function () {
      state.week++; weekData(state.week); save(); render();
    });
    return sec;
  }

  function buildTable(title, sources) {
    var wrap = el('div', 'table-wrap');
    wrap.appendChild(el('h3', 'mini-title', title));
    var table = el('table', 'tracker');
    var thead = '<thead><tr><th class="src-col">Practice</th>';
    DAYS.forEach(function (d) { thead += '<th>' + d + '</th>'; });
    thead += '<th class="pts-col">Pts</th></tr></thead>';
    table.innerHTML = thead;
    var tbody = el('tbody');

    sources.forEach(function (src) {
      var tr = el('tr');
      var label = '<div class="src-label">' + src.label + '</div>';
      if (src.detail) label += '<div class="src-detail">' + src.detail + '</div>';
      if (src.freq !== 'daily') {
        label += '<div class="src-freq">' + (src.freq === 'weekly' ? 'weekly' : 'one-off') + '</div>';
      }
      var td = el('td', 'src-col'); td.innerHTML = label; tr.appendChild(td);

      if (src.freq === 'daily') {
        var arr = getToggle(state.week, src);
        for (var d = 0; d < 7; d++) {
          tr.appendChild(dayCell(src, arr, d));
        }
      } else {
        var done = getToggle(state.week, src);
        var cell = el('td', 'wk-cell');
        cell.colSpan = 7;
        var btn = el('button', 'wk-btn' + (done ? ' on' : ''), done ? '✓ Done this week' : 'Mark done');
        btn.addEventListener('click', function () {
          var wd = weekData(state.week);
          wd[src.id] = !wd[src.id];
          save(); render();
        });
        cell.appendChild(btn);
        tr.appendChild(cell);
      }

      tr.appendChild(el('td', 'pts-col', ptsLabel(src.pts)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function dayCell(src, arr, d) {
    var td = el('td', 'day-cell');
    var b = el('button', 'dot' + (arr[d] ? ' on' : ''));
    b.setAttribute('aria-label', src.label + ' ' + DAYS[d]);
    b.addEventListener('click', function () {
      arr[d] = !arr[d];
      save();
      b.classList.toggle('on', arr[d]);
      // refresh derived numbers without full nav reset
      refreshDerived();
    });
    td.appendChild(b);
    return td;
  }

  // Self Scale score table — log your pillar scores at the start & end of a week.
  function buildScoreTable(w, we) {
    var svd = weekScores(w);
    var wrap = el('div', 'table-wrap');
    wrap.appendChild(el('h3', 'mini-title', 'Self Scale score'));

    var table = el('table', 'score-table');
    table.innerHTML =
      '<thead><tr><th></th><th>Spiritual</th><th>Physical</th><th>Mental</th><th>Total XP</th></tr></thead>';
    var tbody = el('tbody');

    // row 1: XP earned this week (auto)
    var r1 = el('tr', 'score-auto');
    r1.innerHTML =
      '<td class="score-label">XP earned this week</td>' +
      '<td>+' + we.sp + '</td><td>+' + we.ph + '</td><td>+' + we.mn + '</td>' +
      '<td class="score-total">+' + (we.sp + we.ph + we.mn) + '</td>';
    tbody.appendChild(r1);

    // rows 2 & 3: editable start / end
    tbody.appendChild(scoreInputRow('Self Scale score (start)', svd.start));
    tbody.appendChild(scoreInputRow('Self Scale score (end)', svd.end));

    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.appendChild(el('p', 'score-hint', 'Record your three pillar scores at the start and end of each week to watch your stats move over time.'));
    return wrap;
  }

  function scoreInputRow(label, store) {
    var tr = el('tr');
    tr.appendChild(el('td', 'score-label', label));
    PILLARS.forEach(function (p) {
      var td = el('td');
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.min = 0; inp.max = MAX_SCORE;
      inp.className = 'score-input';
      inp.value = (store[p.key] === 0 || store[p.key]) ? store[p.key] : '';
      inp.addEventListener('input', function () {
        var v = inp.value === '' ? '' : Math.max(0, Math.min(MAX_SCORE, parseInt(inp.value, 10) || 0));
        store[p.key] = v;
        save();
        updateScoreTotal(tr, store);
      });
      td.appendChild(inp);
      tr.appendChild(td);
    });
    var totalTd = el('td', 'score-total', scoreSum(store));
    tr.appendChild(totalTd);
    return tr;
  }

  function scoreSum(store) {
    var any = false, sum = 0;
    PILLARS.forEach(function (p) {
      if (store[p.key] === 0 || store[p.key]) { any = true; sum += Number(store[p.key]); }
    });
    return any ? String(sum) : '—';
  }

  function updateScoreTotal(tr, store) {
    var cell = tr.querySelector('.score-total');
    if (cell) cell.textContent = scoreSum(store);
  }

  // Light refresh of scores/tally/unlocks after a dot toggle (no scroll jump).
  function refreshDerived() {
    var sc = scores();
    PILLARS.forEach(function (p) {
      var pill = root.querySelector('.pillar-' + p.key);
      if (!pill) return;
      pill.querySelector('.pillar-val').textContent = sc[p.key];
      pill.querySelector('.pillar-bar span').style.width = sc[p.key] + '%';
      var e = sc.earned[p.key];
      pill.querySelector('.pillar-earned').textContent = e > 0 ? '+' + e + ' earned' : 'no XP yet';
    });
    // simplest correct path for the rest:
    var openWeek = state.week;
    // re-render tally + need + unlocks by full render is heavy; do targeted updates
    var we = weekEarned(openWeek);
    var cells = root.querySelectorAll('.tally .tally-cell b');
    if (cells.length === 4) {
      cells[0].textContent = '+' + we.sp;
      cells[1].textContent = '+' + we.ph;
      cells[2].textContent = '+' + we.mn;
      cells[3].textContent = '+' + (we.sp + we.ph + we.mn);
    }
    updateNeed(sc);
    updateUnlocks(sc);
  }

  function updateNeed(sc) {
    var need = arch().need;
    var items = root.querySelectorAll('.need-item');
    var keys = Object.keys(need);
    var allMet = true;
    items.forEach(function (item, i) {
      var p = keys[i];
      var target = need[p];
      var got = sc.earned[p];
      var done = got >= target;
      if (!done) allMet = false;
      item.classList.toggle('met', done);
      item.querySelector('.need-count').textContent = Math.min(got, target) + '/' + target;
      item.querySelector('.mini-bar span').style.width = Math.min(100, Math.round(got / target * 100)) + '%';
    });
    var msg = root.querySelector('.need-msg');
    if (msg) {
      msg.classList.toggle('ready', allMet);
      msg.textContent = allMet ? '✦ Requirement met — you have levelled up.' : 'Raise your weakest required pillars through consistent practice.';
    }
  }

  /* --- week one missions ---------------------------------------------- */
  function renderMissions() {
    var sec = el('section', 'card');
    sec.appendChild(el('h2', 'sec-title', 'Week One Missions'));
    sec.appendChild(el('p', 'sec-sub', 'Onboarding quests. Complete all three in your first seven days to build momentum. Each pays a one-time XP bonus.'));
    var list = el('div', 'mission-list');
    arch().missions.forEach(function (m) {
      var done = !!state.missions[m.id];
      var item = el('button', 'mission' + (done ? ' done' : ''));
      item.innerHTML =
        '<span class="check">' + (done ? '✓' : '') + '</span>' +
        '<span class="mission-label">' + m.label + '</span>' +
        '<span class="mission-xp">' + m.note + '</span>';
      item.addEventListener('click', function () {
        state.missions[m.id] = !state.missions[m.id];
        save(); render();
      });
      list.appendChild(item);
    });
    sec.appendChild(list);
    return sec;
  }

  /* --- unlock upgrades ------------------------------------------------- */
  function renderUnlocks() {
    var sc = scores();
    var sec = el('section', 'card');
    sec.appendChild(el('h2', 'sec-title', 'Unlock Upgrades'));
    sec.appendChild(el('p', 'sec-sub', 'Not rewards — the natural result of the stat changes. The upgrade names the change.'));
    var grid = el('div', 'unlock-grid');
    arch().unlocks.forEach(function (u) {
      var met = condMet(u.cond, sc);
      var c = el('div', 'unlock' + (met ? ' unlocked' : ''));
      c.innerHTML =
        '<div class="unlock-status">' + (met ? '✦ UNLOCKED' : '🔒 LOCKED') + '</div>' +
        '<div class="unlock-name">' + u.label + '</div>' +
        '<div class="unlock-cond">' + condText(u.cond) + '</div>';
      grid.appendChild(c);
    });
    sec.appendChild(grid);
    return sec;
  }

  function updateUnlocks(sc) {
    var cards = root.querySelectorAll('.unlock');
    arch().unlocks.forEach(function (u, i) {
      var met = condMet(u.cond, sc);
      var card = cards[i];
      if (!card) return;
      card.classList.toggle('unlocked', met);
      card.querySelector('.unlock-status').textContent = met ? '✦ UNLOCKED' : '🔒 LOCKED';
    });
  }

  function condText(cond) {
    if (cond.all != null) return 'All three pillars ' + cond.all + '+';
    return Object.keys(cond).map(function (p) {
      return PILLAR_NAME[p] + ' ' + cond[p];
    }).join(' + ');
  }

  /* --- guidance / mission notes --------------------------------------- */
  function renderGuidance() {
    var sec = el('section', 'card note-card');
    sec.appendChild(el('h2', 'sec-title', 'Mission Notes'));
    sec.appendChild(el('p', 'note-body', arch().note));
    sec.appendChild(el('h3', 'mini-title', 'How the XP system works'));
    var ul = el('ul', 'note-list');
    [
      'Tier One — Sleep, Movement, Breathwork — is active every day. It is your passive XP income; without it, archetype XP does not compound.',
      'Your archetype\'s sources are active income. The more consistently they run, the faster your stats move.',
      'Raise your weakest required pillar to its target to level up. The upgrade names the change in you — not the number.',
      'This is not a game you win once. The practices are permanent. The levels keep going.',
    ].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    sec.appendChild(ul);
    return sec;
  }

  /* --- footer ---------------------------------------------------------- */
  function renderFooter() {
    var f = el('footer', 'foot');
    f.innerHTML =
      '<p>The Root Map is the expansion to The Self Scale.</p>' +
      '<p><a href="https://therootcheck.netlify.app" target="_blank" rel="noopener">therootcheck.netlify.app</a> · Free diagnostic · The Root Work</p>';
    var tools = el('div', 'foot-tools');

    var exportBtn = el('button', 'foot-btn', 'Export progress');
    exportBtn.addEventListener('click', exportProgress);

    var importBtn = el('button', 'foot-btn', 'Import progress');
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) importProgress(fileInput.files[0]);
      fileInput.value = '';
    });
    importBtn.addEventListener('click', function () { fileInput.click(); });

    var reset = el('button', 'foot-btn danger', 'Reset all progress');
    reset.addEventListener('click', function () {
      if (confirm('Erase all stats, history and missions? This cannot be undone.')) {
        state = blankState();
        save();
        render();
      }
    });

    tools.appendChild(exportBtn);
    tools.appendChild(importBtn);
    tools.appendChild(reset);
    tools.appendChild(fileInput);
    f.appendChild(tools);
    return f;
  }

  /* --- export / import ------------------------------------------------- */
  function exportProgress() {
    var payload = JSON.stringify({ app: 'rootmap', version: 1, state: state }, null, 2);
    var blob = new Blob([payload], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'root-map-progress-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var incoming = data && data.state ? data.state : data; // accept raw state too
        if (!incoming || typeof incoming !== 'object' || !('baseline' in incoming)) {
          throw new Error('Unrecognised file');
        }
        if (!confirm('Replace your current progress with the imported file? This overwrites what is on this device.')) return;
        state = Object.assign(blankState(), incoming);
        save();
        render();
      } catch (e) {
        alert('Could not import that file — it does not look like a Root Map export.');
      }
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------- launch */
  render();
})();
