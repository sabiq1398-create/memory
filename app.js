/* =========================================
   MEMORI BOOK — APP LOGIC
   Vanilla JS modern (ES module)
   ========================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ==== KONFIGURASI ====
const SUPABASE_URL = 'https://rxmwpwsvnzzmakemzazr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4bXdwd3N2bnp6bWFrZW16YXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxMTAzNTYsImV4cCI6MjExMDY4NjM1Nn0.fKiSgZEYFIgrOMj4SYdCDKubRS75t4aYvm9HLZnEr-I';
// =====================

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const PHOTO_BUCKET = 'photos';

// =========================================
// PLACEHOLDER
// =========================================
const PLACEHOLDER = {
  image: 'https://placehold.co/600x400/eef2ff/6366f1?text=No+Image',
  avatar: (name = 'U') =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128`,
  logEmpty: 'Tidak ada log',
  galleryEmpty: 'Belum ada memori. Yuk tambahkan!',
};

// =========================================
// STATE
// =========================================
const state = {
  user: null,
  memories: [],
  galleries: [],
  activeGalleryId: null,
  heartbeat: null,
  galleryQuery: '',
  galleryRegion: '',
};

const LS = {
  device: 'memori_device_id',
};

// =========================================
// DOM HELPERS
// =========================================
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const APP_UPDATE_FILES = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './assets/memori-icon.svg',
  './assets/memori-icon-maskable.svg',
  './assets/memori-icon-192.png',
  './assets/memori-icon-512.png',
];
let serviceWorkerRegistration = null;
let waitingServiceWorker = null;
let appShellFingerprint = null;
let checkingForAppUpdate = false;
let reloadAfterControllerChange = false;

const showAppUpdate = () => $('app-update-banner').classList.remove('hidden');

const getAppFileFingerprint = async (path, cacheBuster) => {
  const url = `${path}?memori-update-check=${cacheBuster}`;
  const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
  if (!response.ok) throw new Error(`Gagal memeriksa ${path}: HTTP ${response.status}`);

  const etag = response.headers.get('etag');
  const lastModified = response.headers.get('last-modified');
  if (etag || lastModified) {
    return `${path}:${etag || ''}:${lastModified || ''}:${response.headers.get('content-length') || ''}`;
  }

  const contentResponse = await fetch(url, { cache: 'no-store' });
  if (!contentResponse.ok) throw new Error(`Gagal membaca ${path}: HTTP ${contentResponse.status}`);
  const content = await contentResponse.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', content));
  return `${path}:${[...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
};

const checkForAppUpdate = async () => {
  if (checkingForAppUpdate || !navigator.onLine) return;
  checkingForAppUpdate = true;

  try {
    const cacheBuster = Date.now();
    const fingerprints = await Promise.all(
      APP_UPDATE_FILES.map(path => getAppFileFingerprint(path, cacheBuster))
    );
    const latestFingerprint = fingerprints.join('\n');

    if (appShellFingerprint === null) {
      appShellFingerprint = latestFingerprint;
    } else if (latestFingerprint !== appShellFingerprint) {
      showAppUpdate();
    }

    if (serviceWorkerRegistration) await serviceWorkerRegistration.update();
  } catch (error) {
    console.warn('Application update check failed:', error);
  } finally {
    checkingForAppUpdate = false;
  }
};

const activateWaitingServiceWorker = () => {
  waitingServiceWorker = serviceWorkerRegistration?.waiting || waitingServiceWorker;
  if (!waitingServiceWorker) return false;

  const button = $('update-app-btn');
  button.disabled = true;
  button.textContent = 'Memuat versi baru...';
  reloadAfterControllerChange = true;
  waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
  window.setTimeout(() => {
    if (reloadAfterControllerChange) window.location.reload();
  }, 10_000);
  return true;
};

const setupAppUpdates = async () => {
  $('update-app-btn').addEventListener('click', () => {
    if (!activateWaitingServiceWorker()) window.location.reload();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadAfterControllerChange) window.location.reload();
    });

    try {
      serviceWorkerRegistration = await navigator.serviceWorker.register('./service-worker.js');
      if (serviceWorkerRegistration.waiting) {
        waitingServiceWorker = serviceWorkerRegistration.waiting;
        showAppUpdate();
      }

      serviceWorkerRegistration.addEventListener('updatefound', () => {
        const installing = serviceWorkerRegistration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && serviceWorkerRegistration.waiting) {
            waitingServiceWorker = serviceWorkerRegistration.waiting;
            showAppUpdate();
          }
        });
      });
    } catch (error) {
      console.warn('Service worker registration failed:', error);
    }
  }

  window.addEventListener('focus', checkForAppUpdate);
  window.addEventListener('online', checkForAppUpdate);
  window.setInterval(checkForAppUpdate, 5 * 60 * 1000);
  checkForAppUpdate();
};

const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const MEMORY_ROW_ICONS = {
  title: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9-9-9Z"/><circle cx="7.6" cy="7.6" r="1.4"/></svg>',
  name: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  date: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
  address: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 10.5c0 5.2-7 11-7 11s-7-5.8-7-11a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10.5" r="2.6"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>',
  caption: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M8.5 10h7M8.5 14h4.5"/></svg>',
  photos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.6"/><path d="m21 15.5-3.6-3.6a2 2 0 0 0-2.8 0L6 21"/></svg>',
};

const memoryRowIcon = (icon, extraClass = '') =>
  `<span class="memory-card-row-icon${extraClass ? ` ${extraClass}` : ''}" aria-hidden="true">${MEMORY_ROW_ICONS[icon]}</span>`;

const getDeviceId = () => {
  let id = localStorage.getItem(LS.device);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LS.device, id);
  }
  return id;
};

const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Mac/.test(ua)     ? 'macOS'   :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Linux/.test(ua)   ? 'Linux'   : 'Unknown';
  const br =
    /Edg\//.test(ua)     ? 'Edge'    :
    /Chrome\//.test(ua)  ? 'Chrome'  :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua)  ? 'Safari'  : 'Unknown';
  return `${os} • ${br}`;
};

const toast = (msg, type = 'info', ms = 3000) => {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), ms);
};

const showLoading = () => $('loading').classList.remove('hidden');
const hideLoading = () => $('loading').classList.add('hidden');

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDateTime = (d) => new Date(d).toLocaleString('id-ID');

const getInstagramUrl = (value) => {
  const input = String(value || '').trim();
  if (!input) return null;

  let handle = input.replace(/^@/, '');
  if (/^(https?:\/\/)?(www\.)?instagram\.com\//i.test(input)) {
    try {
      const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
      if (!['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase())) return null;
      handle = url.pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return null;
    }
  }

  return /^[a-zA-Z0-9._]{1,30}$/.test(handle)
    ? `https://www.instagram.com/${handle}/`
    : null;
};

const getWhatsAppUrl = (value) => {
  const input = String(value || '').trim();
  if (!input) return null;

  let phone = input;
  if (/^(https?:\/\/)?(www\.)?wa\.me\//i.test(input)) {
    try {
      const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
      if (!['wa.me', 'www.wa.me'].includes(url.hostname.toLowerCase())) return null;
      phone = url.pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return null;
    }
  }

  if (!/^[+\d\s().-]+$/.test(phone)) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? `https://wa.me/${digits}` : null;
};

const getMemoryRegion = (memory) => {
  const address = String(memory.full_address || memory.address || '').trim();
  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  if (!parts.length) return '';

  const lastPart = parts[parts.length - 1].replace(/[.]+$/, '').trim();
  if (/^indonesia$/i.test(lastPart) && parts.length > 1) {
    return parts[parts.length - 2].replace(/[.]+$/, '').trim();
  }
  return lastPart;
};

const getMemorySortTitle = (memory) =>
  String(memory.name || memory.message || memory.caption || 'Album').trim();

// Placeholder handling untuk <img>
const imgWithFallback = (src, alt = '') =>
  `<img src="${escapeHtml(src || PLACEHOLDER.image)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async"
    onerror="this.onerror=null;this.src='${PLACEHOLDER.image}'" />`;

// =========================================
// LOG ACTIVITY
// =========================================
const logActivity = async (action, metadata = {}) => {
  if (!state.user?.id) return;

  const safeMeta = {};
  try {
    const parsed = JSON.parse(JSON.stringify(metadata));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.assign(safeMeta, parsed);
    }
  } catch { /* ignore */ }

  try {
    const { error } = await sb.from('activity_logs').insert({
      user_id: state.user.id,
      action: String(action),
      metadata: safeMeta,
      device_info: getDeviceInfo(),
    });
    if (error) console.warn('logActivity:', error.message);
  } catch (e) {
    console.warn('logActivity exception:', e);
  }
};

// =========================================
// BOOTSTRAP
// =========================================
const bootstrap = async () => {
  showLoading();
  try {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) {
      showAuth();
      return;
    }

    await activateSession(session.user);
  } catch (e) {
    console.error(e);
    toast('Gagal memuat aplikasi: ' + e.message, 'error', 6000);
    showAuth();
  } finally {
    hideLoading();
  }
};

const LAMP_STORAGE_KEY = 'memori_lamp_lit';
const lampSection = $('auth-section');
const lampStage = $('lamp-stage');
const lampToggle = $('lamp-toggle');
const lampContent = $('auth-content');

const hasLampMemory = () => {
  try {
    return sessionStorage.getItem(LAMP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const rememberLamp = () => {
  try {
    sessionStorage.setItem(LAMP_STORAGE_KEY, '1');
  } catch {
    // sessionStorage can be unavailable in private or restricted contexts
  }
};

const forgetLamp = () => {
  try {
    sessionStorage.removeItem(LAMP_STORAGE_KEY);
  } catch {
    // sessionStorage can be unavailable in private or restricted contexts
  }
};

const lampGateReady = Boolean(lampStage && lampToggle && lampContent);
const lampActionText = $('lamp-action-text');

const setLampAccessibility = (lit) => {
  if (!lampGateReady) return;
  lampContent.toggleAttribute('inert', !lit);
  lampContent.setAttribute('aria-hidden', String(!lit));
  lampToggle.setAttribute('aria-expanded', String(lit));
  lampToggle.setAttribute('aria-label', lit ? 'Matikan lampu untuk menutup formulir masuk' : 'Tarik tali lampu untuk membuka formulir masuk');
  if (lampActionText) lampActionText.textContent = lit ? 'Matikan lampu' : 'Tarik tali lampu';
};

const prepareLampGate = () => {
  if (!lampGateReady) return;
  const lit = hasLampMemory();
  lampSection.classList.add('lamp-gate');
  lampSection.classList.toggle('is-lit', lit);
  setLampAccessibility(lit);
};

const setLampLit = (lit) => {
  if (!lampGateReady || !lampSection.classList.contains('lamp-gate')) return;
  if (lampSection.classList.contains('is-lit') === lit) return;
  lampSection.classList.toggle('is-lit', lit);
  setLampAccessibility(lit);

  if (lit) {
    rememberLamp();
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 30 : 950;
    window.setTimeout(() => {
      if (!lampSection.classList.contains('hidden')) {
        $('auth-email').focus({ preventScroll: true });
      }
    }, delay);
    return;
  }

  forgetLamp();
  window.scrollTo(0, 0);
  lampToggle.focus({ preventScroll: true });
};

const toggleLamp = () => setLampLit(!lampSection.classList.contains('is-lit'));

const lampCord = lampStage?.querySelector('.lamp-cord');
const lampKnob = lampStage?.querySelector('.lamp-knob');
const LAMP_CORD_X = 148;
const LAMP_CORD_TOP = 150;
const LAMP_CORD_LENGTH = 56;
const LAMP_KNOB_Y = 212;
const LAMP_PULL_THRESHOLD = 26;
const LAMP_PULL_MAX = 58;
let lampPullStartY = null;
let lampPullDistance = 0;
let lampPullMoved = false;

const setLampPull = (distance) => {
  if (!lampToggle) return;
  const pull = Math.max(0, Math.min(LAMP_PULL_MAX, distance));
  lampPullDistance = pull;
  lampCord?.setAttribute('d', `M${LAMP_CORD_X} ${LAMP_CORD_TOP}v${LAMP_CORD_LENGTH + pull}`);
  lampKnob?.setAttribute('cy', String(LAMP_KNOB_Y + pull));
  lampToggle.classList.toggle('is-ready', pull >= LAMP_PULL_THRESHOLD);
};

const endLampPull = (event, cancelled = false) => {
  if (lampPullStartY === null) return;
  lampPullStartY = null;
  lampToggle.classList.remove('is-pulling', 'is-ready');
  if (event && lampToggle.hasPointerCapture?.(event.pointerId)) {
    lampToggle.releasePointerCapture(event.pointerId);
  }
  const distance = lampPullDistance;
  setLampPull(0);
  if (!cancelled && distance >= LAMP_PULL_THRESHOLD) toggleLamp();
};

if (lampToggle) {
  lampToggle.addEventListener('click', (event) => {
    if (lampPullMoved) {
      lampPullMoved = false;
      event.preventDefault();
      return;
    }
    toggleLamp();
  });

  lampToggle.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!lampSection.classList.contains('lamp-gate')) return;
    lampPullStartY = event.clientY;
    lampPullMoved = false;
    lampToggle.classList.add('is-pulling');
    setLampPull(0);
    try {
      lampToggle.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable on some older browsers
    }
  });

  lampToggle.addEventListener('pointermove', (event) => {
    if (lampPullStartY === null) return;
    const distance = event.clientY - lampPullStartY;
    if (Math.abs(distance) > 6) lampPullMoved = true;
    setLampPull(distance);
    if (distance > 0) event.preventDefault();
  });

  lampToggle.addEventListener('pointerup', (event) => endLampPull(event));
  lampToggle.addEventListener('pointercancel', (event) => endLampPull(event, true));
}

const showAuth = () => {
  state.user = null;
  clearInterval(state.heartbeat);
  $('app-section').classList.add('hidden');
  prepareLampGate();
  $('auth-section').classList.remove('hidden');
  window.scrollTo(0, 0);
};

const activateSession = async (authUser, expectedRole = null) => {
  const { data: user, error } = await sb
    .from('users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .single();
  if (error) throw error;
  if (!user || !['user', 'admin'].includes(user.role)) {
    throw new Error('Profil akun tidak memiliki role yang valid.');
  }
  if (expectedRole && user.role !== expectedRole) {
    throw new Error(`Akun ini terdaftar sebagai ${user.role === 'admin' ? 'administrator' : 'pengguna'}. Pilih jenis akun yang sesuai.`);
  }

  state.user = user;
  const deviceId = getDeviceId();
  const { error: updateError } = await sb.from('users').update({
    active_device_id: deviceId,
    active_device_info: getDeviceInfo(),
    last_active_at: new Date().toISOString(),
  }).eq('id', user.id);
  if (updateError) throw updateError;

  state.user.active_device_id = deviceId;
  state.user.active_device_info = getDeviceInfo();
  $('auth-section').classList.add('hidden');
  $('app-section').classList.remove('hidden');
  loadProfileUI();
  await loadMemories();
  await logActivity('app_open');

  clearInterval(state.heartbeat);
  state.heartbeat = setInterval(async () => {
    if (!state.user) return;
    const { error: heartbeatError } = await sb.from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', state.user.id);
    if (heartbeatError) console.warn('Heartbeat:', heartbeatError.message);
  }, 60_000);
};

// =========================================
// PROFILE UI
// =========================================
const setProfileLink = (id, url) => {
  const link = $(id);
  if (!url) {
    link.removeAttribute('href');
    link.classList.add('hidden');
    return false;
  }
  link.href = url;
  link.classList.remove('hidden');
  return true;
};

const openProfileModal = (profile) => {
  if (!profile) return;
  const isOwnProfile = String(profile.id) === String(state.user?.id);
  const details = isOwnProfile ? { ...state.user, ...profile } : profile;
  $('profile-avatar').src = details.avatar_url || PLACEHOLDER.avatar(details.full_name || 'U');
  $('profile-name').textContent = details.full_name || 'Anonim';
  $('profile-bio').textContent = details.bio || '';
  $('profile-bio-section').classList.toggle('hidden', !details.bio?.trim());

  const hasAddress = details.address?.trim()
    ? setProfileLink('profile-address-link', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(details.address.trim())}`)
    : setProfileLink('profile-address-link', null);
  const hasInstagram = setProfileLink('profile-instagram-link', getInstagramUrl(details.instagram));
  const hasWhatsApp = setProfileLink('profile-whatsapp-link', getWhatsAppUrl(details.whatsapp));
  $('profile-contact-actions').classList.toggle('hidden', !hasAddress && !hasInstagram && !hasWhatsApp);

  $('profile-account-meta').classList.toggle('hidden', !isOwnProfile);
  $('profile-private-info').classList.toggle('hidden', !isOwnProfile);
  if (isOwnProfile) {
    $('profile-email').textContent = details.email || '';
    $('profile-role').textContent = details.role === 'admin' ? 'Administrator' : 'Pengguna';
    $('profile-role').className = `role-badge ${details.role}`;
    $('profile-device').textContent = details.active_device_info || getDeviceInfo();
    $('profile-joined').textContent = details.created_at ? fmtDate(details.created_at) : '-';
  }
  $('profile-modal').classList.remove('hidden');
};

const loadProfileUI = () => {
  const u = state.user;
  const avatar = u.avatar_url || PLACEHOLDER.avatar(u.full_name || 'U');

  $('nav-avatar-img').src = avatar;
  $('nav-profile-name').textContent = u.full_name || u.email;
  $('welcome-name').textContent = (u.full_name || 'teman').split(' ')[0];

  updateRoleUI();
};

const updateRoleUI = () => {
  const isAdmin = state.user?.role === 'admin';
  $('role-label').textContent = isAdmin ? 'Admin' : 'User';
  $('role-label').className = `role-pill ${isAdmin ? 'admin' : 'user'}`;

  $$('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));

  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab?.dataset.tab === 'admin' && !isAdmin) switchTab('gallery');
};


// =========================================
// MEMORIES
// =========================================
const loadMemories = async () => {
  let needsDetailsMigration = false;
  await loadGalleries();
  let { data: memories, error } = await sb
    .from('memories')
    .select('id, user_id, image_url, caption, name, birth_info, full_address, message, address, instagram, whatsapp, created_at')
    .order('created_at', { ascending: false });

  if (['42703', 'PGRST204'].includes(error?.code)) {
    needsDetailsMigration = true;
    ({ data: memories, error } = await sb
      .from('memories')
      .select('id, user_id, image_url, caption, name, message, created_at')
      .order('created_at', { ascending: false }));
    if (['42703', 'PGRST204'].includes(error?.code)) {
      ({ data: memories, error } = await sb
        .from('memories')
        .select('id, user_id, image_url, caption, created_at')
        .order('created_at', { ascending: false }));
    }
  }
  if (error) {
    console.error('MEM ERR:', error.message);
    toast('Gagal load memori: ' + error.message, 'error');
    return;
  }

  const memoryIds = (memories ?? []).map(memory => memory.id);
  if (memoryIds.length) {
    const { data: photoRecords, error: photosError } = await sb
      .from('memories')
      .select('id, photos')
      .in('id', memoryIds);
    if (['42703', 'PGRST204'].includes(photosError?.code)) {
      console.warn('Album foto belum tersedia di schema API:', photosError.message);
      toast('Kolom photos tidak ditemukan pada database API. Pastikan migrasi dijalankan di proyek rxmwpwsvnzzmakemzazr.', 'error', 7000);
    } else if (photosError) {
      console.error('Gagal memuat album foto:', photosError.message);
      toast('Gagal memuat foto galeri: ' + photosError.message, 'error');
    } else {
      const photosById = new Map((photoRecords ?? []).map(record => [String(record.id), record.photos]));
      memories = (memories ?? []).map(memory => ({
        ...memory,
        photos: photosById.get(String(memory.id)) ?? [],
      }));
    }

    const { data: typeRecords, error: typeError } = await sb
      .from('memories')
      .select('id, memory_type, gallery_id')
      .in('id', memoryIds);
    if (['42703', 'PGRST204'].includes(typeError?.code)) {
      const { data: legacyTypeRecords, error: legacyTypeError } = await sb
        .from('memories')
        .select('id, memory_type')
        .in('id', memoryIds);
      if (['42703', 'PGRST204'].includes(legacyTypeError?.code)) {
        console.warn('Jenis kenangan belum tersedia di schema API:', legacyTypeError.message);
        toast('Kolom jenis kenangan belum tersedia. Jalankan migrasi memory_type di data.sql.', 'error', 7000);
        memories = (memories ?? []).map(memory => ({ ...memory, memory_type: 'individu', gallery_id: null }));
      } else if (legacyTypeError) {
        console.error('Gagal memuat jenis kenangan:', legacyTypeError.message);
        toast('Gagal memuat jenis kenangan: ' + legacyTypeError.message, 'error');
      } else {
        const typesById = new Map((legacyTypeRecords ?? []).map(record => [String(record.id), record.memory_type]));
        memories = (memories ?? []).map(memory => ({
          ...memory,
          memory_type: typesById.get(String(memory.id)) || 'individu',
          gallery_id: null,
        }));
      }
    } else if (typeError) {
      console.error('Gagal memuat jenis kenangan:', typeError.message);
      toast('Gagal memuat jenis kenangan: ' + typeError.message, 'error');
    } else {
      const typesById = new Map((typeRecords ?? []).map(record => [String(record.id), record]));
      memories = (memories ?? []).map(memory => ({
        ...memory,
        memory_type: typesById.get(String(memory.id))?.memory_type || 'individu',
        gallery_id: typesById.get(String(memory.id))?.gallery_id ?? null,
      }));
    }
  }

  const userIds = [...new Set((memories ?? []).map(memory => memory.user_id))];
  let profiles = [];
  if (userIds.length) {
    const { data, error: profileError } = await sb
      .from('memory_user_profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);
    if (profileError) {
      toast('Gagal memuat profil pemilik album: ' + profileError.message, 'error');
      return;
    }
    profiles = data ?? [];
  }

  const galleryIdBySlug = new Map(
    state.galleries.filter(gallery => gallery.slug).map(gallery => [gallery.slug, gallery.id])
  );
  const fallbackGalleryId = galleryIdBySlug.get('individu') ?? state.galleries[0]?.id ?? null;
  state.memories = (memories ?? []).map(memory => ({
    ...memory,
    gallery_id: memory.gallery_id ?? galleryIdBySlug.get(memory.memory_type || 'individu') ?? fallbackGalleryId,
    users: profiles.find(profile => profile.id === memory.user_id) ?? null,
  }));
  renderMemories();
  if (needsDetailsMigration) {
    toast('Jalankan data.sql terbaru agar data biodata lengkap dapat digunakan.', 'error', 7000);
  }
};

const DEFAULT_GALLERIES = [
  { id: 'individu', name: 'Galeri Individu', slug: 'individu', sort_order: 0 },
  { id: 'bersama', name: 'Galeri Kenangan', slug: 'bersama', sort_order: 1 },
];

const getGalleryById = (id) =>
  state.galleries.find(gallery => String(gallery.id) === String(id)) || null;
const getGalleryName = (id) => getGalleryById(id)?.name || '';
const isBiodataGallery = (gallery) => {
  if (!gallery) return false;
  const name = String(gallery.name || '').trim().toLowerCase();
  const slug = String(gallery.slug || '').trim().toLowerCase();
  return name === 'biodata' || slug === 'biodata' || slug === 'individu';
};

const fillGallerySelect = (select, selectedValue = '') => {
  if (!select) return;
  select.innerHTML = '<option value="" disabled>Pilih galeri</option>' +
    state.galleries
      .map(gallery => `<option value="${escapeHtml(String(gallery.id))}">${escapeHtml(gallery.name)}</option>`)
      .join('');
  if (state.galleries.some(gallery => String(gallery.id) === String(selectedValue))) {
    select.value = String(selectedValue);
  }
};

const fillUploadGallerySelect = () => {
  fillGallerySelect($('memory-gallery-input'), state.activeGalleryId);
  updateUploadMode();
};

const loadGalleries = async () => {
  const { data, error } = await sb
    .from('galleries')
    .select('id, name, slug, sort_order')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code)) {
      toast('Tabel galeri belum tersedia. Jalankan data.sql terbaru di Supabase SQL Editor.', 'error', 7000);
    } else {
      toast('Gagal memuat galeri: ' + error.message, 'error');
    }
    state.galleries = DEFAULT_GALLERIES.map(gallery => ({ ...gallery }));
  } else {
    state.galleries = data?.length ? data : DEFAULT_GALLERIES.map(gallery => ({ ...gallery }));
  }

  if (!state.galleries.some(gallery => String(gallery.id) === String(state.activeGalleryId))) {
    state.activeGalleryId = state.galleries[0]?.id ?? null;
  }
  renderGalleryTabs();
};

const renderGalleryTabs = () => {
  const tabs = document.querySelector('.tabs');
  const anchor = tabs?.querySelector('[data-tab="upload"]');
  if (!tabs || !anchor) return;

  tabs.querySelectorAll('[data-tab="gallery"]').forEach(tab => tab.remove());
  const markup = state.galleries.map(gallery => `
    <button class="tab-btn" data-tab="gallery" data-gallery-id="${escapeHtml(String(gallery.id))}" type="button">
      <span aria-hidden="true">${gallery.slug === 'bersama' ? '▧' : '▦'}</span>${escapeHtml(gallery.name)}
    </button>
  `).join('');
  anchor.insertAdjacentHTML('beforebegin', markup);

  const activeTabId = document.querySelector('.tab-content.active')?.id.replace(/^tab-/, '') || 'gallery';
  markActiveTab(activeTabId);
};

const renderMemoryCards = (memories, grid, empty, gallery, hasGalleryMemories) => {
  const biodataMode = isBiodataGallery(gallery);
  if (!memories.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    $('gallery-empty-title').textContent = hasGalleryMemories
      ? (biodataMode ? 'Tidak ada data yang cocok' : 'Tidak ada album yang cocok')
      : (biodataMode ? `Belum ada data di ${gallery.name}` : `Belum ada album di ${gallery.name}`);
    $('gallery-empty-text').textContent = hasGalleryMemories
      ? 'Coba ubah kata kunci pencarian.'
      : (biodataMode
        ? `Tambahkan data individu pertama ke ${gallery.name} agar tampil di sini.`
        : `Tambahkan album pertama ke ${gallery.name} agar tampil di sini.`);
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = memories.map(m => {
    const isOwner = m.user_id === state.user.id;
    const isAdmin = state.user.role === 'admin';
    const canDelete = isOwner || isAdmin;
    const itemBiodata = isBiodataGallery(getGalleryById(m.gallery_id) || gallery);
    const memoryTitle = itemBiodata
      ? (m.name || 'Tanpa nama')
      : (m.name || m.caption || 'Album');
    const caption = m.message || (m.name ? m.caption : '') || '';
    const photoCount = Array.isArray(m.photos) ? m.photos.length : 0;
    const fullAddress = itemBiodata ? (m.full_address || m.address || '') : '';
    const addressUrl = fullAddress.trim()
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress.trim())}`
      : null;
    const instagramUrl = itemBiodata ? getInstagramUrl(m.instagram) : null;
    const whatsappUrl = itemBiodata ? getWhatsAppUrl(m.whatsapp) : null;
    const itemNoun = itemBiodata ? 'data' : 'album';

    return `
      <article class="memory-card" data-open-memory="${m.id}" tabindex="0" aria-label="Buka ${itemNoun} ${escapeHtml(memoryTitle)}" aria-haspopup="dialog">
        <div class="memory-card-image">
          ${imgWithFallback(m.image_url, memoryTitle)}
          ${photoCount > 1 ? `<span class="memory-photo-count"><span aria-hidden="true">${MEMORY_ROW_ICONS.photos}</span>${photoCount} foto</span>` : ''}
        </div>
        <div class="memory-card-body">
          <div class="memory-card-content">
            <span class="memory-card-row memory-card-name-row">${memoryRowIcon(itemBiodata ? 'name' : 'title')}<span>${escapeHtml(memoryTitle)}</span></span>
            ${itemBiodata && m.birth_info ? `<span class="memory-card-row">${memoryRowIcon('date')}<span>${escapeHtml(m.birth_info)}</span></span>` : ''}
            ${fullAddress ? `<a class="memory-card-row memory-card-row-link" href="${escapeHtml(addressUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Buka alamat di Google Maps: ${escapeHtml(fullAddress)}">${memoryRowIcon('address')}<span>${escapeHtml(fullAddress)}</span></a>` : ''}
            ${itemBiodata && m.instagram ? (instagramUrl
              ? `<a class="memory-card-row memory-card-row-link" href="${escapeHtml(instagramUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Buka Instagram ${escapeHtml(m.instagram)}">${memoryRowIcon('instagram', 'memory-card-row-icon-instagram')}<span>${escapeHtml(m.instagram)}</span></a>`
              : `<span class="memory-card-row">${memoryRowIcon('instagram', 'memory-card-row-icon-instagram')}<span>${escapeHtml(m.instagram)}</span></span>`) : ''}
            ${itemBiodata && m.whatsapp ? (whatsappUrl
              ? `<a class="memory-card-row memory-card-row-link" href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Buka WhatsApp ${escapeHtml(m.whatsapp)}">${memoryRowIcon('whatsapp', 'memory-card-row-icon-whatsapp')}<span>${escapeHtml(m.whatsapp)}</span></a>`
              : `<span class="memory-card-row">${memoryRowIcon('whatsapp', 'memory-card-row-icon-whatsapp')}<span>${escapeHtml(m.whatsapp)}</span></span>`) : ''}
            ${caption ? `<span class="memory-card-row memory-card-caption-row">${memoryRowIcon('caption')}<span>${escapeHtml(caption)}</span></span>` : ''}
          </div>
          ${isAdmin || canDelete ? `
            <div class="memory-card-footer">
              <nav class="memory-card-actions" aria-label="Kelola ${itemNoun} ${escapeHtml(memoryTitle)}">
                ${isAdmin ? `<button class="edit-memory" data-edit="${m.id}" type="button" aria-label="Edit ${itemNoun} ${escapeHtml(memoryTitle)}" title="Edit"><span aria-hidden="true">✎</span><span>Edit</span></button>` : ''}
                ${canDelete ? `<button class="delete-memory" data-del="${m.id}" type="button" aria-label="Hapus ${itemNoun} ${escapeHtml(memoryTitle)}" title="Hapus"><span aria-hidden="true">×</span><span>Hapus</span></button>` : ''}
              </nav>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.memory-card[data-open-memory]').forEach(card => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) return;
      openMemoryModal(card.dataset.openMemory);
    });
    card.addEventListener('keydown', (event) => {
      if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openMemoryModal(card.dataset.openMemory);
    });
  });

  grid.querySelectorAll('.delete-memory').forEach(button => {
    button.addEventListener('click', async event => {
      event.stopPropagation();
      await deleteMemory(button.dataset.del);
    });
  });

  grid.querySelectorAll('.edit-memory').forEach(button => {
    button.addEventListener('click', () => openMemoryEditModal(button.dataset.edit));
  });
};

const renderMemories = () => {
  const gallery = getGalleryById(state.activeGalleryId) || state.galleries[0];
  if (!gallery) return;
  state.activeGalleryId = gallery.id;
  const biodataMode = isBiodataGallery(gallery);

  const grid = $('gallery');
  const empty = $('gallery-empty');
  const regionSelect = $('gallery-region');
  const galleryMemories = state.memories.filter(memory => String(memory.gallery_id) === String(gallery.id));

  $('gallery-region-filter').classList.toggle('hidden', !biodataMode);
  if (biodataMode) {
    const regions = [...new Set(galleryMemories.map(getMemoryRegion).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
    regionSelect.innerHTML = '<option value="">Semua daerah</option>' +
      regions.map(region => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join('');
    if (regions.includes(state.galleryRegion)) regionSelect.value = state.galleryRegion;
    else {
      state.galleryRegion = '';
      regionSelect.value = '';
    }
  } else {
    state.galleryRegion = '';
  }

  const query = state.galleryQuery.trim().toLowerCase();
  const filteredMemories = galleryMemories
    .filter(memory => {
      if (biodataMode && state.galleryRegion && getMemoryRegion(memory) !== state.galleryRegion) return false;
      if (!query) return true;
      const searchable = [
        memory.name,
        memory.birth_info,
        memory.full_address,
        memory.address,
        memory.message,
        memory.caption,
        memory.instagram,
        memory.whatsapp,
        getGalleryName(memory.gallery_id),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query);
    })
    .sort((a, b) => getMemorySortTitle(a).localeCompare(getMemorySortTitle(b), 'id', { sensitivity: 'base' }));

  const itemLabel = biodataMode ? 'data' : 'album';
  $('gallery-eyebrow').textContent = 'GALERI';
  $('gallery-title').textContent = gallery.name;
  $('gallery-description').textContent = biodataMode
    ? `Kumpulan data individu dalam ${gallery.name}.`
    : `Kumpulan album dalam ${gallery.name}.`;
  $('memory-count').textContent = filteredMemories.length === galleryMemories.length
    ? `${galleryMemories.length} ${itemLabel}`
    : `${filteredMemories.length} dari ${galleryMemories.length} ${itemLabel}`;

  renderMemoryCards(filteredMemories, grid, empty, gallery, galleryMemories.length > 0);
};

$('gallery-search').addEventListener('input', (event) => {
  state.galleryQuery = event.target.value;
  renderMemories();
});

$('gallery-region').addEventListener('change', (event) => {
  state.galleryRegion = event.target.value;
  renderMemories();
});

// =========================================
// MEMORY MODAL
// =========================================
let editingMemoryId = null;
let selectedEditFile = null;

const openMemoryModal = (id, photoIndex = 0) => {
  const m = state.memories.find(x => String(x.id) === String(id));
  if (!m) return;
  const itemBiodata = isBiodataGallery(getGalleryById(m.gallery_id));
  const memoryTitle = itemBiodata
    ? (m.name || 'Tanpa nama')
    : (m.name || m.caption || 'Album');
  const photos = Array.isArray(m.photos) && m.photos.length
    ? m.photos.filter(Boolean)
    : (m.image_url ? [m.image_url] : []);
  const selectedPhotoIndex = Number.isInteger(photoIndex) && photoIndex >= 0 && photoIndex < photos.length
    ? photoIndex
    : 0;
  $('memory-view-img').src = photos[selectedPhotoIndex] || m.image_url || PLACEHOLDER.image;
  $('memory-view-img').onerror = (event) => {
    event.target.onerror = null;
    event.target.src = PLACEHOLDER.image;
  };
  const gallery = $('memory-view-gallery');
  gallery.innerHTML = photos.length > 1
    ? photos.map((photo, index) => `
        <button class="${index === selectedPhotoIndex ? 'active' : ''}" type="button" data-photo-index="${index}" aria-label="Tampilkan foto ${index + 1}">
          <img src="${escapeHtml(photo)}" alt="${escapeHtml(memoryTitle)} foto ${index + 1}" loading="lazy" />
        </button>
      `).join('')
    : '';
  gallery.classList.toggle('hidden', photos.length <= 1);
  gallery.querySelectorAll('[data-photo-index]').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.photoIndex);
      const photo = photos[index];
      if (!photo) return;
      $('memory-view-img').src = photo;
      gallery.querySelectorAll('button').forEach((item, itemIndex) =>
        item.classList.toggle('active', itemIndex === index)
      );
    });
  });
  $('memory-view-img').alt = memoryTitle;
  $('memory-view-name-label').textContent = itemBiodata ? 'Nama' : 'Judul';
  $('memory-view-title').textContent = memoryTitle;
  const caption = m.message || (m.name ? m.caption : '') || '';
  $('memory-view-message').textContent = caption;
  $('memory-view-message-section').classList.toggle('hidden', !caption.trim());
  $('memory-view-details').classList.toggle('hidden', !itemBiodata);
  if (itemBiodata) {
    const fullAddress = m.full_address || m.address || '';
    $('memory-view-type').textContent = getGalleryName(m.gallery_id) || '—';
    $('memory-view-birth-info').textContent = m.birth_info || '—';
    $('memory-view-address').textContent = fullAddress || '—';
    $('memory-view-address-row').classList.toggle('hidden', !fullAddress);
    const hasAddress = fullAddress.trim()
      ? setProfileLink('memory-address-link', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress.trim())}`)
      : setProfileLink('memory-address-link', null);
    const hasInstagram = setProfileLink('memory-instagram-link', getInstagramUrl(m.instagram));
    const hasWhatsApp = setProfileLink('memory-whatsapp-link', getWhatsAppUrl(m.whatsapp));
    $('memory-contact-actions').classList.toggle('hidden', !hasAddress && !hasInstagram && !hasWhatsApp);
  } else {
    $('memory-contact-actions').classList.add('hidden');
  }
  $('memory-view-date').textContent = fmtDateTime(m.created_at);
  $('memory-modal').classList.remove('hidden');
};

const updateMemoryEditMode = () => {
  const biodataMode = isBiodataGallery(getGalleryById($('memory-edit-gallery').value));
  $('memory-edit-name-label').textContent = biodataMode ? 'Nama' : 'Judul album';
  $('memory-edit-biodata-fields').classList.toggle('hidden', !biodataMode);
};

const openMemoryEditModal = (id) => {
  if (state.user?.role !== 'admin') return toast('Hanya administrator yang dapat mengedit memori.', 'error');
  const memory = state.memories.find(item => String(item.id) === String(id));
  if (!memory) return toast('Memori tidak ditemukan.', 'error');

  editingMemoryId = String(memory.id);
  selectedEditFile = null;
  fillGallerySelect($('memory-edit-gallery'), memory.gallery_id);
  $('memory-edit-name').value = memory.name || '';
  $('memory-edit-birth-info').value = memory.birth_info || '';
  $('memory-edit-full-address').value = memory.full_address || memory.address || '';
  $('memory-edit-message').value = memory.message || memory.caption || '';
  $('memory-edit-instagram').value = memory.instagram || '';
  $('memory-edit-whatsapp').value = memory.whatsapp || '';
  $('memory-edit-image-input').value = '';
  $('memory-edit-preview').src = memory.image_url || PLACEHOLDER.image;
  $('memory-edit-status').className = 'status';
  $('memory-edit-status').textContent = '';
  updateMemoryEditMode();
  $('memory-edit-modal').classList.remove('hidden');
};

$('memory-edit-gallery').addEventListener('change', updateMemoryEditMode);

$('memory-close').addEventListener('click', () => $('memory-modal').classList.add('hidden'));
$('memory-modal').addEventListener('click', (e) => {
  if (e.target.id === 'memory-modal') $('memory-modal').classList.add('hidden');
});
$('memory-edit-close').addEventListener('click', () => $('memory-edit-modal').classList.add('hidden'));
$('memory-edit-modal').addEventListener('click', (e) => {
  if (e.target.id === 'memory-edit-modal') $('memory-edit-modal').classList.add('hidden');
});

// =========================================
// DELETE MEMORY
// =========================================
const getMemoryStorageObject = (imageUrl) => {
  try {
    const url = new URL(imageUrl);
    for (const bucket of ['memories', PHOTO_BUCKET]) {
      const marker = `/storage/v1/object/public/${bucket}/`;
      const index = url.pathname.indexOf(marker);
      if (index !== -1) {
        return {
          bucket,
          path: decodeURIComponent(url.pathname.slice(index + marker.length)),
        };
      }
    }
  } catch {
    return null;
  }
  return null;
};

const deleteMemory = async (id) => {
  if (!confirm('Hapus memori ini?')) return;
  const m = state.memories.find(x => String(x.id) === String(id));
  if (!m) return;

  const { error } = await sb.from('memories').delete().eq('id', id);
  if (error) return toast('Gagal hapus: ' + error.message, 'error');

  const photoUrls = [...new Set([m.image_url, ...(Array.isArray(m.photos) ? m.photos : [])].filter(Boolean))];
  const objectsByBucket = new Map();
  photoUrls.map(getMemoryStorageObject).filter(Boolean).forEach(({ bucket, path }) => {
    if (!objectsByBucket.has(bucket)) objectsByBucket.set(bucket, []);
    objectsByBucket.get(bucket).push(path);
  });
  let cleanupFailed = false;
  for (const [bucket, paths] of objectsByBucket) {
    try {
      const { error: cleanupError } = await sb.storage.from(bucket).remove([...new Set(paths)]);
      if (cleanupError) throw cleanupError;
    } catch (cleanupError) {
      cleanupFailed = true;
      console.error(`Gagal menghapus foto dari bucket ${bucket}:`, cleanupError);
    }
  }

  toast(
    cleanupFailed ? 'Memori dihapus, tetapi sebagian file foto gagal dibersihkan.' : 'Memori dihapus',
    cleanupFailed ? 'error' : 'success',
  );
  logActivity('delete_memory', { memory_id: id });
  loadMemories();
};

$('memory-edit-image-input').addEventListener('change', (event) => {
  const file = event.target.files[0];
  const editingMemory = state.memories.find(item => String(item.id) === editingMemoryId);
  const originalImage = editingMemory?.image_url || PLACEHOLDER.image;
  selectedEditFile = null;
  if (!file) {
    $('memory-edit-preview').src = originalImage;
    return;
  }
  const status = $('memory-edit-status');
  if (state.user?.role !== 'admin') {
    event.target.value = '';
    $('memory-edit-preview').src = originalImage;
    return toast('Hanya administrator yang dapat mengedit memori.', 'error');
  }
  if (!file.type.startsWith('image/')) {
    event.target.value = '';
    $('memory-edit-preview').src = originalImage;
    status.className = 'status error';
    status.textContent = 'File harus berupa gambar.';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    event.target.value = '';
    $('memory-edit-preview').src = originalImage;
    status.className = 'status error';
    status.textContent = 'Ukuran foto maksimal 5 MB.';
    return;
  }

  selectedEditFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    $('memory-edit-preview').src = reader.result;
  };
  reader.onerror = () => {
    selectedEditFile = null;
    $('memory-edit-preview').src = originalImage;
    status.className = 'status error';
    status.textContent = 'Foto tidak dapat dibaca. Coba pilih file lain.';
  };
  reader.readAsDataURL(file);
});

$('memory-edit-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.user?.role !== 'admin') return toast('Hanya administrator yang dapat mengedit memori.', 'error');
  if (!editingMemoryId) return toast('Pilih memori yang akan diedit.', 'error');
  if (!state.user) return toast('User belum siap.', 'error');

  const memory = state.memories.find(item => String(item.id) === editingMemoryId);
  if (!memory) return toast('Memori tidak ditemukan.', 'error');

  const status = $('memory-edit-status');
  const button = $('memory-edit-save');
  status.className = 'status';
  status.textContent = '';
  const title = $('memory-edit-name').value.trim();
  if (!title) {
    status.className = 'status error';
    status.textContent = isBiodataGallery(getGalleryById($('memory-edit-gallery').value))
      ? 'Masukkan nama terlebih dahulu.'
      : 'Masukkan judul album terlebih dahulu.';
    return;
  }
  const targetGallery = getGalleryById($('memory-edit-gallery').value);
  if (!targetGallery) {
    status.className = 'status error';
    status.textContent = 'Pilih galeri tujuan terlebih dahulu.';
    return;
  }
  const biodata = isBiodataGallery(targetGallery);

  const instagramInput = biodata ? $('memory-edit-instagram').value.trim() : '';
  const whatsappInput = biodata ? $('memory-edit-whatsapp').value.trim() : '';
  const instagramUrl = getInstagramUrl(instagramInput);
  const whatsappUrl = getWhatsAppUrl(whatsappInput);
  if (instagramInput && !instagramUrl) {
    status.className = 'status error';
    status.textContent = 'Masukkan username Instagram atau tautan profil yang valid.';
    return;
  }
  if (whatsappInput && !whatsappUrl) {
    status.className = 'status error';
    status.textContent = 'Masukkan nomor WhatsApp dengan kode negara, misalnya 628123456789.';
    return;
  }

  const memoryDetails = {
    gallery_id: targetGallery.id,
    name: title,
    message: $('memory-edit-message').value.trim() || null,
    birth_info: biodata ? $('memory-edit-birth-info').value.trim() || null : null,
    full_address: biodata ? $('memory-edit-full-address').value.trim() || null : null,
    instagram: instagramUrl ? new URL(instagramUrl).pathname.split('/').filter(Boolean)[0] : null,
    whatsapp: whatsappUrl ? whatsappUrl.split('/').pop() : null,
  };
  let uploadedImagePath = null;
  let databaseUpdated = false;
  button.disabled = true;
  button.textContent = 'Menyimpan...';

  try {
    const schemaColumns = biodata
      ? 'gallery_id, name, birth_info, full_address, message, instagram, whatsapp'
      : 'gallery_id, name, message';
    const { error: schemaError } = await sb.from('memories')
      .select(schemaColumns)
      .limit(0);
    if (schemaError) {
      if (['42703', 'PGRST204'].includes(schemaError.code)) {
        throw new Error(biodata
          ? 'Kolom data individu belum tersedia. Jalankan data.sql terbaru di Supabase SQL Editor.'
          : 'Kolom album belum tersedia. Jalankan data.sql terbaru di Supabase SQL Editor.');
      }
      throw schemaError;
    }

    const updates = { ...memoryDetails };
    if (selectedEditFile) {
      const { error: photosSchemaError } = await sb.from('memories').select('photos').limit(0);
      if (photosSchemaError) {
        if (['42703', 'PGRST204'].includes(photosSchemaError.code)) {
          throw new Error('Kolom album foto belum tersedia. Jalankan data.sql terbaru di Supabase SQL Editor.');
        }
        throw photosSchemaError;
      }

      const extension = selectedEditFile.name.split('.').pop().toLowerCase();
      const safeExtension = /^[a-z0-9]{1,8}$/.test(extension) ? extension : 'jpg';
      uploadedImagePath = `${state.user.id}/${Date.now()}-edit.${safeExtension}`;
      const { error: uploadError } = await sb.storage.from(PHOTO_BUCKET)
        .upload(uploadedImagePath, selectedEditFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const newImageUrl = sb.storage.from(PHOTO_BUCKET).getPublicUrl(uploadedImagePath).data.publicUrl;
      updates.image_url = newImageUrl;
      updates.photos = [newImageUrl];
    }

    const { error: updateError } = await sb.from('memories')
      .update(updates)
      .eq('id', editingMemoryId)
      .select('id')
      .single();
    if (updateError) throw updateError;
    databaseUpdated = true;

    let oldImageCleanupFailed = false;
    if (uploadedImagePath) {
      const oldPhotoUrls = [...new Set([memory.image_url, ...(Array.isArray(memory.photos) ? memory.photos : [])].filter(Boolean))];
      const oldObjectsByBucket = new Map();
      oldPhotoUrls.map(getMemoryStorageObject).filter(Boolean).forEach(({ bucket, path }) => {
        if (!oldObjectsByBucket.has(bucket)) oldObjectsByBucket.set(bucket, []);
        oldObjectsByBucket.get(bucket).push(path);
      });
      for (const [bucket, paths] of oldObjectsByBucket) {
        try {
          const { error: cleanupError } = await sb.storage.from(bucket).remove([...new Set(paths)]);
          if (cleanupError) throw cleanupError;
        } catch (cleanupError) {
          oldImageCleanupFailed = true;
          console.error('Gagal menghapus foto lama:', cleanupError);
        }
      }
    }

    await logActivity('update_memory', { memory_id: editingMemoryId });
    state.activeGalleryId = targetGallery.id;
    selectedEditFile = null;
    editingMemoryId = null;
    $('memory-edit-image-input').value = '';
    $('memory-edit-modal').classList.add('hidden');
    await loadMemories();
    toast(
      oldImageCleanupFailed ? 'Memori diperbarui, tetapi foto lama gagal dihapus.' : 'Memori berhasil diperbarui.',
      oldImageCleanupFailed ? 'error' : 'success',
    );
  } catch (error) {
    console.error(error);
    let cleanupWarning = '';
    if (uploadedImagePath && !databaseUpdated) {
      try {
        const { error: cleanupError } = await sb.storage.from(PHOTO_BUCKET).remove([uploadedImagePath]);
        if (cleanupError) throw cleanupError;
      } catch (cleanupError) {
        console.error('Gagal membersihkan foto yang tidak tersimpan:', cleanupError);
        cleanupWarning = ' Foto baru yang gagal disimpan juga tidak dapat dibersihkan.';
      }
    }
    status.className = 'status error';
    status.textContent = 'Gagal menyimpan perubahan: ' + error.message + cleanupWarning;
  } finally {
    button.disabled = false;
    button.textContent = 'Simpan perubahan →';
  }
});

// =========================================
// UPLOAD
// =========================================
const dropzone         = $('dropzone');
const imageInput       = $('image-input');
const dropzoneContent  = $('dropzone-content');
const galleryPreview   = $('gallery-preview');
const memoryGalleryInput = $('memory-gallery-input');
const albumFields         = $('album-fields');
const biodataFields       = $('biodata-fields');
const individualMethodInput = $('individual-entry-method');
const individualManualFields = $('individual-manual-fields');
const individualImportFields = $('individual-import-fields');
const importInput        = $('memory-import-input');
const importPreview      = $('individual-import-preview');
const downloadTemplateButton = $('download-individual-template');
const uploadButton     = $('upload-btn');
let selectedFiles = [];
let individualImportRows = [];
let spreadsheetParserPromise = null;
let importReadSequence = 0;
const canUploadMemories = () => state.user?.role === 'admin';
const getUploadBiodata = () => isBiodataGallery(getGalleryById(memoryGalleryInput.value));

const updateUploadMode = () => {
  const biodataMode = getUploadBiodata();
  const excelMode = biodataMode && individualMethodInput.value === 'excel';
  albumFields.classList.toggle('hidden', biodataMode);
  biodataFields.classList.toggle('hidden', !biodataMode);
  individualManualFields.classList.toggle('hidden', excelMode);
  individualImportFields.classList.toggle('hidden', !excelMode);

  let ready = Boolean(getGalleryById(memoryGalleryInput.value));
  let label = 'Simpan album';
  if (biodataMode) {
    ready = ready && (excelMode ? individualImportRows.length > 0 : true);
    label = excelMode ? 'Impor data individu' : 'Simpan data individu';
  } else {
    ready = ready && selectedFiles.length > 0;
  }
  uploadButton.disabled = !ready;
  uploadButton.innerHTML = `${label} <span>→</span>`;
};

memoryGalleryInput.addEventListener('change', updateUploadMode);
individualMethodInput.addEventListener('change', updateUploadMode);
updateUploadMode();

const loadSpreadsheetParser = () => {
  if (!spreadsheetParserPromise) {
    spreadsheetParserPromise = import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  }
  return spreadsheetParserPromise;
};

const normalizeImportHeader = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const IMPORT_FIELD_ALIASES = {
  name: ['nama', 'nama lengkap', 'name'],
  birth_info: ['tanggal acara', 'ttl', 'tanggal lahir', 'tanggal acara ttl', 'tanggal'],
  full_address: ['daerah', 'alamat', 'alamat lengkap', 'daerah alamat', 'address'],
  message: ['caption', 'keterangan', 'pesan', 'catatan', 'message'],
  instagram: ['instagram', 'ig', 'instagram username'],
  whatsapp: ['whatsapp', 'wa', 'nomor whatsapp', 'nomor wa', 'telepon', 'phone'],
};

const resolveImportField = (header) => {
  const normalized = normalizeImportHeader(header);
  if (!normalized) return null;
  for (const [field, aliases] of Object.entries(IMPORT_FIELD_ALIASES)) {
    if (aliases.some(alias => normalized === alias || normalized.startsWith(`${alias} `))) return field;
  }
  return null;
};

const readIndividualSpreadsheet = async (file) => {
  const XLSX = await loadSpreadsheetParser();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { rows: [], skippedContacts: 0, missingName: true };

  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  if (matrix.length < 2) return { rows: [], skippedContacts: 0, missingName: false };

  const headers = matrix[0].map(resolveImportField);
  if (!headers.includes('name')) return { rows: [], skippedContacts: 0, missingName: true };

  const rows = [];
  let skippedContacts = 0;
  matrix.slice(1).forEach((cells) => {
    const record = {};
    headers.forEach((field, index) => {
      if (!field || record[field] !== undefined) return;
      record[field] = cells[index] ?? '';
    });
    const name = String(record.name || '').trim().replace(/\s+/g, ' ').slice(0, 150);
    if (!name) return;

    const instagramInput = String(record.instagram || '').trim();
    const whatsappInput = String(record.whatsapp || '').trim();
    const instagramUrl = getInstagramUrl(instagramInput);
    const whatsappUrl = getWhatsAppUrl(whatsappInput);
    if ((instagramInput && !instagramUrl) || (whatsappInput && !whatsappUrl)) skippedContacts += 1;

    rows.push({
      name,
      birth_info: String(record.birth_info || '').trim().slice(0, 150) || null,
      full_address: String(record.full_address || '').trim().slice(0, 500) || null,
      message: String(record.message || '').trim().slice(0, 1000) || null,
      instagram: instagramUrl ? new URL(instagramUrl).pathname.split('/').filter(Boolean)[0] : null,
      whatsapp: whatsappUrl ? whatsappUrl.split('/').pop() : null,
    });
  });

  return { rows, skippedContacts, missingName: false };
};

const resetIndividualManualFields = () => {
  [
    'individual-name-input',
    'individual-birth-info-input',
    'individual-address-input',
    'individual-caption-input',
    'individual-instagram-input',
    'individual-whatsapp-input',
  ].forEach(id => { $(id).value = ''; });
};

downloadTemplateButton.addEventListener('click', async () => {
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat mengunduh template.', 'error');
  downloadTemplateButton.disabled = true;
  try {
    const XLSX = await loadSpreadsheetParser();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Nama', 'Tanggal acara / TTL', 'Daerah / Alamat', 'Caption', 'Instagram', 'WhatsApp'],
      ['Contoh: Ahmad Fauzi', '12 Mei 2024', 'Kec. Sukamaju, Kab. Bandung', 'Alumni angkatan 2020', '@ahmadfauzi', '628123456789'],
    ]);
    sheet['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 34 }, { wch: 34 }, { wch: 20 }, { wch: 18 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Data Individu');
    XLSX.writeFile(book, 'template-data-individu.xlsx');
  } catch (error) {
    console.error(error);
    toast('Gagal membuat template Excel: ' + error.message, 'error');
  } finally {
    downloadTemplateButton.disabled = false;
  }
});

importInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  const sequence = ++importReadSequence;
  individualImportRows = [];
  importPreview.textContent = '';
  updateUploadMode();
  if (!file) return;

  importPreview.textContent = 'Membaca file...';
  try {
    const result = await readIndividualSpreadsheet(file);
    if (sequence !== importReadSequence) return;
    if (result.missingName) {
      importPreview.textContent = 'Kolom Nama tidak ditemukan. Gunakan template Excel yang tersedia.';
    } else if (!result.rows.length) {
      importPreview.textContent = 'Tidak ada baris dengan nama yang terisi.';
    } else if (result.rows.length > 200) {
      importPreview.textContent = 'Maksimal 200 baris per impor. Pecah file menjadi beberapa bagian.';
    } else {
      individualImportRows = result.rows;
      const contactNote = result.skippedContacts
        ? ` ${result.skippedContacts} kontak Instagram/WhatsApp tidak valid dan dilewati.`
        : '';
      importPreview.textContent = `${result.rows.length} baris siap diimpor.${contactNote}`;
    }
  } catch (error) {
    console.error(error);
    if (sequence !== importReadSequence) return;
    importPreview.textContent = 'Gagal membaca file. Pastikan format Excel/CSV sesuai template.';
  }
  updateUploadMode();
});

dropzone.addEventListener('click', () => {
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat menambah album.', 'error');
  if (getUploadBiodata()) return toast('Tab Biodata tidak memakai foto album.', 'info');
  imageInput.click();
});
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat menambah album.', 'error');
  if (getUploadBiodata()) return toast('Tab Biodata tidak memakai foto album.', 'info');
  const files = [...e.dataTransfer.files].filter(file => file.type.startsWith('image/'));
  if (files.length) handleFiles(files);
  else toast('File harus berupa gambar', 'error');
});
imageInput.addEventListener('change', (e) => {
  if (!canUploadMemories()) {
    imageInput.value = '';
    return toast('Hanya administrator yang dapat menambah album.', 'error');
  }
  if (getUploadBiodata()) {
    imageInput.value = '';
    return toast('Tab Biodata tidak memakai foto album.', 'info');
  }
  handleFiles([...e.target.files]);
});

const handleFiles = (files) => {
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat menambah album.', 'error');
  if (getUploadBiodata()) return;
  const validFiles = files.filter(file => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024);
  if (validFiles.length !== files.length) {
    toast('Beberapa foto dilewati karena bukan gambar atau lebih dari 5 MB.', 'error');
  }
  if (!validFiles.length) return;
  selectedFiles = validFiles.slice(0, 20);
  if (validFiles.length > 20) toast('Maksimal 20 foto dalam satu album.', 'error');

  galleryPreview.innerHTML = '';
  selectedFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const item = document.createElement('img');
      item.src = event.target.result;
      item.alt = `Pratinjau ${file.name}`;
      galleryPreview.appendChild(item);
    };
    reader.readAsDataURL(file);
  });
  dropzoneContent.classList.add('hidden');
  galleryPreview.classList.remove('hidden');
  updateUploadMode();
};

const handleAlbumUpload = async () => {
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat menambah album.', 'error');
  if (!state.user)   return toast('User belum siap', 'error');

  const targetGallery = getGalleryById(memoryGalleryInput.value);
  const btn     = uploadButton;
  const status  = $('upload-status');
  status.className = 'status';
  status.textContent = '';
  if (!targetGallery) {
    status.className = 'status error';
    status.textContent = 'Pilih galeri tujuan terlebih dahulu.';
    return;
  }
  if (!selectedFiles.length) {
    status.className = 'status error';
    status.textContent = 'Pilih foto album dulu.';
    return;
  }
  const name = $('memory-name-input').value.trim();
  if (!name) {
    status.className = 'status error';
    status.textContent = 'Masukkan judul album.';
    return;
  }
  const message = $('memory-message-input').value.trim();
  btn.disabled = true;
  btn.textContent = '⏳ Mengunggah...';
  const uploadedPhotoPaths = [];
  let memoryInserted = false;

  try {
    const { error: schemaError } = await sb.from('memories')
      .select('memory_type, gallery_id, name, message, photos')
      .limit(0);
    if (schemaError) {
      if (['42703', 'PGRST204'].includes(schemaError.code)) {
        throw new Error('Kolom album belum tersedia. Jalankan data.sql terbaru di Supabase SQL Editor.');
      }
      throw schemaError;
    }

    const photoUrls = [];
    for (const [index, file] of selectedFiles.entries()) {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${state.user.id}/${Date.now()}-${index}.${ext}`;
      const { error: upErr } = await sb.storage
        .from(PHOTO_BUCKET)
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      uploadedPhotoPaths.push(fileName);
      const { data: urlData } = sb.storage.from(PHOTO_BUCKET).getPublicUrl(fileName);
      photoUrls.push(urlData.publicUrl);
    }

    const { error: dbErr } = await sb.from('memories').insert({
      user_id: state.user.id,
      image_url: photoUrls[0],
      photos: photoUrls,
      memory_type: 'bersama',
      gallery_id: targetGallery.id,
      name,
      message: message || null,
    });
    if (dbErr) throw dbErr;
    memoryInserted = true;

    await logActivity('upload_memory');

    status.className = 'status success';
    status.textContent = '✅ Album berhasil disimpan!';

    selectedFiles = [];
    $('memory-name-input').value = '';
    $('memory-message-input').value = '';
    imageInput.value = '';
    galleryPreview.innerHTML = '';
    galleryPreview.classList.add('hidden');
    dropzoneContent.classList.remove('hidden');
    updateUploadMode();

    state.activeGalleryId = targetGallery.id;
    await loadMemories();
    switchTab('gallery');
  } catch (e) {
    console.error(e);
    let cleanupWarning = '';
    if (!memoryInserted && uploadedPhotoPaths.length) {
      try {
        const { error: cleanupError } = await sb.storage.from(PHOTO_BUCKET).remove(uploadedPhotoPaths);
        if (cleanupError) throw cleanupError;
      } catch (cleanupError) {
        console.error('Gagal membersihkan foto yang tidak tersimpan:', cleanupError);
        cleanupWarning = ' Sebagian foto yang gagal disimpan juga tidak dapat dibersihkan.';
      }
    }
    status.className = 'status error';
    status.textContent = memoryInserted
      ? 'Album sudah tersimpan, tetapi proses lanjutan gagal: ' + e.message
      : '❌ Gagal: ' + e.message + cleanupWarning;
  } finally {
    updateUploadMode();
  }
};

const handleIndividualUpload = async (targetGallery) => {
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat menambah data.', 'error');
  if (!state.user) return toast('User belum siap', 'error');

  const btn = uploadButton;
  const status = $('upload-status');
  status.className = 'status';
  status.textContent = '';
  const excelMode = individualMethodInput.value === 'excel';
  let records;

  if (excelMode) {
    if (!individualImportRows.length) {
      status.className = 'status error';
      status.textContent = 'Pilih file Excel atau CSV yang berisi data individu terlebih dahulu.';
      return;
    }
    records = individualImportRows;
  } else {
    const name = $('individual-name-input').value.trim();
    if (!name) {
      status.className = 'status error';
      status.textContent = 'Masukkan nama individu terlebih dahulu.';
      return;
    }
    const instagramInput = $('individual-instagram-input').value.trim();
    const whatsappInput = $('individual-whatsapp-input').value.trim();
    const instagramUrl = getInstagramUrl(instagramInput);
    const whatsappUrl = getWhatsAppUrl(whatsappInput);
    if (instagramInput && !instagramUrl) {
      status.className = 'status error';
      status.textContent = 'Masukkan username Instagram atau tautan profil yang valid.';
      return;
    }
    if (whatsappInput && !whatsappUrl) {
      status.className = 'status error';
      status.textContent = 'Masukkan nomor WhatsApp dengan kode negara, misalnya 628123456789.';
      return;
    }
    records = [{
      name,
      birth_info: $('individual-birth-info-input').value.trim() || null,
      full_address: $('individual-address-input').value.trim() || null,
      message: $('individual-caption-input').value.trim() || null,
      instagram: instagramUrl ? new URL(instagramUrl).pathname.split('/').filter(Boolean)[0] : null,
      whatsapp: whatsappUrl ? whatsappUrl.split('/').pop() : null,
    }];
  }

  btn.disabled = true;
  btn.textContent = '⏳ Menyimpan...';
  try {
    const { error: schemaError } = await sb.from('memories')
      .select('memory_type, gallery_id, name, birth_info, full_address, message, instagram, whatsapp, photos')
      .limit(0);
    if (schemaError) {
      if (['42703', 'PGRST204'].includes(schemaError.code)) {
        throw new Error('Kolom data individu belum tersedia. Jalankan data.sql terbaru di Supabase SQL Editor.');
      }
      throw schemaError;
    }

    const payload = records.map(record => ({
      user_id: state.user.id,
      image_url: PLACEHOLDER.image,
      photos: [],
      memory_type: 'individu',
      gallery_id: targetGallery.id,
      name: record.name,
      birth_info: record.birth_info,
      full_address: record.full_address,
      message: record.message,
      instagram: record.instagram,
      whatsapp: record.whatsapp,
    }));
    const { error: insertError } = await sb.from('memories').insert(payload);
    if (insertError) throw insertError;

    await logActivity('upload_memory', { gallery_id: targetGallery.id, count: payload.length });
    status.className = 'status success';
    status.textContent = excelMode
      ? `✅ ${payload.length} data individu berhasil diimpor!`
      : '✅ Data individu berhasil disimpan!';

    resetIndividualManualFields();
    individualImportRows = [];
    importInput.value = '';
    importPreview.textContent = '';

    state.activeGalleryId = targetGallery.id;
    await loadMemories();
    switchTab('gallery');
  } catch (error) {
    console.error(error);
    status.className = 'status error';
    status.textContent = '❌ Gagal: ' + error.message;
  } finally {
    updateUploadMode();
  }
};

uploadButton.addEventListener('click', () => {
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat menambah data.', 'error');
  const targetGallery = getGalleryById(memoryGalleryInput.value);
  if (!targetGallery) {
    const status = $('upload-status');
    status.className = 'status error';
    status.textContent = 'Pilih galeri tujuan terlebih dahulu.';
    return;
  }
  if (isBiodataGallery(targetGallery)) return handleIndividualUpload(targetGallery);
  return handleAlbumUpload();
});

// =========================================
// TABS
// =========================================
const markActiveTab = (name) => {
  $$('.tab-btn').forEach(btn => {
    const isActive = name === 'gallery' && btn.dataset.tab === 'gallery'
      ? String(btn.dataset.galleryId) === String(state.activeGalleryId)
      : btn.dataset.tab === name;
    btn.classList.toggle('active', isActive);
  });
  $$('.tab-content').forEach(content => content.classList.toggle('active', content.id === `tab-${name}`));
};

const switchTab = (name) => {
  if (['upload', 'admin'].includes(name) && state.user?.role !== 'admin') {
    toast('Fitur ini hanya tersedia untuk administrator.', 'error');
    name = 'gallery';
  }

  markActiveTab(name);
  $('gallery-toolbar').classList.toggle('hidden', name !== 'gallery');
  if (name === 'gallery') renderMemories();
  if (name === 'upload') fillUploadGallerySelect();
  if (name === 'admin') loadAdminData();
};

document.querySelector('.tabs').addEventListener('click', (event) => {
  const button = event.target.closest('.tab-btn');
  if (!button) return;
  if (button.dataset.tab === 'gallery') state.activeGalleryId = button.dataset.galleryId;
  switchTab(button.dataset.tab);
});

$$('.subtab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.subtab-btn').forEach(b => b.classList.toggle('active', b === btn));
    $$('.subtab-content').forEach(c =>
      c.classList.toggle('active', c.id === `subtab-${btn.dataset.subtab}`)
    );
  });
});

// =========================================
// ADMIN
// =========================================
const loadAdminData = async () => {
  if (state.user?.role !== 'admin') return;

  const [u, m, l] = await Promise.all([
    sb.from('users').select('*', { count: 'exact', head: true }),
    sb.from('memories').select('*', { count: 'exact', head: true }),
    sb.from('activity_logs').select('*', { count: 'exact', head: true }),
  ]);

  const failedQuery = [u, m, l].find(result => result.error);
  if (failedQuery) {
    toast('Gagal memuat ringkasan admin: ' + failedQuery.error.message, 'error');
    return;
  }

  $('stat-users').textContent    = u.count ?? 0;
  $('stat-memories').textContent = m.count ?? 0;
  $('stat-logs').textContent     = l.count ?? 0;

  await Promise.all([loadUsersTable(), loadGalleriesAdmin(), loadLogsTable()]);
};

const loadUsersTable = async () => {
  const { data, error } = await sb
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    toast('Gagal memuat pengguna: ' + error.message, 'error');
    return;
  }

  const tbody = $('users-tbody');
  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">Belum ada user</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(u => `
    <tr>
      <td>${escapeHtml(u.email)}${u.id === state.user.id ? ' <small class="muted">(anda)</small>' : ''}</td>
      <td>${escapeHtml(u.full_name || '-')}</td>
      <td><span class="role-badge ${u.role}">${u.role === 'admin' ? 'Admin' : 'User'}</span></td>
      <td>${u.active_device_id ? escapeHtml(u.active_device_info || 'Aktif') : '<span class="muted">-</span>'}</td>
      <td>
        <button class="btn-small btn-profile" data-edit-profile="${u.id}">Atur profil</button>
        <button class="btn-small btn-warn" data-toggle-role="${u.id}" data-current-role="${u.role}">
          ${u.role === 'admin' ? 'Jadikan user' : 'Jadikan admin'}
        </button>
        <button class="btn-small btn-danger" data-reset-device="${u.id}">Reset Device</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit-profile]').forEach(btn => {
    btn.addEventListener('click', () => {
      const profile = data.find(user => String(user.id) === String(btn.dataset.editProfile));
      if (!profile) return toast('Profil pengguna tidak ditemukan.', 'error');
      $('profile-edit-form').dataset.userId = profile.id;
      $('profile-edit-user').textContent = profile.full_name || profile.email;
      $('edit-profile-address').value = profile.address || '';
      $('edit-profile-instagram').value = profile.instagram || '';
      $('edit-profile-whatsapp').value = profile.whatsapp || '';
      $('edit-profile-bio').value = profile.bio || '';
      $('profile-edit-status').className = 'status';
      $('profile-edit-status').textContent = '';
      $('profile-edit-modal').classList.remove('hidden');
    });
  });

  tbody.querySelectorAll('[data-toggle-role]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleRole;
      const newRole = btn.dataset.currentRole === 'admin' ? 'user' : 'admin';
      if (id === state.user.id) return toast('Role akun yang sedang digunakan tidak dapat diubah.', 'error');

      const { error } = await sb.rpc('admin_set_user_role', {
        p_user_id: id,
        p_role: newRole,
      });
      if (error) return toast('Gagal: ' + error.message, 'error');

      toast(`Role diubah ke ${newRole}`, 'success');
      logActivity('admin_change_role', { target_id: id, new_role: newRole });
      loadUsersTable();
    });
  });

  tbody.querySelectorAll('[data-reset-device]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.resetDevice;
      if (!confirm('Reset device user ini?')) return;

      const { error } = await sb.rpc('admin_reset_user_device', {
        p_user_id: id,
      });

      if (error) return toast('Gagal: ' + error.message, 'error');
      toast('Device direset', 'success');
      logActivity('admin_reset_device', { target_id: id });
      loadUsersTable();
    });
  });
};

const galleryErrorMessage = (error) =>
  ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code)
    ? 'Tabel galeri belum tersedia. Jalankan data.sql terbaru di Supabase SQL Editor.'
    : error?.message || 'Terjadi kesalahan.';

const loadGalleriesAdmin = () => {
  const tbody = $('galleries-tbody');
  if (!tbody) return;
  if (!state.galleries.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="muted" style="text-align:center;padding:20px">Belum ada galeri</td></tr>';
    return;
  }

  tbody.innerHTML = state.galleries.map(gallery => {
    const count = state.memories.filter(memory => String(memory.gallery_id) === String(gallery.id)).length;
    return `
      <tr>
        <td><input class="gallery-name-input" type="text" maxlength="60" value="${escapeHtml(gallery.name)}" aria-label="Nama tab ${escapeHtml(gallery.name)}" /></td>
        <td>${count}</td>
        <td><button class="btn-small btn-profile" data-save-gallery="${escapeHtml(String(gallery.id))}" type="button">Simpan nama</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-save-gallery]').forEach(button => {
    const row = button.closest('tr');
    const input = row?.querySelector('.gallery-name-input');
    button.addEventListener('click', () => renameGallery(button.dataset.saveGallery, input, button));
    input?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      renameGallery(button.dataset.saveGallery, input, button);
    });
  });
};

const refreshGalleryData = async () => {
  await loadGalleries();
  renderMemories();
  loadGalleriesAdmin();
};

const renameGallery = async (id, input, button) => {
  if (state.user?.role !== 'admin') return toast('Akses administrator diperlukan.', 'error');
  const gallery = getGalleryById(id);
  if (!gallery || !input) return;
  const name = input.value.trim();
  if (!name) return toast('Nama galeri tidak boleh kosong.', 'error');
  if (name === gallery.name) return toast('Nama galeri belum berubah.', 'info');

  button.disabled = true;
  const { error } = await sb.from('galleries').update({ name }).eq('id', gallery.id);
  button.disabled = false;
  if (error) {
    return toast('Gagal mengubah nama: ' + (error.code === '23505' ? 'Nama galeri sudah dipakai.' : galleryErrorMessage(error)), 'error');
  }

  logActivity('rename_gallery', { gallery_id: gallery.id, name });
  toast('Nama tab diperbarui.', 'success');
  await refreshGalleryData();
};

$('gallery-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.user?.role !== 'admin') return toast('Akses administrator diperlukan.', 'error');

  const input = $('gallery-name-input');
  const status = $('gallery-admin-status');
  const button = event.submitter || $('gallery-form').querySelector('button[type="submit"]');
  const name = input.value.trim();
  status.className = 'status';
  if (!name) {
    status.className = 'status error';
    status.textContent = 'Isi nama galeri terlebih dahulu.';
    return;
  }
  if (state.galleries.some(gallery => gallery.name.trim().toLowerCase() === name.toLowerCase())) {
    status.className = 'status error';
    status.textContent = 'Nama galeri sudah dipakai.';
    return;
  }

  button.disabled = true;
  status.textContent = 'Menyimpan galeri...';
  const sortOrder = state.galleries.reduce((max, gallery) => Math.max(max, Number(gallery.sort_order) || 0), 0) + 1;
  const { error } = await sb.from('galleries').insert({ name, sort_order: sortOrder });
  button.disabled = false;
  if (error) {
    status.className = 'status error';
    status.textContent = error.code === '23505'
      ? 'Nama galeri sudah dipakai.'
      : 'Gagal menambah galeri: ' + galleryErrorMessage(error);
    return;
  }

  input.value = '';
  status.className = 'status success';
  status.textContent = 'Galeri baru berhasil ditambahkan.';
  logActivity('create_gallery', { name });
  await refreshGalleryData();
});

const loadLogsTable = async (search = '') => {
  const { data, error } = await sb
    .from('activity_logs')
    .select('id, user_id, action, metadata, device_info, created_at, users(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  const tbody = $('logs-tbody');

  if (error) {
    console.error('LOGS ERR:', error.message);
    tbody.innerHTML = `<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;color:#ef4444">Gagal load: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  let rows = data ?? [];
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(l =>
      (l.action || '').toLowerCase().includes(q) ||
      (l.users?.email || '').toLowerCase().includes(q) ||
      (l.users?.full_name || '').toLowerCase().includes(q)
    );
  }

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted" style="text-align:center;padding:20px">${PLACEHOLDER.logEmpty}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(l => `
    <tr>
      <td>${fmtDateTime(l.created_at)}</td>
      <td>${escapeHtml(l.users?.email || '-')}<br><small class="muted">${escapeHtml(l.users?.full_name || '')}</small></td>
      <td><strong>${escapeHtml(l.action)}</strong></td>
      <td><small class="muted">${escapeHtml(JSON.stringify(l.metadata || {}))}</small></td>
    </tr>
  `).join('');
};

$('log-search').addEventListener('input', (e) => loadLogsTable(e.target.value));
$('refresh-logs').addEventListener('click', () => loadLogsTable($('log-search').value));

// =========================================
// AUTHENTICATION
// =========================================
let loginRole = 'user';
let authMode = 'login';

const setAuthStatus = (message = '', type = '') => {
  const status = $('auth-status');
  status.textContent = message;
  status.className = `auth-status${type ? ` ${type}` : ''}`;
};

const renderAuthMode = () => {
  const isSignup = authMode === 'signup';
  $('auth-heading').textContent = isSignup ? 'Buat akun Memori' : 'Masuk ke Memori';
  $('auth-description').textContent = isSignup
    ? 'Buat akun pengguna untuk mulai menyimpan cerita.'
    : 'Masuk untuk membuka kembali cerita favoritmu.';
  $('auth-submit').innerHTML = isSignup
    ? 'Buat akun pengguna <span>→</span>'
    : 'Masuk ke akun <span>→</span>';
  $('auth-switch-prompt').textContent = isSignup ? 'Sudah punya akun?' : 'Belum punya akun?';
  $('auth-switch-mode').textContent = isSignup ? 'Masuk' : 'Daftar sebagai pengguna';
  $('name-field').classList.toggle('hidden', !isSignup);
  $('auth-name').required = isSignup;
  $('auth-password').autocomplete = isSignup ? 'new-password' : 'current-password';
  $('login-role-picker').classList.toggle('hidden', isSignup);
  setAuthStatus();
};

$$('[data-login-role]').forEach(button => {
  button.addEventListener('click', () => {
    loginRole = button.dataset.loginRole;
    $$('[data-login-role]').forEach(option => option.classList.toggle('active', option === button));
    setAuthStatus();
  });
});

$('auth-switch-mode').addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  loginRole = 'user';
  $$('[data-login-role]').forEach(option =>
    option.classList.toggle('active', option.dataset.loginRole === loginRole)
  );
  renderAuthMode();
});

$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('auth-submit');
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  const isSignup = authMode === 'signup';

  button.disabled = true;
  setAuthStatus(isSignup ? 'Membuat akun...' : 'Memeriksa akun...');

  try {
    if (isSignup) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: $('auth-name').value.trim() } },
      });
      if (error) throw error;

      if (!data.session) {
        setAuthStatus('Akun dibuat. Periksa email untuk mengonfirmasi, lalu masuk.', 'success');
        return;
      }
      try {
        await activateSession(data.user, 'user');
      } catch (activationError) {
        await sb.auth.signOut();
        throw activationError;
      }
      return;
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    try {
      await activateSession(data.user, loginRole);
    } catch (activationError) {
      await sb.auth.signOut();
      throw activationError;
    }
  } catch (error) {
    console.error(error);
    setAuthStatus(error.message || 'Tidak dapat memproses akun.', 'error');
  } finally {
    button.disabled = false;
  }
});

$('logout-btn').addEventListener('click', async () => {
  const { error } = await sb.auth.signOut();
  if (error) return toast('Gagal keluar: ' + error.message, 'error');
  showAuth();
  $('auth-form').reset();
  authMode = 'login';
  loginRole = 'user';
  $$('[data-login-role]').forEach(option =>
    option.classList.toggle('active', option.dataset.loginRole === loginRole)
  );
  renderAuthMode();
});

document.querySelector('[data-go-tab="upload"]').addEventListener('click', () => switchTab('upload'));

// =========================================
// PROFILE MODAL
// =========================================
$('profile-btn').addEventListener('click', () => openProfileModal(state.user));
$('profile-close').addEventListener('click', () => $('profile-modal').classList.add('hidden'));
$('profile-modal').addEventListener('click', (e) => {
  if (e.target.id === 'profile-modal') $('profile-modal').classList.add('hidden');
});
$('profile-edit-close').addEventListener('click', () => $('profile-edit-modal').classList.add('hidden'));
$('profile-edit-modal').addEventListener('click', (e) => {
  if (e.target.id === 'profile-edit-modal') $('profile-edit-modal').classList.add('hidden');
});
$('profile-edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.user?.role !== 'admin') return toast('Akses administrator diperlukan.', 'error');

  const form = $('profile-edit-form');
  const userId = form.dataset.userId;
  if (!userId) return toast('Pilih akun yang akan diperbarui.', 'error');
  const address = $('edit-profile-address').value.trim();
  const instagramInput = $('edit-profile-instagram').value.trim();
  const whatsappInput = $('edit-profile-whatsapp').value.trim();
  const bio = $('edit-profile-bio').value.trim();
  const instagramUrl = getInstagramUrl(instagramInput);
  const whatsappUrl = getWhatsAppUrl(whatsappInput);
  const status = $('profile-edit-status');

  if (instagramInput && !instagramUrl) {
    status.className = 'status error';
    status.textContent = 'Masukkan username Instagram atau tautan profil yang valid.';
    return;
  }
  if (whatsappInput && !whatsappUrl) {
    status.className = 'status error';
    status.textContent = 'Masukkan nomor WhatsApp dengan kode negara, misalnya 628123456789.';
    return;
  }

  const profileUpdates = {
    address: address || null,
    instagram: instagramUrl ? new URL(instagramUrl).pathname.split('/').filter(Boolean)[0] : null,
    whatsapp: whatsappUrl ? whatsappUrl.split('/').pop() : null,
    bio: bio || null,
  };
  const saveButton = $('profile-edit-save');
  saveButton.disabled = true;
  status.className = 'status';
  status.textContent = 'Menyimpan profil...';

  try {
    const { error } = await sb.from('users')
      .update(profileUpdates)
      .eq('id', userId)
      .select('id')
      .single();
    if (error) throw error;

    if (String(state.user.id) === String(userId)) {
      Object.assign(state.user, profileUpdates);
      loadProfileUI();
    }
    await logActivity('admin_update_profile', { target_id: userId });
    $('profile-edit-modal').classList.add('hidden');
    await loadMemories();
    toast('Profil berhasil diperbarui.', 'success');
    if (document.querySelector('.tab-btn.active')?.dataset.tab === 'admin') {
      await loadUsersTable();
    }
  } catch (error) {
    console.error('Gagal memperbarui profil pengguna:', error);
    status.className = 'status error';
    status.textContent = `Gagal menyimpan: ${error.message}`;
  } finally {
    saveButton.disabled = false;
  }
});

// =========================================
// INIT
// =========================================
setupAppUpdates();
renderAuthMode();
bootstrap();