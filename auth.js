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

const dashboardDialog = document.getElementById('dashboard-dialog');
const closeDashboardBtn = document.getElementById('dashboard-close-btn');
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
      dashboardDialog.showModal();
      loadDashboardData();
    } else {
      authDialog.classList.remove('hidden');
    }
  });
}

if (closeAuthBtn) {
  closeAuthBtn.addEventListener('click', () => authDialog.classList.add('hidden'));
}
if (closeDashboardBtn) {
  closeDashboardBtn.addEventListener('click', () => dashboardDialog.close());
}

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
    dashboardDialog.close();
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
        // Assuming duration is in months (e.g. 3, 12, or 999 for lifetime)
        const durationDays = sub.durationMonths * 30; // Approximation
        
        const expiryDate = new Date(purchaseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const diffTime = Math.max(0, expiryDate - now);
        diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isExpired = diffDays <= 0;
      }
      
      html += `
        <div class="dashboard-item">
          <div class="dashboard-item-header">
            <span class="dashboard-plan-name">${sub.planName}</span>
            ${sub.type !== 'service' ? 
              (isExpired ? '<span class="status-badge expired">已过期</span>' : `<span class="status-badge active">剩余 ${diffDays} 天</span>`)
              : '<span class="status-badge service">长效服务</span>'
            }
          </div>
          <div class="dashboard-item-content">
            ${sub.subUrl ? `
              <div class="sub-link-group">
                <label>订阅地址：</label>
                <div class="sub-link-box">${sub.subUrl}</div>
                <button class="dash-copy-btn" data-clipboard="${sub.subUrl}">复制</button>
              </div>
            ` : ''}
            ${sub.accountInfo ? `
              <div class="sub-link-group">
                <label>账号信息：</label>
                <div class="sub-link-box">${sub.accountInfo}</div>
                <button class="dash-copy-btn" data-clipboard="${sub.accountInfo}">复制</button>
              </div>
            ` : ''}
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
