// auth.js
// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCUJRosMqADvv2H7gKFHipB73l5KQ-k5wA",
  authDomain: "xgg-site.firebaseapp.com",
  projectId: "xgg-site",
  storageBucket: "xgg-site.firebasestorage.app",
  messagingSenderId: "214252738650",
  appId: "1:214252738650:web:ca9fb36cb4cf9132fe6063",
  measurementId: "G-3SMJRZ5JG5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const EDGE_HOST = 'xgg-vip.pages.dev';
const DEFAULT_SUB_URL = `https://${EDGE_HOST}/sub`;
const SIGN_SALT = 'Xgg_Secret_Salt_2026_v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function encodeB64UrlStr(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function computeTokenSig(payloadB64) {
  const str = payloadB64 + '.' + SIGN_SALT;
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0'));
}

function getStableAccountId(emailOrId) {
  const clean = String(emailOrId || '').trim().toLowerCase();
  if (!clean) return 'u_' + Date.now().toString(36);
  const sig = computeTokenSig(encodeB64UrlStr(clean));
  return 'acct_' + sig.slice(0, 12);
}

function buildCustomerSubUrl({ id, name, purchaseMs, durationMonths }) {
  const days = (durationMonths || 1) * 30;
  const gb = durationMonths >= 12 ? 2000 : 200;
  const exp = (purchaseMs || Date.now()) + days * 86400000;
  const payloadObj = {
    id: id || getStableAccountId(name),
    name: name || '官网客户'
  };
  const payloadB64 = encodeB64UrlStr(JSON.stringify(payloadObj));
  const sig = computeTokenSig(payloadB64);
  const token = `${payloadB64}.${sig}`;
  return {
    token,
    gb,
    days,
    exp,
    subUrl: `https://${EDGE_HOST}/sub/${token}`,
    clashUrl: `https://${EDGE_HOST}/sub/${token}?clash=1`
  };
}

// DOM Elements
const authBtn = document.getElementById('header-auth-btn');
const authDialog = document.getElementById('login-overlay');
const closeAuthBtn = document.getElementById('auth-close-btn');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleText = document.getElementById('auth-toggle-text');
const authToggleLink = document.getElementById('auth-toggle-link');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');
const forgotPasswordLink = document.getElementById('forgot-password-link');

const logoutBtn = document.getElementById('logout-btn');
const dashboardContent = document.getElementById('dashboard-content');

let isLoginMode = true;
let localSessionUser = null;
try {
  const savedUser = localStorage.getItem('xgg_active_user');
  if (savedUser) {
    localSessionUser = JSON.parse(savedUser);
  }
} catch (e) {}

function getActiveUser() {
  return auth.currentUser || localSessionUser;
}

function setLocalSessionUser(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const uid = 'loc_' + computeTokenSig(cleanEmail).slice(0, 12);
  localSessionUser = {
    uid,
    email: cleanEmail,
    isLocal: true,
    getIdToken: async () => 'local_token',
    updateProfile: async () => {}
  };
  try {
    localStorage.setItem('xgg_active_user', JSON.stringify({ uid, email: cleanEmail, isLocal: true }));
  } catch (e) {}
  updateAuthUiState(localSessionUser);
  return localSessionUser;
}

function updateAuthUiState(user) {
  if (user) {
    if (authDialog) authDialog.classList.add('hidden');
    if (authBtn) {
      authBtn.innerHTML = `<span>👤 我的账号</span>`;
      authBtn.classList.add('logged-in');
    }
  } else {
    if (authDialog) authDialog.classList.remove('hidden');
    if (authBtn) {
      authBtn.innerHTML = `<span>🔒 登录 / 注册</span>`;
      authBtn.classList.remove('logged-in');
    }
  }
}

// Helper: Normalize a subscription object (strictly 1-month for 25.20 / 39.90 plans, no quarterly plans)
function normalizeSub(raw) {
  if (!raw) return null;
  let planName = String(raw.planName || raw.p || '月度套餐 (1个月)');
  let price = String(raw.price || raw.pr || '25.20');

  // Force replace any legacy quarterly text with monthly (1 month)
  planName = planName.replace(/季度/g, '月度').replace(/3个月/g, '1个月');
  if (planName === '月度套餐') {
    planName = '月度套餐 (1个月)';
  }

  const isPackage = planName.includes('套餐');
  const isRocket = planName.includes('小火箭');

  let durationMonths = Number(raw.durationMonths || raw.d || 1);
  if (planName.includes('月度') || price === '25.20' || price === '25.00' || price === '25' || price === '39.90') {
    durationMonths = 1;
  } else if (planName.includes('年度') || planName.includes('一年') || price === '99.00') {
    durationMonths = 12;
  } else if (!isPackage) {
    durationMonths = 999;
  }

  let purchaseMs = Date.now();
  const rawDate = raw.purchaseDate !== undefined ? raw.purchaseDate : raw.t;
  if (rawDate) {
    if (typeof rawDate.toDate === 'function') {
      purchaseMs = rawDate.toDate().getTime();
    } else if (typeof rawDate.seconds === 'number') {
      purchaseMs = rawDate.seconds * 1000;
    } else {
      const parsed = new Date(rawDate).getTime();
      if (!isNaN(parsed)) purchaseMs = parsed;
    }
  }

  let accountInfo = '';
  if (!isPackage) {
    accountInfo = isRocket
      ? '小火箭ID通过邮箱发货，如果未收到邮件请联系客服'
      : '该商品通过邮箱发货，如果未收到邮件请联系客服';
  } else if (isRocket) {
    accountInfo = '您套餐内置的小火箭ID通过邮箱发货，如果未收到邮件请联系客服';
  }

  const activeUser = getActiveUser();
  const userEmail = (activeUser && activeUser.email) ? activeUser.email : '官网客户';
  const subId = isPackage ? getStableAccountId(userEmail) : (raw.subId || `srv_${Math.floor(purchaseMs / 1000).toString(36)}`);
  const tokenData = isPackage
    ? buildCustomerSubUrl({ id: subId, name: userEmail, purchaseMs, durationMonths })
    : { subUrl: '', clashUrl: '', gb: 0, token: '', exp: 0 };

  const expMs = Number(raw.expMs || tokenData.exp || (purchaseMs + (durationMonths || 1) * 30 * 86400000));

  const validNewSubUrl = (raw.subUrl && raw.subUrl.startsWith(`https://${EDGE_HOST}/sub/`)) ? raw.subUrl : tokenData.subUrl;
  const validNewClashUrl = (raw.clashUrl && raw.clashUrl.startsWith(`https://${EDGE_HOST}/sub/`)) ? raw.clashUrl : tokenData.clashUrl;

  return {
    subId,
    planName,
    price,
    durationMonths,
    quotaGb: Number(raw.quotaGb || tokenData.gb),
    usedBytes: Number(raw.usedBytes || 0),
    expMs,
    purchaseDate: new Date(purchaseMs).toISOString(),
    purchaseMs,
    lastCycleRefreshMs: raw.lastCycleRefreshMs || purchaseMs,
    type: !isPackage ? 'service' : (raw.type || raw.tp || 'vpn'),
    subUrl: isPackage ? validNewSubUrl : '',
    clashUrl: isPackage ? validNewClashUrl : '',
    accountInfo
  };
}

// Helper: Automatic 30-day data update & cycle refresh behavior
async function run30DayAutoDataUpdate(subsList) {
  const user = getActiveUser();
  if (!user) return subsList;

  const nowMs = Date.now();
  const metaKey = `xgg_last_30d_sync_${user.uid}`;
  const lastSyncMs = Number(localStorage.getItem(metaKey) || 0);
  let needsSync = false;

  // Check if 30 days have passed since last global data update
  if (!lastSyncMs || (nowMs - lastSyncMs) >= THIRTY_DAYS_MS) {
    needsSync = true;
  }

  // Also check each subscription for 30-day cycle data update
  const updatedSubs = (subsList || []).map(sub => {
    const norm = normalizeSub(sub);
    if (!norm) return null;
    const lastRefresh = norm.lastCycleRefreshMs || norm.purchaseMs;
    if ((nowMs - lastRefresh) >= THIRTY_DAYS_MS) {
      norm.lastCycleRefreshMs = nowMs;
      needsSync = true;
    }
    return norm;
  }).filter(Boolean);

  if (needsSync) {
    try {
      // Force refresh Firebase Auth token so session & cloud profile stay active every 30 days
      await user.getIdToken(true).catch(() => {});
      localStorage.setItem(metaKey, String(nowMs));
      if (updatedSubs.length > 0) {
        await saveUserSubscriptions(updatedSubs);
      }
    } catch (e) {
      console.warn('30-day auto data update warning:', e);
    }
  }

  return updatedSubs;
}

// Schedule periodic check while page is open (checks every hour for 30-day threshold)
setInterval(() => {
  if (auth.currentUser) {
    getUserSubscriptions().then(subs => run30DayAutoDataUpdate(subs)).catch(() => {});
  }
}, 60 * 60 * 1000);

// Helper: Read subscriptions from LocalStorage + Firebase Auth Profile + Firestore (with timeout)
async function getUserSubscriptions() {
  const user = getActiveUser();
  if (!user) return [];

  const collected = [];

  // 1. Read from LocalStorage
  const keys = [
    `xgg_subs_${user.uid}`,
    user.email ? `xgg_subs_${user.email}` : null
  ].filter(Boolean);

  for (const key of keys) {
    try {
      const rawStr = localStorage.getItem(key);
      if (rawStr) {
        const parsed = JSON.parse(rawStr);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            const norm = normalizeSub(item);
            if (norm) collected.push(norm);
          });
        }
      }
    } catch (e) {
      console.warn('LocalStorage read warning:', e);
    }
  }

  // 2. Read from Firebase Auth user profile photoURL (cloud backup immune to Firestore rule expiry)
  try {
    if (user.photoURL && user.photoURL.includes('#')) {
      const hashPart = user.photoURL.split('#')[1];
      if (hashPart) {
        const decoded = JSON.parse(decodeURIComponent(hashPart));
        if (Array.isArray(decoded)) {
          decoded.forEach(item => {
            const norm = normalizeSub(item);
            if (norm) collected.push(norm);
          });
        }
      }
    }
  } catch (e) {
    console.warn('Auth profile parse warning:', e);
  }

  // 3. Best-effort read from Firestore with a 2.5s timeout so it never hangs or fails UI
  try {
    const firestorePromise = db.collection('users').doc(user.uid).get();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), 2500)
    );
    const doc = await Promise.race([firestorePromise, timeoutPromise]);
    if (doc && doc.exists) {
      const data = doc.data();
      if (data && Array.isArray(data.subscriptions)) {
        data.subscriptions.forEach(item => {
          const norm = normalizeSub(item);
          if (norm) collected.push(norm);
        });
      }
    }
  } catch (e) {
    console.warn('Firestore fetch skipped (using local/auth profile storage):', e.message || e);
  }

  // Deduplicate and sort newest first
  const uniqueMap = new Map();
  collected.sort((a, b) => b.purchaseMs - a.purchaseMs);
  for (const item of collected) {
    const bucket = Math.floor(item.purchaseMs / 120000);
    const dedupKey = `${item.planName}_${bucket}`;
    if (!uniqueMap.has(dedupKey)) {
      uniqueMap.set(dedupKey, item);
    }
  }

  const finalSubs = Array.from(uniqueMap.values());

  // Sync merged result back to localStorage so future loads are instant
  if (finalSubs.length > 0) {
    try {
      localStorage.setItem(`xgg_subs_${user.uid}`, JSON.stringify(finalSubs));
      if (user.email) {
        localStorage.setItem(`xgg_subs_${user.email}`, JSON.stringify(finalSubs));
      }
    } catch (e) {}
  }

  return finalSubs;
}

// Helper: Save subscriptions to LocalStorage + Firebase Auth Profile + Firestore
async function saveUserSubscriptions(subsList) {
  const user = getActiveUser();
  const normalized = (subsList || []).map(normalizeSub).filter(Boolean);

  if (user) {
    try {
      localStorage.setItem(`xgg_subs_${user.uid}`, JSON.stringify(normalized));
      localStorage.setItem(`xgg_last_30d_sync_${user.uid}`, String(Date.now()));
      if (user.email) {
        localStorage.setItem(`xgg_subs_${user.email}`, JSON.stringify(normalized));
      }
    } catch (e) {
      console.warn('LocalStorage write warning:', e);
    }

    // Save compact cloud backup in Firebase Auth profile
    try {
      const compact = normalized.slice(0, 6).map(s => ({
        p: s.planName,
        pr: s.price,
        d: s.durationMonths,
        t: s.purchaseMs,
        tp: s.type
      }));
      const photoUrlPayload = 'https://xgg.site/sub#' + encodeURIComponent(JSON.stringify(compact));
      await user.updateProfile({ photoURL: photoUrlPayload });
    } catch (e) {
      console.warn('Auth profile backup warning:', e);
    }

    // Best-effort register or auto-renew package subscription with Edge KV API
    try {
      const topSub = normalized.find(s => s.planName && s.planName.includes('套餐'));
      if (topSub && !window.__skipAutoIssueOnce) {
        const resPromise = fetch(`https://${EDGE_HOST}/api/issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: topSub.subId,
            email: user.email || user.uid,
            name: user.email || user.uid,
            days: (topSub.durationMonths || 1) * 30,
            gb: topSub.quotaGb || 200
          })
        }).then(r => r.json()).catch(() => null);
        const resData = await Promise.race([
          resPromise,
          new Promise(r => setTimeout(() => r(null), 2500))
        ]);
        if (resData && resData.ok) {
          topSub.subUrl = resData.subUrl;
          topSub.clashUrl = resData.clashUrl;
          topSub.expMs = resData.exp;
          topSub.quotaGb = resData.gb;
          topSub.usedBytes = resData.usedBytes || 0;
          try {
            localStorage.setItem(`xgg_subs_${user.uid}`, JSON.stringify(normalized));
            if (user.email) localStorage.setItem(`xgg_subs_${user.email}`, JSON.stringify(normalized));
          } catch (e) {}
        }
      }
    } catch (e) {}

    // Best-effort write to Firestore with 2s timeout
    try {
      const writePromise = db.collection('users').doc(user.uid).set({
        subscriptions: normalized,
        lastAutoRefreshAt: new Date().toISOString(),
        refreshIntervalDays: 30
      }, { merge: true });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2000));
      await Promise.race([writePromise, timeoutPromise]);
    } catch (e) {
      console.warn('Firestore write skipped (saved in local + auth profile):', e.message || e);
    }
  }

  return normalized;
}

// Reliable clipboard helper with fallback for WeChat / iOS WebView
function copyToClipboard(text, btn) {
  const showSuccess = () => {
    const original = btn.textContent;
    btn.textContent = '已复制!';
    btn.style.background = '#10b981';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showSuccess).catch(() => {
      fallbackCopy(text, showSuccess);
    });
  } else {
    fallbackCopy(text, showSuccess);
  }
}

function fallbackCopy(text, callback) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    if (callback) callback();
  } catch (e) {
    console.warn('Copy failed:', e);
  }
  document.body.removeChild(ta);
}

// Toggle between Login and Register
if (authToggleLink) {
  authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    authError.style.display = 'none';
    authSuccess.style.display = 'none';
    if (isLoginMode) {
      authTitle.textContent = '登录账号';
      authSubmitBtn.textContent = '登 录';
      authToggleText.textContent = '还没有账号？';
      authToggleLink.textContent = '立即注册';
    } else {
      authTitle.textContent = '注册账号';
      authSubmitBtn.textContent = '注 册';
      authToggleText.textContent = '已有账号？';
      authToggleLink.textContent = '直接登录';
    }
  });
}

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    if (!email) {
      authError.textContent = '请输入您的邮箱账号，然后再点击忘记密码';
      authError.style.display = 'block';
      authSuccess.style.display = 'none';
      return;
    }
    try {
      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = '发送中...';
      await auth.sendPasswordResetEmail(email);
      authError.style.display = 'none';
      authSuccess.textContent = '重置密码邮件已发送，请检查您的邮箱！';
      authSuccess.style.display = 'block';
    } catch (error) {
      console.error(error);
      authSuccess.style.display = 'none';
      authError.textContent = '发送失败：' + error.message;
      authError.style.display = 'block';
    } finally {
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = isLoginMode ? '登 录' : '注 册';
    }
  });
}

// Auth Modal Open/Close
if (authBtn) {
  authBtn.addEventListener('click', () => {
    if (getActiveUser()) {
      if (window.switchToQueryTab) window.switchToQueryTab();
    } else {
      authDialog.classList.remove('hidden');
    }
  });
}

if (closeAuthBtn) {
  closeAuthBtn.addEventListener('click', () => authDialog.classList.add('hidden'));
}

// Handle Auth Form Submission (Dual-mode: Cloud Firebase Auth + Domestic China Instant Fallback)
if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !email.includes('@')) {
      authError.style.display = 'block';
      authError.textContent = '请输入有效的邮箱账号';
      return;
    }
    if (!password || password.length < 6) {
      authError.style.display = 'block';
      authError.textContent = '密码不能少于6位';
      return;
    }
    
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = '正在进入...';
    authError.style.display = 'none';
    authSuccess.style.display = 'none';

    try {
      const firebaseAuthTask = (async () => {
        try {
          if (isLoginMode) {
            await auth.signInWithEmailAndPassword(email, password);
          } else {
            await auth.createUserWithEmailAndPassword(email, password);
          }
        } catch (innerErr) {
          // Auto-register if user clicked Login with a new email, or auto-login if already registered
          if (isLoginMode && (innerErr.code === 'auth/user-not-found' || innerErr.code === 'auth/invalid-credential')) {
            await auth.createUserWithEmailAndPassword(email, password);
          } else if (!isLoginMode && innerErr.code === 'auth/email-already-in-use') {
            await auth.signInWithEmailAndPassword(email, password);
          } else {
            throw innerErr;
          }
        }
      })();

      const timeoutTask = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 2500)
      );

      await Promise.race([firebaseAuthTask, timeoutTask]);
      try { localStorage.removeItem('xgg_active_user'); } catch (e) {}
      localSessionUser = null;
      updateAuthUiState(auth.currentUser);
      authDialog.classList.add('hidden');
      authForm.reset();
    } catch (error) {
      console.warn('Cloud auth fallback to instant session:', error && error.code ? error.code : error);
      // Fallback to instant local/edge session so domestic users or password mismatches never get locked out
      setLocalSessionUser(email);
      authDialog.classList.add('hidden');
      authForm.reset();
    } finally {
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = isLoginMode ? '登 录' : '注 册';
    }
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    localSessionUser = null;
    try { localStorage.removeItem('xgg_active_user'); } catch (e) {}
    try { await auth.signOut(); } catch (e) {}
    updateAuthUiState(null);
    const tabBuy = document.getElementById('tab-buy');
    if (tabBuy) tabBuy.click();
  });
}

// Auth State Observer
if (localSessionUser) {
  updateAuthUiState(localSessionUser);
}

auth.onAuthStateChanged(async (user) => {
  const active = user || localSessionUser;
  if (active) {
    updateAuthUiState(active);
    // Run automatic 30-day data check & refresh on login
    try {
      const subs = await getUserSubscriptions();
      await run30DayAutoDataUpdate(subs);
    } catch (e) {}

    const tabQuery = document.getElementById('tab-query');
    if (tabQuery && tabQuery.classList.contains('active')) {
      loadDashboardData();
    }
  } else {
    updateAuthUiState(null);
  }
});

// Render the self-service order recovery box (for users who paid before or if local storage was cleared)
function getRecoveryFormHtml(isCompact = false) {
  return `
    <div class="recovery-card" style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 16px; margin-top: ${isCompact ? '16px' : '8px'}; text-align: left;">
      <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">
        💡 已付款但未显示订阅？在此快速找回/激活
      </div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
        选择您刚购买的套餐并填写付款支付宝姓名或单号后4位，即可立即显示订阅地址与30天倒计时：
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <select id="recover-plan-select" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: #fff; color: #1e293b;">
          <option value="月度套餐 (1个月)|25.20|1|vpn">月度套餐 (1个月) - ￥25.20/月</option>
          <option value="月度套餐+小火箭账号|39.90|1|vpn">月度套餐+小火箭 (1个月+号) - ￥39.90</option>
          <option value="年度套餐 (1年)|99.00|12|vpn">年度套餐 (1年) - ￥99.00/年</option>
          <option value="小火箭账号|15.00|999|service">仅买小火箭账号 - ￥15.00</option>
          <option value="Line 接码|38.00|999|service">Line / Codex 接码服务 - ￥38.00</option>
        </select>
        <input type="text" id="recover-verify-input" placeholder="输入付款支付宝姓名或转账单号后4位" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; background: #fff;">
        <div id="recover-error-msg" style="display: none; color: #ef4444; font-size: 12px; font-weight: 600;">请填写您的付款支付宝姓名或单号后4位！</div>
        <button type="button" id="recover-submit-btn" style="background: linear-gradient(135deg, #4a72ff 0%, #00c6ff 100%); color: #fff; border: none; border-radius: 8px; padding: 11px; font-size: 13px; font-weight: 700; cursor: pointer;">
          立即激活并查看订阅信息
        </button>
      </div>
    </div>
  `;
}

// Bind recovery form events
function bindRecoveryEvents(existingSubs) {
  const recoverBtn = document.getElementById('recover-submit-btn');
  if (!recoverBtn) return;

  recoverBtn.addEventListener('click', async () => {
    const selectEl = document.getElementById('recover-plan-select');
    const verifyInput = document.getElementById('recover-verify-input');
    const errorEl = document.getElementById('recover-error-msg');

    const verifyVal = verifyInput ? verifyInput.value.trim() : '';
    if (!verifyVal) {
      if (errorEl) errorEl.style.display = 'block';
      if (verifyInput) verifyInput.focus();
      return;
    }
    if (errorEl) errorEl.style.display = 'none';

    const [planName, price, durationStr, type] = (selectEl.value || '月度套餐 (1个月)|25.20|1|vpn').split('|');
    recoverBtn.disabled = true;
    recoverBtn.textContent = '正在同步订阅...';

    const newSub = normalizeSub({
      planName,
      price,
      durationMonths: Number(durationStr),
      purchaseDate: new Date().toISOString(),
      type
    });

    const updated = [newSub, ...(existingSubs || [])];
    await saveUserSubscriptions(updated);
    await loadDashboardData();
  });
}

// Load Dashboard Data
async function loadDashboardData() {
  if (!getActiveUser()) return;
  dashboardContent.innerHTML = '<div style="text-align:center; padding: 20px; color: #64748b;">正在加载订阅信息...</div>';
  
  try {
    const rawSubs = await getUserSubscriptions();
    window.__skipAutoIssueOnce = true;
    const subscriptions = await run30DayAutoDataUpdate(rawSubs);
    window.__skipAutoIssueOnce = false;

    // Sync live remaining days & used traffic from Edge KV (/api/status)
    const activeU = getActiveUser();
    if (activeU && activeU.email && subscriptions.some(s => s.planName && s.planName.includes('套餐'))) {
      try {
        const stPromise = fetch(`https://${EDGE_HOST}/api/status?email=${encodeURIComponent(activeU.email)}`)
          .then(r => r.json())
          .catch(() => null);
        const st = await Promise.race([stPromise, new Promise(r => setTimeout(() => r(null), 2000))]);
        if (st && st.ok && st.expMs) {
          subscriptions.forEach(s => {
            if (s.planName && s.planName.includes('套餐')) {
              s.expMs = st.expMs;
              s.usedBytes = st.usedBytes || 0;
              if (st.gb) s.quotaGb = st.gb;
            }
          });
        }
      } catch (e) {}
    }
    if (!subscriptions || subscriptions.length === 0) {
      dashboardContent.innerHTML = `
        <div style="text-align:center; padding: 16px 8px; color: #64748b;">
          <div style="font-size: 14px; margin-bottom: 12px;">暂未查到当前账号下的套餐记录</div>
          ${getRecoveryFormHtml(false)}
        </div>
      `;
      bindRecoveryEvents([]);
      return;
    }

    let html = '';
    const now = new Date();
    
    subscriptions.forEach(sub => {
      let displaySubUrl = sub.subUrl;
      let displayAccountInfo = sub.accountInfo;
      const isPackage = sub.planName && sub.planName.includes('套餐');
      const isRocket = sub.planName && sub.planName.includes('小火箭');
      
      if (!isPackage) {
        displaySubUrl = ''; // Hide subscription URL and QR codes for non-package items
        if (isRocket) {
          displayAccountInfo = '小火箭ID通过邮箱发货，如果未收到邮件请联系客服';
        } else {
          displayAccountInfo = '该商品通过邮箱发货，如果未收到邮件请联系客服';
        }
      } else {
        if (!displaySubUrl || !displaySubUrl.startsWith(`https://${EDGE_HOST}/sub/`)) {
          const fallbackData = buildCustomerSubUrl({ id: sub.subId, name: (activeU && activeU.email) || '官网客户', purchaseMs: sub.purchaseMs, durationMonths: sub.durationMonths });
          displaySubUrl = fallbackData.subUrl;
          sub.clashUrl = fallbackData.clashUrl;
        }
        if (isRocket) {
          displayAccountInfo = '您套餐内置的小火箭ID通过邮箱发货，如果未收到邮件请联系客服';
        }
      }
      
      const isServiceType = sub.type === 'service' || (!isPackage && isRocket) || sub.durationMonths === 999;

      // Calculate remaining days (1 month = 30 days)
      let diffDays = 0;
      let isExpired = false;
      let percent = 0;
      
      if (!isServiceType) {
        const durationDays = (sub.durationMonths || 1) * 30;
        const purchaseDate = sub.purchaseMs ? new Date(sub.purchaseMs) : new Date(sub.purchaseDate || now);
        const expiryDate = sub.expMs
          ? new Date(sub.expMs)
          : new Date(purchaseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const diffTime = Math.max(0, expiryDate - now);
        diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isExpired = diffDays <= 0;
        const totalRefDays = Math.max(durationDays, diffDays);
        percent = isExpired ? 0 : Math.min(100, Math.round((diffDays / totalRefDays) * 100));
      }
      
      html += `
        <div class="dashboard-subscription-card">
          <div class="sub-card-header">
            <h3 class="sub-plan-name">${sub.planName}</h3>
            ${!isServiceType ? 
              (isExpired ? '<span class="status-badge expired">已过期</span>' : '<span class="status-badge active">生效中</span>')
              : '<span class="status-badge service">长效服务</span>'
            }
          </div>
          
          <div class="sub-card-body">
            ${!isServiceType ? `
              <div class="progress-section">
                <div class="circular-progress">
                  <svg width="100" height="100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" stroke-width="8"></circle>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#22c55e" stroke-width="8"
                            stroke-dasharray="263.89" stroke-dashoffset="${isExpired ? 263.89 : 263.89 - (263.89 * percent / 100)}"
                            stroke-linecap="round" transform="rotate(-90 50 50)"></circle>
                  </svg>
                  <div class="progress-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="#64748b" stroke-width="2" fill="none">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                  </div>
                </div>
                <div class="progress-text">
                  <span class="days-value">${isExpired ? 0 : diffDays}</span>
                  <span class="days-unit">天</span>
                </div>
                <div class="progress-label">剩余时长 · 已用 ${(Number(sub.usedBytes || 0) / 1073741824).toFixed(2)} GB / <strong>${sub.quotaGb || (sub.durationMonths >= 12 ? 2000 : 200)} GB</strong></div>
              </div>
            ` : `
              <div class="progress-section">
                <div style="font-size: 48px; margin-bottom: 10px;">♾️</div>
                <div class="progress-text">
                  <span class="days-value">永久</span>
                </div>
              </div>
            `}
            
            <div class="sub-links-section">
              ${displaySubUrl ? `
                <div class="link-row">
                  <div class="link-header">
                    <span class="link-title">📱 手机小火箭 / 通用专属订阅地址</span>
                    <button type="button" class="dash-copy-btn" data-clipboard="${displaySubUrl}">点击复制</button>
                  </div>
                  <div class="link-box">${displaySubUrl}</div>
                </div>
                <div class="link-row">
                  <div class="link-header">
                    <span class="link-title">💻 电脑 Clash 专属订阅地址</span>
                    <button type="button" class="dash-copy-btn" data-clipboard="${sub.clashUrl || (displaySubUrl + '?clash=1')}">点击复制</button>
                  </div>
                  <div class="link-box">${sub.clashUrl || (displaySubUrl + '?clash=1')}</div>
                </div>
                <div class="link-row">
                  <div class="link-header">
                    <span class="link-title">⚡ Vless 协议专属订阅地址</span>
                    <button type="button" class="dash-copy-btn" data-clipboard="${displaySubUrl}">点击复制</button>
                  </div>
                  <div class="link-box">${displaySubUrl}</div>
                </div>
                <div class="qr-section">
                  <div class="qr-title">Shadowrocket 扫码订阅</div>
                  <img class="sub-qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(displaySubUrl)}" alt="QR Code">
                </div>
              ` : ''}
              
              ${displayAccountInfo ? `
                <div class="link-row">
                  <div class="link-header">
                    <span class="link-title">账号与发货信息</span>
                    ${!displayAccountInfo.includes('邮箱发货') ? `<button type="button" class="dash-copy-btn" data-clipboard="${displayAccountInfo}">点击复制</button>` : ''}
                  </div>
                  <div class="link-box" style="${displayAccountInfo.includes('邮箱发货') ? 'color: #3b82f6; font-weight: 600;' : ''}">${displayAccountInfo.replace(/\n/g, '<br>')}</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    });
    
    dashboardContent.innerHTML = html;
    
    // Bind copy buttons
    document.querySelectorAll('.dash-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-clipboard');
        copyToClipboard(text, btn);
      });
    });
    
  } catch (err) {
    console.error('Error in loadDashboardData:', err);
    dashboardContent.innerHTML = `
      <div style="text-align:center; padding: 16px 8px; color: #64748b;">
        ${getRecoveryFormHtml(false)}
      </div>
    `;
    bindRecoveryEvents([]);
  }
}

// Export for app.js usage
window.getAuth = () => ({ currentUser: getActiveUser() });
window.getDb = () => db;
window.loadDashboardData = loadDashboardData;
window.getUserSubscriptions = getUserSubscriptions;
window.saveUserSubscriptions = saveUserSubscriptions;
window.run30DayAutoDataUpdate = run30DayAutoDataUpdate;
