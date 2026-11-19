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
  heartbeat: null,
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

// Placeholder handling untuk <img>
const imgWithFallback = (src, alt = '') =>
  `<img src="${escapeHtml(src || PLACEHOLDER.image)}" alt="${escapeHtml(alt)}"
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

const showAuth = () => {
  state.user = null;
  clearInterval(state.heartbeat);
  $('app-section').classList.add('hidden');
  $('auth-section').classList.remove('hidden');
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
const loadProfileUI = () => {
  const u = state.user;
  const avatar = u.avatar_url || PLACEHOLDER.avatar(u.full_name || 'U');

  $('nav-avatar-img').src = avatar;
  $('profile-avatar').src  = avatar;
  $('profile-name').textContent  = u.full_name || '-';
  $('profile-email').textContent = u.email;
  $('profile-role').textContent  = u.role === 'admin' ? 'Administrator' : 'Pengguna';
  $('profile-role').className    = `role-badge ${u.role}`;
  $('profile-device').textContent = u.active_device_info || getDeviceInfo();
  $('profile-joined').textContent = fmtDate(u.created_at);
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
  const { data: memories, error } = await sb
    .from('memories')
    .select('id, user_id, image_url, caption, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('MEM ERR:', error.message);
    toast('Gagal load memori: ' + error.message, 'error');
    return;
  }

  const userIds = [...new Set((memories ?? []).map(memory => memory.user_id))];
  let profiles = [];
  if (userIds.length) {
    const { data, error: profileError } = await sb
      .from('memory_user_profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);
    if (profileError) {
      toast('Gagal memuat profil pemilik memori: ' + profileError.message, 'error');
      return;
    }
    profiles = data ?? [];
  }

  state.memories = (memories ?? []).map(memory => ({
    ...memory,
    users: profiles.find(profile => profile.id === memory.user_id) ?? null,
  }));
  renderMemories();
};

const renderMemories = () => {
  const gallery = $('gallery');
  const empty   = $('gallery-empty');
  const count   = $('memory-count');

  count.textContent = `${state.memories.length} memori`;

  if (state.memories.length === 0) {
    gallery.innerHTML = '';
    empty.classList.remove('hidden');
    empty.querySelector('p').textContent = PLACEHOLDER.galleryEmpty;
    return;
  }
  empty.classList.add('hidden');

  gallery.innerHTML = state.memories.map(m => {
    const isOwner = m.user_id === state.user.id;
    const isAdmin = state.user.role === 'admin';
    const canDelete = isOwner || isAdmin;
    const ownerName = m.users?.full_name ?? 'Anonim';

    return `
      <div class="memory-card" data-id="${m.id}">
        ${imgWithFallback(m.image_url, m.caption || 'memori')}
        <div class="memory-caption">${escapeHtml(m.caption || 'Tanpa caption')}</div>
        <div class="memory-owner">oleh ${escapeHtml(ownerName)}</div>
        ${canDelete ? `<button class="delete-memory" data-del="${m.id}" title="Hapus">×</button>` : ''}
      </div>
    `;
  }).join('');

  gallery.querySelectorAll('.memory-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-memory')) return;
      openMemoryModal(card.dataset.id);
    });
  });

  gallery.querySelectorAll('.delete-memory').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteMemory(btn.dataset.del);
    });
  });
};

// =========================================
// MEMORY MODAL
// =========================================
const openMemoryModal = (id) => {
  const m = state.memories.find(x => String(x.id) === String(id));
  if (!m) return;
  $('memory-view-img').src        = m.image_url || PLACEHOLDER.image;
  $('memory-view-img').onerror    = (ev) => { ev.target.onerror = null; ev.target.src = PLACEHOLDER.image; };
  $('memory-view-caption').textContent = m.caption || 'Tanpa caption';
  $('memory-view-date').textContent    = fmtDateTime(m.created_at);
  $('memory-modal').classList.remove('hidden');
};

$('memory-close').addEventListener('click', () => $('memory-modal').classList.add('hidden'));
$('memory-modal').addEventListener('click', (e) => {
  if (e.target.id === 'memory-modal') $('memory-modal').classList.add('hidden');
});

// =========================================
// DELETE MEMORY
// =========================================
const deleteMemory = async (id) => {
  if (!confirm('Hapus memori ini?')) return;
  const m = state.memories.find(x => String(x.id) === String(id));
  if (!m) return;

  try {
    const url = new URL(m.image_url);
    const marker = '/storage/v1/object/public/memories/';
    const idx = url.pathname.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(url.pathname.slice(idx + marker.length));
      await sb.storage.from('memories').remove([path]);
    }
  } catch { /* ignore */ }

  const { error } = await sb.from('memories').delete().eq('id', id);
  if (error) return toast('Gagal hapus: ' + error.message, 'error');

  toast('Memori dihapus', 'success');
  logActivity('delete_memory', { memory_id: id });
  loadMemories();
};

// =========================================
// UPLOAD
// =========================================
const dropzone         = $('dropzone');
const imageInput       = $('image-input');
const previewImg       = $('preview-img');
const dropzoneContent  = $('dropzone-content');
let selectedFile = null;
const canUploadMemories = () => state.user?.role === 'admin';

dropzone.addEventListener('click', () => {
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat menambah memori.', 'error');
  imageInput.click();
});
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat menambah memori.', 'error');
  const f = e.dataTransfer.files[0];
  if (f?.type.startsWith('image/')) handleFile(f);
  else toast('File harus berupa gambar', 'error');
});
imageInput.addEventListener('change', (e) => {
  if (!canUploadMemories()) {
    imageInput.value = '';
    return toast('Hanya administrator yang dapat menambah memori.', 'error');
  }
  const f = e.target.files[0];
  if (f) handleFile(f);
});

const handleFile = (file) => {
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat menambah memori.', 'error');
  if (file.size > 5 * 1024 * 1024) return toast('Ukuran maksimal 5MB', 'error');
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewImg.classList.remove('hidden');
    dropzoneContent.classList.add('hidden');
  };
  reader.readAsDataURL(file);
};

$('upload-btn').addEventListener('click', async () => {
  if (!canUploadMemories()) return toast('Hanya administrator yang dapat menambah memori.', 'error');
  if (!selectedFile) return toast('Pilih gambar dulu', 'error');
  if (!state.user)   return toast('User belum siap', 'error');

  const caption = $('caption-input').value.trim();
  const btn     = $('upload-btn');
  const status  = $('upload-status');

  btn.disabled = true;
  btn.textContent = '⏳ Mengunggah...';
  status.className = 'status';
  status.textContent = '';

  try {
    const ext = selectedFile.name.split('.').pop() || 'jpg';
    const fileName = `${state.user.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await sb.storage
      .from('memories')
      .upload(fileName, selectedFile, { cacheControl: '3600', upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = sb.storage.from('memories').getPublicUrl(fileName);

    const { error: dbErr } = await sb.from('memories').insert({
      user_id: state.user.id,
      image_url: urlData.publicUrl,
      caption,
    });
    if (dbErr) throw dbErr;

    await logActivity('upload_memory', { caption });

    status.className = 'status success';
    status.textContent = '✅ Memori berhasil disimpan!';

    selectedFile = null;
    $('caption-input').value = '';
    imageInput.value = '';
    previewImg.classList.add('hidden');
    previewImg.src = '';
    dropzoneContent.classList.remove('hidden');

    await loadMemories();
    setTimeout(() => switchTab('gallery'), 700);
  } catch (e) {
    console.error(e);
    status.className = 'status error';
    status.textContent = '❌ Gagal: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Simpan Memori';
  }
});

// =========================================
// TABS
// =========================================
const switchTab = (name) => {
  if (['upload', 'admin'].includes(name) && state.user?.role !== 'admin') {
    toast('Fitur ini hanya tersedia untuk administrator.', 'error');
    name = 'gallery';
  }

  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${name}`));
  if (name === 'admin') loadAdminData();
};

$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
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

  await Promise.all([loadUsersTable(), loadLogsTable()]);
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
        <button class="btn-small btn-warn" data-toggle-role="${u.id}" data-current-role="${u.role}">
          ${u.role === 'admin' ? 'Jadikan user' : 'Jadikan admin'}
        </button>
        <button class="btn-small btn-danger" data-reset-device="${u.id}">Reset Device</button>
      </td>
    </tr>
  `).join('');

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
$('profile-btn').addEventListener('click', () => $('profile-modal').classList.remove('hidden'));
$('profile-close').addEventListener('click', () => $('profile-modal').classList.add('hidden'));
$('profile-modal').addEventListener('click', (e) => {
  if (e.target.id === 'profile-modal') $('profile-modal').classList.add('hidden');
});

// =========================================
// INIT
// =========================================
setupAppUpdates();
renderAuthMode();
bootstrap();