/* Data layer anchored to Zuul (http://localhost:8080) -> account-service (:5001) & streaming-playback-service (:5002).
   Catalog & Search use local movies.js (or TMDB if TMDB_KEY is set). My List is stored per profile ID in localStorage. */
const CONFIG = {
  USE_SERVER: true,
  GATEWAY: 'http://localhost:8080',
  TMDB_KEY: '',
  TMDB_IMG: 'https://image.tmdb.org/t/p/'
};

const LS = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const uid = () => Math.random().toString(36).slice(2, 9);
const COLORS = ['#E50914', '#3b82e2', '#e2a13b', '#3bb273', '#9b5de5'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractError(data, status) {
  const errObj = data && typeof data.error === 'object' ? data.error : null;
  if (errObj) {
    const details = Array.isArray(errObj.details) && errObj.details.length
      ? errObj.details.map(d => d.message).filter(Boolean).join(', ')
      : '';
    const err = new Error(details || errObj.message || 'Request failed (' + status + ')');
    err.code = errObj.code;
    err.status = status;
    return err;
  }
  const msg = (data && typeof data.error === 'string' && data.error) || 'Request failed (' + status + ')';
  const err = new Error(msg);
  err.status = status;
  return err;
}

let refreshing = null;
async function tryRefreshToken() {
  if (refreshing) return refreshing;
  const refreshToken = LS.get('refreshToken', null);
  if (!refreshToken) return false;
  refreshing = (async () => {
    try {
      const r = await fetch(CONFIG.GATEWAY + '/api/users/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (!r.ok) {
        LS.set('token', null);
        LS.set('refreshToken', null);
        return false;
      }
      const data = await r.json();
      LS.set('token', data.accessToken);
      LS.set('refreshToken', data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function http(path, opt = {}, retried = false) {
  const token = LS.get('token', null);
  const r = await fetch(CONFIG.GATEWAY + path, {
    method: opt.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
    keepalive: !!opt.keepalive
  });

  if (r.status === 401 && !retried && !opt.skipRefresh && await tryRefreshToken()) {
    return http(path, opt, true);
  }
  if (r.status === 204) return null;

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw extractError(data, r.status);
  return data;
}

/* ---------- catalog sources ---------- */
async function tmdb(path) {
  const r = await fetch('https://api.themoviedb.org/3' + path + (path.includes('?') ? '&' : '?') + 'api_key=' + CONFIG.TMDB_KEY);
  if (!r.ok) throw new Error('TMDB request failed');
  return (await r.json()).results || [];
}

const fromTmdb = m => ({
  id: 't' + m.id, title: m.title, year: (m.release_date || '').slice(0, 4), genres: [],
  rating: Math.round(m.vote_average * 10) / 10, overview: m.overview || '',
  poster: m.poster_path && CONFIG.TMDB_IMG + 'w500' + m.poster_path,
  backdrop: m.backdrop_path && CONFIG.TMDB_IMG + 'w1280' + m.backdrop_path,
  backdropHD: m.backdrop_path && CONFIG.TMDB_IMG + 'original' + m.backdrop_path,
  hue: (m.id * 37) % 360, duration: null, video: null
});

async function tmdbCatalog() {
  const defs = [
    ['Trending now', '/trending/movie/week'], ['Top rated', '/movie/top_rated'],
    ['Action', '/discover/movie?with_genres=28'], ['Comedy', '/discover/movie?with_genres=35'],
    ['Sci-Fi', '/discover/movie?with_genres=878'], ['Horror', '/discover/movie?with_genres=27']
  ];
  const rows = await Promise.all(defs.map(async ([name, p]) => ({ name, items: (await tmdb(p)).map(fromTmdb) })));
  return { rows };
}

async function localCatalog() {
  const all = window.MOVIES || [];
  const rows = [{ name: 'Trending now', items: all.filter(m => m.trending) }];
  ['Sci-Fi', 'Drama', 'Comedy', 'Thriller', 'Documentary'].forEach(g =>
    rows.push({ name: g, items: all.filter(m => m.genres.includes(g)) })
  );
  return { rows, all };
}

/* ---------- mock user store (only used when USE_SERVER is false) ---------- */
const mock = {
  users: () => LS.get('users', {}),
  pdata: id => LS.get('p:' + id, { list: [], progress: {} }),
  email: () => LS.get('session', null)
};

const withColor = (p, idx = 0) => ({ ...p, color: p.color || COLORS[idx % COLORS.length] });

const API = {
  /* Account & Billing service -> /api/users/* (port 5001 via Zuul) */
  async session() {
    if (CONFIG.USE_SERVER) {
      if (!LS.get('token', null) && !LS.get('refreshToken', null)) return null;
      try { return (await http('/api/users/me')).user; } catch { return null; }
    }
    const e = mock.email();
    return e && mock.users()[e] ? { email: e } : null;
  },

  async register(email, password, fullName) {
    if (CONFIG.USE_SERVER) {
      const r = await http('/api/users/register', {
        method: 'POST',
        body: { email, password, fullName },
        skipRefresh: true
      });
      LS.set('token', r.accessToken);
      LS.set('refreshToken', r.refreshToken);
      return r.user;
    }
    const u = mock.users(); email = email.toLowerCase();
    if (u[email]) throw new Error('That email already has an account. Sign in instead.');
    u[email] = { password, profiles: [{ id: uid(), name: (fullName || email.split('@')[0]), color: COLORS[0] }] };
    LS.set('users', u); LS.set('session', email);
    return { email };
  },

  async login(email, password) {
    if (CONFIG.USE_SERVER) {
      const r = await http('/api/users/login', {
        method: 'POST',
        body: { email, password },
        skipRefresh: true
      });
      LS.set('token', r.accessToken);
      LS.set('refreshToken', r.refreshToken);
      return r.user;
    }
    const u = mock.users()[email.toLowerCase()];
    if (!u || u.password !== password) throw new Error('Email or password is incorrect.');
    LS.set('session', email.toLowerCase());
    return { email };
  },

  async logout() {
    if (CONFIG.USE_SERVER && LS.get('token', null)) {
      await http('/api/users/logout', { method: 'POST', skipRefresh: true }).catch(() => {});
    }
    LS.set('session', null);
    LS.set('token', null);
    LS.set('refreshToken', null);
  },

  async profiles() {
    if (CONFIG.USE_SERVER) {
      const res = await http('/api/users/me/profiles');
      return (res.profiles || []).map((p, idx) => withColor(p, idx));
    }
    return mock.users()[mock.email()].profiles;
  },

  async addProfile(name) {
    if (CONFIG.USE_SERVER) {
      const res = await http('/api/users/me/profiles', { method: 'POST', body: { name } });
      return withColor(res.profile, Math.floor(Math.random() * COLORS.length));
    }
    const u = mock.users(), me = u[mock.email()];
    const p = { id: uid(), name, color: COLORS[me.profiles.length % COLORS.length] };
    me.profiles.push(p); LS.set('users', u);
    return p;
  },

  /* Billing & Entitlement -> /api/users/plans, /api/users/me/* */
  async plans() {
    if (!CONFIG.USE_SERVER) return [];
    return (await http('/api/users/plans')).plans || [];
  },
  async subscription() {
    if (!CONFIG.USE_SERVER) return { status: 'active' };
    return (await http('/api/users/me/subscription')).subscription;
  },
  async entitlement() {
    if (!CONFIG.USE_SERVER) return { entitled: true };
    return (await http('/api/users/me/entitlement')).entitlement;
  },
  async paymentMethods() {
    if (!CONFIG.USE_SERVER) return [];
    return (await http('/api/users/me/payment-methods')).paymentMethods || [];
  },
  async addPaymentMethod(card) {
    return (await http('/api/users/me/payment-methods', { method: 'POST', body: card })).paymentMethod;
  },
  async subscribe(planCode, paymentMethodId) {
    return http('/api/users/me/subscription', {
      method: 'POST',
      body: { planCode, ...(paymentMethodId && { paymentMethodId }) }
    });
  },

  /* Catalog & Search (local movies.js or TMDB until backend adds /api/catalog) */
  async catalog() {
    if (CONFIG.TMDB_KEY) return tmdbCatalog();
    return localCatalog();
  },

  async search(q) {
    if (CONFIG.TMDB_KEY) return (await tmdb('/search/movie?query=' + encodeURIComponent(q))).map(fromTmdb);
    const { all } = await localCatalog(), s = q.toLowerCase();
    return all.filter(m => (m.title + ' ' + m.genres.join(' ') + ' ' + m.overview).toLowerCase().includes(s));
  },

  /* My List (client-side per profile ID until backend adds /my-list) */
  async myList(pid) {
    return mock.pdata(pid).list;
  },
  async setInList(pid, item, add) {
    const d = mock.pdata(pid);
    d.list = d.list.filter(x => x.id !== item.id);
    if (add) d.list.unshift(item);
    LS.set('p:' + pid, d);
  },

  /* Streaming & Playback -> /api/streaming/playback/* (port 5002 via Zuul) */
  async progress(pid, catalogItems = []) {
    if (!CONFIG.USE_SERVER) return mock.pdata(pid).progress;

    const res = await http('/api/streaming/playback/continue-watching');
    const byId = new Map((catalogItems.length ? catalogItems : (window.MOVIES || [])).map(m => [String(m.id), m]));
    const out = {};

    for (const entry of (res.items || [])) {
      if (entry.profileId && entry.profileId !== pid) continue;
      const item = byId.get(String(entry.videoId));
      if (!item) continue;
      const dur = entry.durationSeconds || (item.duration ? item.duration * 60 : 3600);
      const pct = dur ? Math.min(100, Math.round((entry.positionSeconds / dur) * 1000) / 10) : 0;
      if (pct > 0 && pct < 95) {
        out[item.id] = { item, pct, positionSeconds: entry.positionSeconds, durationSeconds: dur };
      }
    }
    return out;
  },

  async startPlayback(pid, item, durationSeconds) {
    if (!CONFIG.USE_SERVER) return { session: { playbackSessionId: 'demo-' + uid() } };
    const body = {
      videoId: String(item.id),
      ...(UUID_RE.test(String(pid)) && { profileId: pid }),
      ...(durationSeconds && { durationSeconds: Math.max(1, Math.round(durationSeconds)) })
    };
    return http('/api/streaming/playback/sessions', { method: 'POST', body });
  },

  async saveProgress(pid, item, pct, sessionId, durationSeconds) {
    if (!CONFIG.USE_SERVER) {
      const d = mock.pdata(pid); d.progress[item.id] = { item, pct }; LS.set('p:' + pid, d);
      return;
    }
    if (!sessionId) return;
    const dur = Math.max(1, Math.round(durationSeconds || (item.duration ? item.duration * 60 : 3600)));
    const pos = Math.max(0, Math.round((pct / 100) * dur * 10) / 10);
    return http(`/api/streaming/playback/sessions/${sessionId}/progress`, {
      method: 'POST',
      body: { positionSeconds: pos, durationSeconds: dur, type: 'progress' }
    });
  },

  async stopPlayback(sessionId, positionSeconds, durationSeconds, ended = false, keepalive = false) {
    if (!CONFIG.USE_SERVER || !sessionId) return;
    const dur = Math.max(1, Math.round(durationSeconds || 3600));
    const pos = Math.max(0, Math.round((positionSeconds || 0) * 10) / 10);
    return http(`/api/streaming/playback/sessions/${sessionId}/stop`, {
      method: 'POST',
      body: { positionSeconds: pos, durationSeconds: dur, ended: !!ended },
      keepalive
    });
  }
};