// auth.js
// Firebase Config (Placeholder - User will provide this)
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

// Removed dashboardDialog
const logoutBtn = document.getElementById('logout-btn');
const dashboardContent = document.getElementById('dashboard-content');

let isLoginMode = true;

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
    if (auth.currentUser) {
      if (window.switchToQueryTab) window.switchToQueryTab();
    } else {
      authDialog.classList.remove('hidden');
    }
  });
}

if (closeAuthBtn) {
  closeAuthBtn.addEventListener('click', () => authDialog.classList.add('hidden'));
}
// closeDashboardBtn removed

// Handle Auth Form Submission
if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = '处理中...';
    authError.style.display = 'none';
    authSuccess.style.display = 'none';

    try {
      if (isLoginMode) {
        await auth.signInWithEmailAndPassword(email, password);
      } else {
        await auth.createUserWithEmailAndPassword(email, password);
      }
      authDialog.classList.add('hidden');
      authForm.reset();
    } catch (error) {
      console.error(error);
      authError.style.display = 'block';
      if (error.code === 'auth/email-already-in-use') authError.textContent = '该邮箱已被注册';
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') authError.textContent = '邮箱或密码错误';
      else if (error.code === 'auth/weak-password') authError.textContent = '密码不能少于6位';
      else authError.textContent = error.message;
    } finally {
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = isLoginMode ? '登 录' : '注 册';
    }
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await auth.signOut();
    const tabBuy = document.getElementById('tab-buy');
    if (tabBuy) tabBuy.click();
  });
}

// Auth State Observer
auth.onAuthStateChanged((user) => {
  if (user) {
    if (authDialog) authDialog.classList.add('hidden');
    if (authBtn) {
      authBtn.innerHTML = `<span>👤 我的账号</span>`;
      authBtn.classList.add('logged-in');
    }
  } else {
    // Show mandatory login on load
    if (authDialog) authDialog.classList.remove('hidden');
    if (authBtn) {
      authBtn.innerHTML = `<span>🔒 登录 / 注册</span>`;
      authBtn.classList.remove('logged-in');
    }
  }
});

// Load Dashboard Data
async function loadDashboardData() {
  if (!auth.currentUser) return;
  dashboardContent.innerHTML = '<div style="text-align:center; padding: 20px;">加载中...</div>';
  
  try {
    const doc = await db.collection('users').doc(auth.currentUser.uid).get();
    if (!doc.exists) {
      dashboardContent.innerHTML = '<div style="text-align:center; padding: 20px; color: #64748b;">您还没有购买任何套餐，去首页选购吧！</div>';
      return;
    }
    
    const data = doc.data();
    if (!data.subscriptions || data.subscriptions.length === 0) {
      dashboardContent.innerHTML = '<div style="text-align:center; padding: 20px; color: #64748b;">您还没有购买任何套餐，去首页选购吧！</div>';
      return;
    }

    let html = '';
    const now = new Date();
    
    data.subscriptions.forEach(sub => {
      // Calculate remaining days
      let diffDays = 0;
      let isExpired = false;
      
      if (sub.type !== 'service') {
        const purchaseDate = sub.purchaseDate.toDate();
        const durationDays = sub.durationMonths * 30; // Approximation
        
        const expiryDate = new Date(purchaseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const diffTime = Math.max(0, expiryDate - now);
        diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isExpired = diffDays <= 0;
        percent = isExpired ? 0 : Math.min(100, Math.round((diffDays / durationDays) * 100));
      }
      
      html += `
        <div class="dashboard-subscription-card">
          <div class="sub-card-header">
            <h3 class="sub-plan-name">${sub.planName}</h3>
            ${sub.type !== 'service' ? 
              (isExpired ? '<span class="status-badge expired">已过期</span>' : '<span class="status-badge active">生效中</span>')
              : '<span class="status-badge service">长效服务</span>'
            }
          </div>
          
          <div class="sub-card-body">
            ${sub.type !== 'service' ? `
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
                <div class="progress-label">剩余时长</div>
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
              ${sub.subUrl ? `
                <div class="link-row">
                  <div class="link-header">
                    <span class="link-title">通用订阅地址</span>
                    <button class="dash-copy-btn" data-clipboard="${sub.subUrl}">点击复制</button>
                  </div>
                  <div class="link-box">${sub.subUrl}</div>
                </div>
                <div class="link-row">
                  <div class="link-header">
                    <span class="link-title">HY2 协议地址</span>
                    <button class="dash-copy-btn" data-clipboard="${sub.subUrl}&types=hysteria2">点击复制</button>
                  </div>
                  <div class="link-box">${sub.subUrl}&types=hysteria2</div>
                </div>
                <div class="link-row">
                  <div class="link-header">
                    <span class="link-title">Vless 协议地址</span>
                    <button class="dash-copy-btn" data-clipboard="${sub.subUrl}&types=vless">点击复制</button>
                  </div>
                  <div class="link-box">${sub.subUrl}&types=vless</div>
                </div>
                <div class="qr-section">
                  <div class="qr-title">Shadowrocket 扫码订阅</div>
                  <img class="sub-qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(sub.subUrl)}" alt="QR Code">
                </div>
              ` : ''}
              
              ${sub.accountInfo ? `
                <div class="link-row">
                  <div class="link-header">
                    <span class="link-title">账号信息</span>
                    <button class="dash-copy-btn" data-clipboard="${sub.accountInfo}">点击复制</button>
                  </div>
                  <div class="link-box">${sub.accountInfo.replace(/\n/g, '<br>')}</div>
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
        navigator.clipboard.writeText(text).then(() => {
          const original = btn.textContent;
          btn.textContent = '已复制!';
          btn.style.background = '#10b981';
          btn.style.color = '#fff';
          setTimeout(() => {
            btn.textContent = original;
            btn.style.background = '';
            btn.style.color = '';
          }, 2000);
        });
      });
    });
    
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    dashboardContent.innerHTML = '<div style="text-align:center; padding: 20px; color: #ef4444;">获取数据失败，请重试</div>';
  }
}

// Export for app.js usage
window.getAuth = () => auth;
window.getDb = () => db;
window.loadDashboardData = loadDashboardData;
