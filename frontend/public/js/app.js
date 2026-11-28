(() => {
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
let heroTimer;
const S = { profile: null, catalog: null, list: [], progress: {}, tab: 'home', byId: {} };

const art = i => i.poster ? `background-image:url('${esc(i.poster)}')`
  : `background:linear-gradient(160deg,hsl(${i.hue} 55% 32%),hsl(${(i.hue + 40) % 360} 60% 14%))`;
const heroArt = i => i.backdropHD || i.backdrop ? `background-image:url('${esc(i.backdropHD || i.backdrop)}')` : art(i);
const wide = i => i.backdrop ? `background-image:url('${esc(i.backdrop)}')` : art(i);
const reg = items => items.forEach(i => S.byId[i.id] = i);
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2800); }

/* ---------- auth ---------- */
function showAuth(mode = 'login') {
  const login = mode === 'login';
  app.innerHTML = `<main class="center"><div class="logo">NETFLIX</div>
  <form id="af"><h1>${login ? 'Sign in' : 'Create account'}</h1>
  ${login ? '' : '<label>Full name<input name="fullName" type="text" required maxlength="80" autocomplete="name"></label>'}
  <label>Email<input name="email" type="email" required autocomplete="email"></label>
  <label>Password<input name="password" type="password" required minlength="${login ? 1 : 8}" autocomplete="${login ? 'current-password' : 'new-password'}"></label>
  <p class="err" id="ae" role="alert"></p>
  <button class="btn primary">${login ? 'Sign in' : 'Create account'}</button>
  <p class="alt">${login ? 'New here? <a href="#" id="sw">Create an account</a>' : 'Already registered? <a href="#" id="sw">Sign in</a>'}</p></form></main>`;
  $('#sw').onclick = e => { e.preventDefault(); showAuth(login ? 'register' : 'login'); };
  $('#af').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    $('#ae').textContent = '';
    try {
      await API[mode](f.get('email'), f.get('password'), f.get('fullName'));
      showProfiles();
    } catch (x) {
      $('#ae').textContent = x.message;
    }
  };
}

/* ---------- profiles ---------- */
async function showProfiles() {
  let ps;
  try {
    ps = await API.profiles();
  } catch (e) {
    if (e.status === 401) return showAuth();
    app.innerHTML = `<main class="center"><p class="err">${esc(e.message)}</p><button class="btn" id="out">Sign out</button></main>`;
    $('#out').onclick = async () => { await API.logout(); showAuth(); };
    return;
  }
  app.innerHTML = `<main class="center"><div class="logo">NETFLIX</div><h1>Who is watching?</h1>
  <div class="pgrid">${ps.map(p => `<button class="pf" data-id="${esc(p.id)}"><span class="av" style="background:${esc(p.color)}">${esc((p.name || '?')[0].toUpperCase())}</span>${esc(p.name)}</button>`).join('')}
  ${ps.length < 5 ? `<button class="pf" id="addp"><span class="av add">+</span>Add profile</button>` : ''}</div>
  <button class="btn ghost" id="out">Sign out</button></main>`;
  app.querySelectorAll('.pf[data-id]').forEach(b => b.onclick = () => enter(ps.find(p => String(p.id) === b.dataset.id)));
  const add = $('#addp');
  if (add) add.onclick = async () => {
    const name = (prompt('Profile name') || '').trim();
    if (!name) return;
    try { await API.addProfile(name.slice(0, 30)); showProfiles(); } catch (e) { toast(e.message); }
  };
  $('#out').onclick = async () => { await API.logout(); showAuth(); };
}

async function enter(p) {
  S.profile = p; S.tab = 'home'; app.innerHTML = '<p class="loading">Loading your library…</p>';
  try {
    S.catalog = await API.catalog();
    const allItems = S.catalog.all || S.catalog.rows.flatMap(r => r.items);
    [S.list, S.progress] = await Promise.all([API.myList(p.id), API.progress(p.id, allItems)]);
  } catch (e) {
    app.innerHTML = `<main class="center"><p class="err">${esc(e.message)}</p><button class="btn" id="b">Back to profiles</button></main>`;
    $('#b').onclick = showProfiles;
    return;
  }
  S.catalog.rows.forEach(r => reg(r.items)); reg(S.list); Object.values(S.progress).forEach(x => reg([x.item]));
  renderShell(); renderMain();
}

/* ---------- browse ---------- */
function renderShell() {
  app.innerHTML = `<header class="nav"><div class="logo">NETFLIX</div>
  <nav><button data-tab="home">Home</button><button data-tab="list">My List</button></nav>
  <div class="tools"><div class="search"><button id="sb" aria-label="Search">⌕</button><input id="q" type="search" placeholder="Titles, genres" aria-label="Search titles"></div>
  <button class="av sm" id="me" style="background:${esc(S.profile.color)}" aria-label="Profile menu">${esc((S.profile.name || '?')[0].toUpperCase())}</button>
  <div class="menu" id="menu" hidden><button id="sub">Subscription</button><button id="sw">Switch profile</button><button id="lo">Sign out</button></div></div></header>
  <main id="main"></main>`;
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; $('#q').value = ''; renderMain(); });
  $('#sb').onclick = () => { $('.search').classList.toggle('open'); $('#q').focus(); };
  let t; $('#q').oninput = e => { clearTimeout(t); t = setTimeout(() => doSearch(e.target.value.trim()), 250); };
  $('#me').onclick = () => $('#menu').hidden = !$('#menu').hidden;
  $('#sub').onclick = () => { $('#menu').hidden = true; openSubscriptionModal(); };
  $('#sw').onclick = showProfiles;
  $('#lo').onclick = async () => { await API.logout(); showAuth(); };
}

const card = (i, pct) => `<button class="card" data-id="${esc(i.id)}" style="${art(i)}" aria-label="${esc(i.title)}">${i.poster ? '' : `<span class="ph">${esc(i.title)}</span>`}${pct ? `<i class="bar"><b style="width:${pct}%"></b></i>` : ''}</button>`;
const rowHTML = (name, html) => `<section class="row"><h2>${esc(name)}</h2><div class="rw"><button class="arrow l" aria-label="Scroll left">‹</button><div class="track">${html}</div><button class="arrow r" aria-label="Scroll right">›</button></div></section>`;

function renderMain() {
  clearInterval(heroTimer);
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  const m = $('#main');
  if (S.tab === 'list') {
    m.innerHTML = `<section class="grid-page"><h1>My List</h1>${S.list.length ? `<div class="grid">${S.list.map(i => card(i)).join('')}</div>` : '<p class="empty">Nothing saved yet. Open any title and choose “Add to My List”.</p>'}</section>`;
    return;
  }
  const feat = S.catalog.rows[0].items.slice(0, 5);
  const cont = Object.values(S.progress).filter(x => x.pct > 0 && x.pct < 95);
  m.innerHTML = `<section class="hero" id="hero"><div class="shade"></div><div class="hc"><div id="htx"><h1></h1><p></p></div>
    <div class="acts"><button class="btn primary" id="hp">▶ Play</button><button class="btn" id="hi">More info</button></div>
    <div class="dots">${feat.map((_, k) => `<button aria-label="Show featured title ${k + 1}" data-k="${k}"><i></i></button>`).join('')}</div></div></section>
    <div id="rows">${cont.length ? rowHTML('Continue watching', cont.map(x => card(x.item, x.pct)).join('')) : ''}
    ${S.list.length ? rowHTML('My List', S.list.map(i => card(i)).join('')) : ''}
    ${S.catalog.rows.map(r => rowHTML(r.name, r.items.map(i => card(i)).join(''))).join('')}</div>`;
  startHero(feat);
}

function startHero(feat) {
  const h = $('#hero'), tx = $('#htx'), DUR = 7000; let cur = -1, req = 0;
  const show = (k, first) => {
    const my = ++req, f = feat[k];
    const apply = () => {
      if (my !== req || !h.isConnected) return;
      const bg = document.createElement('div'); bg.className = 'hbg'; bg.style.cssText = heroArt(f);
      const old = [...h.querySelectorAll('.hbg')];
      if (!first) bg.style.transform = 'translateX(100%)';
      h.prepend(bg); bg.offsetWidth;
      bg.style.transform = '';
      old.forEach(o => { o.style.transform = 'translateX(-100%)'; setTimeout(() => o.remove(), 900); });
      const setText = () => { $('h1', tx).textContent = f.title; $('p', tx).textContent = f.overview; };
      if (first) setText(); else {
        tx.classList.add('out');
        setTimeout(() => { setText(); tx.classList.remove('out'); tx.classList.add('pre'); tx.offsetWidth; tx.classList.remove('pre'); }, 320);
      }
      $('#hp').dataset.play = f.id; $('#hi').dataset.info = f.id;
      const ds = [...h.querySelectorAll('.dots button')];
      ds.forEach(d => d.classList.remove('on', 'done')); h.offsetWidth;
      ds.forEach((d, j) => { if (j < k) d.classList.add('done'); if (j === k) d.classList.add('on'); });
      cur = k;
    };
    if (f.backdropHD || f.backdrop) { const im = new Image(); im.onload = im.onerror = apply; im.src = f.backdropHD || f.backdrop; } else apply();
  };
  h.style.setProperty('--dur', DUR + 'ms');
  h.querySelector('.dots').addEventListener('animationend', e => { if (e.target.parentElement.classList.contains('on')) show((cur + 1) % feat.length); });
  h.querySelectorAll('.dots button').forEach(d => d.onclick = () => show(+d.dataset.k));
  clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    if (!$('#hero')) return clearInterval(heroTimer);
    h.classList.toggle('paused', document.hidden || !!document.querySelector('.modal,.player'));
  }, 250);
  show(0, true);
}

async function doSearch(q) {
  clearInterval(heroTimer);
  if (!q) { S.tab = 'home'; return renderMain(); }
  const m = $('#main'); document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('on'));
  try {
    const res = await API.search(q); reg(res);
    if ($('#q').value.trim() !== q) return;
    m.innerHTML = `<section class="grid-page"><h1>Results for “${esc(q)}”</h1>${res.length ? `<div class="grid">${res.map(i => card(i)).join('')}</div>` : '<p class="empty">No titles match. Try a different title or genre.</p>'}</section>`;
  } catch (e) { toast(e.message); }
}

/* ---------- modal ---------- */
function openModal(i) {
  closeModal();
  const inList = S.list.some(x => x.id === i.id), pr = S.progress[i.id];
  const el = document.createElement('div'); el.className = 'modal'; el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(i.title)}">
    <div class="mh" style="${wide(i)}"><button class="x" aria-label="Close">✕</button></div>
    <div class="mb"><h2>${esc(i.title)}</h2>
    <p class="meta">${[i.year, i.rating ? '★ ' + i.rating : '', i.duration ? i.duration + ' min' : '', (i.genres || []).join(', ')].filter(Boolean).map(esc).join('   ')}</p>
    <p>${esc(i.overview)}</p>
    <div class="acts"><button class="btn primary" data-play="${esc(i.id)}">▶ ${pr && pr.pct > 0 && pr.pct < 95 ? 'Resume' : 'Play'}</button>
    <button class="btn" id="tl">${inList ? '✓ In My List' : '+ Add to My List'}</button></div></div></div>`;
  document.body.append(el); el.querySelector('.x').focus();
  el.onclick = e => { if (e.target === el || e.target.closest('.x')) closeModal(); };
  $('#tl', el).onclick = async () => {
    const add = !S.list.some(x => x.id === i.id);
    try { await API.setInList(S.profile.id, i, add); } catch (e) { return toast(e.message); }
    S.list = add ? [i, ...S.list] : S.list.filter(x => x.id !== i.id);
    toast(add ? 'Added to My List' : 'Removed from My List'); closeModal(); renderMainKeepSearch();
  };
}
const closeModal = () => document.querySelector('.modal')?.remove();
const renderMainKeepSearch = () => { if (!$('#q').value.trim()) renderMain(); };

/* ---------- subscription modal (Account & Billing) ---------- */
async function openSubscriptionModal(onSubscribed) {
  closeModal();
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Subscription">
    <div class="mb" style="padding-top:1.6rem"><button class="x" aria-label="Close">✕</button>
    <h2>Subscription</h2><p class="empty">Loading plans…</p></div></div>`;
  document.body.append(el);
  el.onclick = e => { if (e.target === el || e.target.closest('.x')) closeModal(); };

  try {
    const [plans, sub, methods] = await Promise.all([API.plans(), API.subscription(), API.paymentMethods()]);
    const active = sub && (sub.status === 'active' || sub.status === 'past_due');
    let selectedPlan = sub?.plan?.code || (plans[0] && plans[0].code);

    const mb = $('.mb', el);
    mb.innerHTML = `<button class="x" aria-label="Close">✕</button>
      <h2>${active ? 'Your Subscription' : 'Choose a Plan to Watch'}</h2>
      ${active ? `<p class="meta">Active plan: ${esc(sub.plan.name)} (${sub.plan.maxStreams} streams, ${esc(sub.plan.maxResolution)})</p>` : ''}
      ${plans.length ? `<div class="plans">${plans.map(pl => `
        <button type="button" class="plan ${pl.code === selectedPlan ? 'on' : ''}" data-code="${esc(pl.code)}">
          <strong>${esc(pl.name)}</strong>
          <span>${(pl.priceCents / 100).toFixed(2)} ${esc(pl.currency)} / mo</span>
          <small>${pl.maxStreams} stream(s) · ${esc(pl.maxResolution)}</small>
        </button>`).join('')}</div>` : '<p class="err">No plans found in PostgreSQL. Seed the plans table first.</p>'}
      ${active || !plans.length ? '' : `
        <form id="subf" class="subform">
          ${methods.length ? `<p class="meta">Using saved card: ${esc(methods[0].brand)} •••• ${esc(methods[0].last4)}</p>` : `
          <label>Cardholder name<input name="holderName" required value="${esc(S.profile.name || 'Demo User')}"></label>
          <label>Card number (test Visa)<input name="number" required value="4111111111111111"></label>
          <div class="row2">
            <label>Exp Month<input name="expMonth" type="number" min="1" max="12" required value="12"></label>
            <label>Exp Year<input name="expYear" type="number" min="2026" max="2045" required value="2028"></label>
            <label>CVC<input name="cvc" required value="123"></label>
          </div>`}
          <p class="err" id="se" role="alert"></p>
          <button class="btn primary">Activate Subscription</button>
        </form>`}`;

    mb.querySelectorAll('.plan').forEach(b => b.onclick = () => {
      selectedPlan = b.dataset.code;
      mb.querySelectorAll('.plan').forEach(x => x.classList.toggle('on', x === b));
    });

    const form = $('#subf', mb);
    if (form) form.onsubmit = async e => {
      e.preventDefault();
      $('#se', mb).textContent = '';
      try {
        let pmId = methods[0]?.id;
        if (!pmId) {
          const f = new FormData(form);
          const pm = await API.addPaymentMethod({
            holderName: f.get('holderName'),
            number: f.get('number'),
            expMonth: Number(f.get('expMonth')),
            expYear: Number(f.get('expYear')),
            cvc: f.get('cvc'),
            makeDefault: true
          });
          pmId = pm.id;
        }
        await API.subscribe(selectedPlan, pmId);
        toast('Subscription activated!');
        closeModal();
        if (onSubscribed) onSubscribed();
      } catch (err) {
        $('#se', mb).textContent = err.message;
      }
    };
  } catch (e) {
    $('.mb', el).innerHTML = `<button class="x" aria-label="Close">✕</button><h2>Subscription</h2><p class="err">${esc(e.message)}</p>`;
  }
}

/* ---------- player (creates real backend playback session + progress + stop) ---------- */
async function play(i) {
  closeModal();
  const baseDurSec = (i.duration || 60) * 60;
  let sessionId = null;
  try {
    const started = await API.startPlayback(S.profile.id, i, baseDurSec);
    sessionId = started?.session?.playbackSessionId || null;
  } catch (err) {
    if (err.code === 'subscription_required' || err.code === 'streaming_not_allowed') {
      toast(err.message);
      return openSubscriptionModal(() => play(i));
    }
    return toast(err.message);
  }

  const saved = S.progress[i.id]?.pct || 0;
  let pct = saved > 0 && saved < 95 ? saved : 0;
  let durSec = baseDurSec, on = true, timer, lastSent = 0, closed = false;

  const el = document.createElement('div');
  el.className = 'player';
  const hasVideo = !!i.video;
  el.innerHTML = `<button class="x" aria-label="Close player">✕</button>
  ${hasVideo ? `<video src="${esc(i.video)}" autoplay playsinline></video>` : `<div class="screen" style="${art(i)}"><h2>${esc(i.title)}</h2><p id="st">Playing via backend session</p></div>`}
  <div class="ctl">
    <div class="seekrow"><span id="tc" class="tm">0:00</span><input id="sk" type="range" min="0" max="100" step="0.1" value="${pct}" aria-label="Seek"><span id="td" class="tm">0:00</span></div>
    <div class="btns">
      <button id="pp" aria-label="Pause" title="Play / Pause (Space)">❚❚</button>
      <button id="bk" aria-label="Back 10 seconds" title="Back 10 s (J, or ← for 5 s)">↺ 10</button>
      <button id="fw" aria-label="Forward 10 seconds" title="Forward 10 s (L, or → for 5 s)">10 ↻</button>
      <span class="ttl">${esc(i.title)}</span>
      ${hasVideo ? '<button id="mu" aria-label="Mute" title="Mute (M)">🔊</button>' : ''}
      <button id="fs" aria-label="Fullscreen" title="Fullscreen (F)">⛶</button>
    </div>
  </div>`;
  document.body.append(el);

  const fmt = sec => {
    const t = Math.max(0, Math.floor(sec || 0)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };
  const showTime = () => {
    $('#tc', el).textContent = fmt((pct / 100) * durSec);
    $('#td', el).textContent = fmt(durSec);
  };

  const save = (force = false) => {
    const now = Date.now();
    if (!force && now - lastSent < 5500) return;
    lastSent = now;
    API.saveProgress(S.profile.id, i, Math.round(pct * 10) / 10, sessionId, durSec).catch(() => {});
  };

  const upd = () => {
    $('#sk', el).value = pct;
    showTime();
    if (pct >= 95) delete S.progress[i.id];
    else S.progress[i.id] = { item: i, pct };
  };

  const finishAndClose = (keepalive = false) => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('keydown', onKey);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const ended = pct >= 95;
    const posSec = (pct / 100) * durSec;
    if (ended) delete S.progress[i.id];
    else if (pct > 0) S.progress[i.id] = { item: i, pct };
    API.stopPlayback(sessionId, posSec, durSec, ended, keepalive).catch(() => {});
    if (!keepalive) { el.remove(); renderMainKeepSearch(); }
  };
  const onHide = () => finishAndClose(true);
  window.addEventListener('pagehide', onHide);

  /* ---- controls: play/pause, skip, mute, fullscreen, keyboard ---- */
  const v = $('video', el);
  const setPP = playing => {
    const b = $('#pp', el);
    b.textContent = playing ? '❚❚' : '▶';
    b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };
  const togglePlay = () => {
    if (v) { if (v.paused) { const r = v.play(); if (r && r.catch) r.catch(() => {}); } else v.pause(); }
    else { on = !on; setPP(on); }
  };
  const seekBy = sec => {
    if (v) {
      if (!v.duration) return;
      v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + sec));
    } else {
      pct = Math.min(100, Math.max(0, pct + (sec / durSec) * 100));
      upd();
    }
  };
  const toggleMute = () => {
    if (!v) return;
    v.muted = !v.muted;
    $('#mu', el).textContent = v.muted ? '🔇' : '🔊';
  };
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };
  const wire = (sel, fn) => {
    const b = $(sel, el);
    if (b) b.onclick = e => { fn(); e.currentTarget.blur(); };
  };
  wire('#pp', togglePlay); wire('#bk', () => seekBy(-10)); wire('#fw', () => seekBy(10));
  wire('#mu', toggleMute); wire('#fs', toggleFs);

  const onKey = e => {
    if (closed) return;
    if (e.target && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') togglePlay();
    else if (e.key === 'ArrowLeft') seekBy(-5);
    else if (e.key === 'ArrowRight') seekBy(5);
    else if (k === 'j') seekBy(-10);
    else if (k === 'l') seekBy(10);
    else if (k === 'm') toggleMute();
    else if (k === 'f') toggleFs();
    else return;
    e.preventDefault();
  };
  document.addEventListener('keydown', onKey);

  if (v) {
    v.onloadedmetadata = () => { if (v.duration) durSec = v.duration; v.currentTime = v.duration * pct / 100; showTime(); setPP(!v.paused); };
    v.ontimeupdate = () => { if (v.duration) { durSec = v.duration; pct = v.currentTime / v.duration * 100; upd(); save(); } };
    v.onplay = () => setPP(true);
    v.onpause = () => setPP(false);
    v.onclick = togglePlay;
    v.onended = () => { pct = 100; finishAndClose(); };
    $('#sk', el).oninput = e => { v.currentTime = v.duration * e.target.value / 100; };
  } else {
    timer = setInterval(() => {
      if (!on) return;
      pct = Math.min(100, pct + 0.5);
      upd();
      save();
      if (pct >= 100) { clearInterval(timer); $('#st', el).textContent = 'Finished'; }
    }, 1000);
    $('#sk', el).oninput = e => { pct = +e.target.value; upd(); };
  }
  showTime();
  $('.x', el).onclick = () => finishAndClose(false);
}

/* ---------- global events ---------- */
document.addEventListener('click', e => {
  const c = e.target.closest('.card'); if (c) return openModal(S.byId[c.dataset.id]);
  const p = e.target.closest('[data-play]'); if (p) return play(S.byId[p.dataset.play]);
  const n = e.target.closest('[data-info]'); if (n) return openModal(S.byId[n.dataset.info]);
  const a = e.target.closest('.arrow'); if (a) { const t = a.parentElement.querySelector('.track'); t.scrollBy({ left: (a.classList.contains('l') ? -1 : 1) * t.clientWidth * .8, behavior: 'smooth' }); }
  if (!e.target.closest('.tools')) { const m = $('#menu'); if (m) m.hidden = true; }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

(async () => { (await API.session()) ? showProfiles() : showAuth(); })();
})();