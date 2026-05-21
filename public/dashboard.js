// ---------------------------------------------------------------------------
// Agent dashboard client
// ---------------------------------------------------------------------------

let state = null;
let serverNowOffset = 0; // serverNow - clientNow, used so countdowns are correct
let currentSlotId = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function fmtRelative(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const now = Date.now() + serverNowOffset;
  const diff = (now - t) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtCountdown(expiresAt) {
  const now = Date.now() + serverNowOffset;
  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0) return { text: 'expired', cls: 'expired' };
  const total = Math.floor(remainingMs / 1000);
  const cls = total < 30 ? 'warn' : '';
  if (total < 60) return { text: `${total}s`, cls };
  if (total < 3600) return { text: `${Math.floor(total / 60)}m ${total % 60}s`, cls };
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return { text: `${h}h ${m}m`, cls };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function linkify(text) {
  return escapeHtml(text).replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

async function refresh() {
  state = await api('/api/state');
  serverNowOffset = new Date(state.stats.server_now).getTime() - Date.now();
  $('#offer-window').value = String(state.stats.offer_window_seconds);
  renderStats();
  renderSlots();
  renderArtists();
  renderNotifications();
  renderSms();
  if (currentSlotId) renderSlotModal(currentSlotId, /* reopen */ true);
}

function renderStats() {
  const s = state.stats;
  $('#stat-open').textContent = s.open_slots;
  $('#stat-pending').textContent = s.pending;
  $('#stat-confirmed').textContent = s.confirmed;
  $('#stat-onboarded').textContent = s.onboarded;
  $('#stat-not-onboarded').textContent = s.not_onboarded;

  // Proactive banner: alert about unfilled slots in next 7 days
  const upcoming = state.slots.filter((s) => {
    if (s.status === 'confirmed') return false;
    const days = (new Date(s.slot_date) - Date.now()) / 86400_000;
    return days <= 7 && days >= 0;
  });
  const banner = $('#banner');
  if (upcoming.length > 0) {
    banner.classList.remove('hidden');
    banner.textContent = `Heads up: ${upcoming.length} unfilled slot${upcoming.length === 1 ? '' : 's'} within the next 7 days.`;
  } else {
    banner.classList.add('hidden');
  }
}

function renderSlots() {
  const root = $('#slots-list');
  if (state.slots.length === 0) {
    root.innerHTML = '<div class="muted" style="padding:18px">No slots yet. Reset the demo data to seed a few.</div>';
    return;
  }
  root.innerHTML = state.slots.map((s) => {
    let bottom = '';
    if (s.current_offer) {
      const cd = fmtCountdown(s.current_offer.expires_at);
      bottom = `
        <div class="slot-current">
          <span>Offer with <strong>${escapeHtml(s.current_offer.artist_name)}</strong> · rank #${s.current_offer.rank}</span>
          <span class="countdown ${cd.cls}" data-expires="${s.current_offer.expires_at}">${cd.text}</span>
        </div>
      `;
    } else if (s.status === 'confirmed') {
      bottom = `<div class="slot-current"><span>Confirmed with <strong>${escapeHtml(s.confirmed_artist_name)}</strong></span></div>`;
    } else if (s.status === 'exhausted') {
      bottom = `<div class="slot-current"><span>Ranked list exhausted — needs manual intervention.</span></div>`;
    }
    return `
      <div class="slot-card" data-slot-id="${s.id}">
        <div class="slot-row">
          <div class="slot-info">
            <div class="slot-venue">${escapeHtml(s.venue_name)} <span class="muted">· ${escapeHtml(s.venue_location)}</span></div>
            <div class="slot-meta">
              ${fmtDate(s.slot_date)} · ${escapeHtml(s.start_time)}–${escapeHtml(s.end_time)} · £${s.fee} · ${escapeHtml(s.genre_required)}
              · ${escapeHtml(s.overture_slot_id)}
            </div>
          </div>
          <div><span class="status-pill status-${s.status}">${s.status.replace('_', ' ')}</span></div>
        </div>
        ${bottom}
      </div>
    `;
  }).join('');

  for (const el of $$('.slot-card')) {
    el.addEventListener('click', () => openSlotModal(parseInt(el.dataset.slotId, 10)));
  }
}

function renderArtists() {
  const root = $('#artists-list');
  root.innerHTML = state.artists.map((a) => {
    const status = a.onboarded
      ? `<span class="muted"><span class="dot on"></span>${escapeHtml(a.calendar_provider)}</span>`
      : `<span class="muted"><span class="dot off"></span>not onboarded</span>`;
    return `
      <div class="artist-row">
        <div>
          <div class="artist-name">${escapeHtml(a.name)}</div>
          <div class="artist-meta">${escapeHtml(a.genres)} · ${escapeHtml(a.location)} · £${a.fee_min}–£${a.fee_max}</div>
        </div>
        <div>${status}</div>
      </div>
    `;
  }).join('');
}

function renderNotifications() {
  const root = $('#notifications-list');
  if (state.notifications.length === 0) {
    root.innerHTML = '<div class="muted" style="padding:14px">Nothing yet.</div>';
    return;
  }
  root.innerHTML = state.notifications.map((n) => `
    <div class="note-row ${n.read_at ? '' : 'unread'}">
      <div class="note-kind">${escapeHtml(n.kind.replace('_', ' '))}</div>
      <div>${escapeHtml(n.message)}</div>
      <div class="note-time">${fmtRelative(n.created_at)}</div>
    </div>
  `).join('');
}

function renderSms() {
  const root = $('#sms-list');
  if (state.sms.length === 0) {
    root.innerHTML = '<div class="muted" style="padding:14px">No messages sent yet.</div>';
    return;
  }
  root.innerHTML = state.sms.map((m) => `
    <div class="sms-row">
      <div class="sms-head">
        <span class="sms-to">${escapeHtml(m.artist_name)} <span class="muted">(${escapeHtml(m.artist_phone)})</span></span>
        <span class="sms-time">${escapeHtml(m.kind)} · ${fmtRelative(m.sent_at)}</span>
      </div>
      <div class="sms-body">${linkify(m.body)}</div>
    </div>
  `).join('');
}

// ---------------------------------------------------------------------------
// Slot detail modal
// ---------------------------------------------------------------------------
async function openSlotModal(slotId) {
  currentSlotId = slotId;
  await renderSlotModal(slotId);
  $('#slot-modal').classList.remove('hidden');
}

function closeSlotModal() {
  $('#slot-modal').classList.add('hidden');
  currentSlotId = null;
}

async function renderSlotModal(slotId, reopen = false) {
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot) return closeSlotModal();

  const preview = await api(`/api/slots/${slotId}/preview`);
  const ranked = preview.ranked || [];

  $('#modal-title').textContent = `${slot.venue_name} · ${fmtDate(slot.slot_date)}`;

  const offerLines = (slot.offers || []).map((o) => `
    <div class="offer-line">
      <span>#${o.rank} <strong>${escapeHtml(o.artist_name)}</strong></span>
      <span class="offer-status-${o.status}">
        ${escapeHtml(o.status)}${o.response_at ? ' · ' + fmtRelative(o.response_at) : ''}
        ${o.status === 'pending' ? ' · expires ' + fmtCountdown(o.expires_at).text : ''}
      </span>
    </div>
  `).join('') || '<div class="muted">No offers sent yet.</div>';

  const rankedRows = ranked.length === 0
    ? '<tr><td colspan="3" class="muted">No available artists for this slot.</td></tr>'
    : ranked.map((r, i) => `
        <tr class="${i === 0 ? 'top' : ''}">
          <td>${i + 1}</td>
          <td>
            <div><strong>${escapeHtml(r.artist.name)}</strong></div>
            <div class="muted">${escapeHtml(r.artist.genres)} · ${escapeHtml(r.artist.location)} · £${r.artist.fee_min}–£${r.artist.fee_max}</div>
            <div class="breakdown">
              <span>genre ${Math.round(r.breakdown.genre)}</span>
              <span>fee ${Math.round(r.breakdown.fee)}</span>
              <span>history ${Math.round(r.breakdown.history)}</span>
              <span>location ${Math.round(r.breakdown.location)}</span>
            </div>
          </td>
          <td class="score">${r.score}</td>
        </tr>
      `).join('');

  const canFill = slot.status === 'unfilled' || slot.status === 'exhausted';
  const actions = `
    <div class="modal-actions">
      ${canFill ? '<button id="modal-fill" class="btn btn-primary">Fill this slot — send offer to top artist</button>' : ''}
      ${slot.status === 'confirmed' ? `<span class="muted">Confirmed with ${escapeHtml(slot.confirmed_artist_name)} · Overture booking ${escapeHtml(slot.overture_slot_id)}</span>` : ''}
    </div>
  `;

  $('#modal-body').innerHTML = `
    <p class="muted">
      ${escapeHtml(slot.venue_name)} · ${escapeHtml(slot.venue_location)} · £${slot.fee} ·
      ${escapeHtml(slot.start_time)}–${escapeHtml(slot.end_time)} · looking for <strong>${escapeHtml(slot.genre_required)}</strong>.
    </p>
    <p class="muted">
      Showing artists who are <strong>available</strong> based on live calendar sync, ranked by fit.
      Top match auto-receives the offer first; if they decline or don't respond, the next candidate is contacted automatically.
    </p>
    <table class="ranked-table">
      <thead><tr><th>Rank</th><th>Artist</th><th>Score</th></tr></thead>
      <tbody>${rankedRows}</tbody>
    </table>
    <div class="offer-history">
      <h4>Offer history</h4>
      ${offerLines}
    </div>
    ${actions}
  `;

  const fillBtn = $('#modal-fill');
  if (fillBtn) {
    fillBtn.addEventListener('click', async () => {
      fillBtn.disabled = true;
      fillBtn.textContent = 'Sending…';
      const result = await api(`/api/slots/${slotId}/fill`, { method: 'POST' });
      if (result.error) {
        alert(result.error);
      }
      await refresh();
    });
  }
}

// ---------------------------------------------------------------------------
// Live countdown ticking
// ---------------------------------------------------------------------------
setInterval(() => {
  for (const el of $$('.countdown[data-expires]')) {
    const cd = fmtCountdown(el.dataset.expires);
    el.textContent = cd.text;
    el.classList.remove('warn', 'expired');
    if (cd.cls) el.classList.add(cd.cls);
  }
}, 1000);

// Periodic full refresh
setInterval(refresh, 4000);

// ---------------------------------------------------------------------------
// Wire up controls
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  refresh();

  $('#send-onboarding').addEventListener('click', async () => {
    const result = await api('/api/artists/send-onboarding-batch', { method: 'POST' });
    if (result.count === 0) {
      alert('All artists are already onboarded.');
    } else {
      alert(`Generated ${result.count} onboarding messages. Open the SMS inbox panel to send them as the artist.`);
    }
    refresh();
  });

  $('#mark-read').addEventListener('click', async () => {
    await api('/api/notifications/mark-read', { method: 'POST' });
    refresh();
  });

  $('#reset-demo').addEventListener('click', async () => {
    if (!confirm('Reset demo data? All slots, offers, and onboarding state will be wiped.')) return;
    await api('/api/demo/reset', { method: 'POST' });
    refresh();
  });

  $('#offer-window').addEventListener('change', async (e) => {
    await api('/api/settings/offer-window', {
      method: 'POST',
      body: { seconds: parseInt(e.target.value, 10) },
    });
    refresh();
  });

  $('.modal-close').addEventListener('click', closeSlotModal);
  $('.modal-backdrop').addEventListener('click', closeSlotModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSlotModal();
  });
});
