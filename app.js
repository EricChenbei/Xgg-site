/**
 * Xgg Accelerator Landing Page Interactions & Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('purchase-form');
  const submitBtn = document.getElementById('submit-btn');
  const spinner = submitBtn.querySelector('.btn-spinner');
  const btnText = submitBtn.querySelector('.btn-text');
  
  // Dialog Elements
  const paymentDialog = document.getElementById('payment-dialog');
  const registeredEmailSpan = document.getElementById('registered-email');
  const dialogCloseBtn = document.getElementById('dialog-close-btn');
  const closePaymentBtn = document.getElementById('close-payment-btn');
  const confirmPaymentBtn = document.getElementById('confirm-payment-btn');

  // Tab Switching Logic
  const tabBuy = document.getElementById('tab-buy');
  const tabQuery = document.getElementById('tab-query');
  const formTabBuy = document.getElementById('form-tab-buy');
  const formTabQuery = document.getElementById('form-tab-query');
  const planView = document.getElementById('plan-view');
  const dashboardView = document.getElementById('dashboard-view');
  const durationCard = document.querySelector('.duration-card');
  const serviceCard = document.querySelector('.service-card');
  const formCard = document.querySelector('.form-card');

  // Expose function for header auth button and bottom tab to switch tabs
  window.switchToQueryTab = () => {
    if (tabQuery) tabQuery.click();
  };

  if (tabBuy && tabQuery) {
    tabBuy.addEventListener('click', () => {
      tabBuy.classList.add('active');
      tabBuy.setAttribute('aria-selected', 'true');
      tabQuery.classList.remove('active');
      tabQuery.setAttribute('aria-selected', 'false');

      if (planView) {
        planView.classList.remove('hidden');
        planView.style.display = '';
      }
      if (dashboardView) {
        dashboardView.classList.add('hidden');
        dashboardView.style.display = 'none';
      }
      if (durationCard) durationCard.style.display = 'block';
      if (serviceCard) serviceCard.style.display = 'block';
      if (formCard) formCard.style.display = 'block';
    });

    tabQuery.addEventListener('click', () => {
      const auth = window.getAuth ? window.getAuth() : null;
      if (!auth || !auth.currentUser) {
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        return;
      }

      tabQuery.classList.add('active');
      tabQuery.setAttribute('aria-selected', 'true');
      tabBuy.classList.remove('active');
      tabBuy.setAttribute('aria-selected', 'false');

      if (planView) {
        planView.classList.add('hidden');
        planView.style.display = 'none';
      }
      if (dashboardView) {
        dashboardView.classList.remove('hidden');
        dashboardView.style.display = 'block';
      }
      if (durationCard) durationCard.style.display = 'none';
      if (serviceCard) serviceCard.style.display = 'none';
      if (formCard) formCard.style.display = 'none';

      if (window.loadDashboardData) {
        window.loadDashboardData();
      }
    });
  }

  if (formTabQuery) {
    formTabQuery.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.switchToQueryTab) window.switchToQueryTab();
    });
  }

  // Selected Plan State (Default: 1 Month ¥25.20)
  let currentPlan = {
    price: '25.20',
    label: '月度套餐 (1个月)',
    duration: '1个月',
    qr: 'qr-25.jpg',
    type: 'duration'
  };

  // Setup Plan Selection
  const selectableOptions = document.querySelectorAll('.selectable-option');
  const summaryPlanLabel = document.getElementById('summary-plan-label');
  const summaryPlanPrice = document.getElementById('summary-plan-price');
  const summaryDuration = document.getElementById('summary-duration');
  const summaryTotal = document.getElementById('summary-total');

  selectableOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove active class from all
      selectableOptions.forEach(opt => {
        opt.classList.remove('active');
        opt.setAttribute('aria-checked', 'false');
      });
      
      // Add active to clicked
      option.classList.add('active');
      option.setAttribute('aria-checked', 'true');

      // Update state
      currentPlan = {
        price: option.getAttribute('data-price'),
        label: option.getAttribute('data-label'),
        duration: option.getAttribute('data-duration'),
        qr: option.getAttribute('data-qr'),
        type: option.getAttribute('data-type') || 'duration'
      };

      // Update UI Summary
      summaryPlanLabel.textContent = currentPlan.label;
      summaryPlanPrice.textContent = `￥${currentPlan.price}`;
      
      if (currentPlan.type === 'service') {
        summaryDuration.textContent = '通过您的订阅邮箱自动发货';
      } else if (currentPlan.label.includes('仅买小火箭') || (currentPlan.label.includes('小火箭') && !currentPlan.label.includes('套餐'))) {
        summaryDuration.textContent = '含独立的小火箭美区账号';
      } else if (currentPlan.label.includes('小火箭')) {
        summaryDuration.textContent = `含${currentPlan.duration.split('+')[0]}使用时长 + 小火箭账号`;
      } else {
        summaryDuration.textContent = `含${currentPlan.duration}使用时长`;
      }
      
      summaryTotal.textContent = `￥${currentPlan.price}`;
    });
  });

  // Variable to store email during modal checkout
  let tempEmail = '';

  /**
   * Form Submission Logic: Shows the Payment QR Modal first
   */
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const auth = window.getAuth ? window.getAuth() : null;
      if (!auth || !auth.currentUser) {
        const authDialog = document.getElementById('login-overlay');
        if (authDialog) authDialog.classList.remove('hidden');
        return;
      }
      
      const email = auth.currentUser.email;

      submitBtn.disabled = true;
      spinner.classList.remove('hidden');
      btnText.textContent = '正在进入付款...';

      setTimeout(() => {
        submitBtn.disabled = false;
        spinner.classList.add('hidden');
        btnText.textContent = '立即购买';

        tempEmail = email;
        registeredEmailSpan.textContent = email;
        
        const qrImage = document.querySelector('.qr-image');
        const amountVal = document.querySelector('.amount-val');
        if (qrImage) {
          qrImage.src = `assets/${currentPlan.qr}`;
        }
        if (amountVal) {
          amountVal.textContent = `￥${currentPlan.price}`;
        }
        
        paymentDialog.showModal();
      }, 400);
    });
  }

  /**
   * Modal Close Handlers
   */
  const closeDialog = () => {
    paymentDialog.close();
  };

  dialogCloseBtn.addEventListener('click', closeDialog);
  closePaymentBtn.addEventListener('click', closeDialog);
  
  const payVerificationInput = document.getElementById('pay-verification');
  const payVerificationError = document.getElementById('pay-verification-error');

  payVerificationInput.addEventListener('input', (e) => {
    if (e.target.value.trim().length > 0) {
      confirmPaymentBtn.disabled = false;
    } else {
      confirmPaymentBtn.disabled = true;
    }
  });

  /**
   * Payment Confirmation Click
   */
  confirmPaymentBtn.addEventListener('click', async () => {
    if (!tempEmail) return;

    const payVerification = payVerificationInput.value.trim();

    if (!payVerification) {
      payVerificationInput.classList.add('custom-invalid');
      payVerificationError.style.display = 'block';
      payVerificationInput.focus();
      return;
    } else {
      payVerificationInput.classList.remove('custom-invalid');
      payVerificationError.style.display = 'none';
    }

    const originalText = confirmPaymentBtn.textContent;
    confirmPaymentBtn.disabled = true;
    confirmPaymentBtn.textContent = '正在登记订单...';

    // 1. Immediately build and save subscription locally + cloud Auth profile so it NEVER fails
    try {
      let durationMonths = 1;
      if (currentPlan.label.includes('月度') || currentPlan.duration.includes('1个月')) durationMonths = 1;
      else if (currentPlan.label.includes('一年') || currentPlan.label.includes('年度')) durationMonths = 12;
      else if (currentPlan.label.includes('永久') || (currentPlan.label.includes('小火箭') && !currentPlan.label.includes('套餐'))) durationMonths = 999;

      const isPackage = currentPlan.label.includes('套餐');
      const isRocket = currentPlan.label.includes('小火箭');

      const newSub = {
        planName: currentPlan.label,
        price: currentPlan.price,
        durationMonths: durationMonths,
        purchaseDate: new Date().toISOString(),
        type: (!isPackage && isRocket) ? 'service' : (currentPlan.type || 'vpn'),
        subUrl: '',
        accountInfo: !isPackage
          ? (isRocket ? '小火箭ID通过邮箱发货，如果未收到邮件请联系客服' : '该商品通过邮箱发货，如果未收到邮件请联系客服')
          : (isRocket ? '您套餐内置的小火箭ID通过邮箱发货，如果未收到邮件请联系客服' : '')
      };

      const existingSubs = window.getUserSubscriptions ? await window.getUserSubscriptions() : [];
      let nextSubs = existingSubs;
      if (isPackage) {
        // Single-account single-link: replace existing package entry so renewals update the SAME permanent link in place
        const nonPackageSubs = existingSubs.filter(s => !s.planName || !s.planName.includes('套餐'));
        nextSubs = [newSub, ...nonPackageSubs];
      } else {
        nextSubs = [newSub, ...existingSubs];
      }
      if (window.saveUserSubscriptions) {
        await window.saveUserSubscriptions(nextSubs);
      }
    } catch (e) {
      console.error('Error saving subscription:', e);
    }

    // 2. Send Formspree Notification (with 3s timeout so UI never hangs)
    const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mnjrwaap';
    try {
      const fetchPromise = fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          title: 'Xgg加速器 订单付款登记通知',
          customer_email: tempEmail,
          user_uid: window.getAuth && window.getAuth().currentUser ? window.getAuth().currentUser.uid : 'Guest',
          alipay_verification: payVerification,
          payment_status: `已手动确认支付 ￥${currentPlan.price}`,
          plan: currentPlan.label,
          duration: currentPlan.duration,
          price: `￥${currentPlan.price}`,
          recipient: 'larrymimo8@gmail.com'
        })
      });
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
      await Promise.race([fetchPromise, timeoutPromise]);
    } catch (err) {
      console.warn('Formspree notification warning:', err);
    } finally {
      confirmPaymentBtn.disabled = false;
      confirmPaymentBtn.textContent = originalText;

      closeDialog();

      form.reset();
      payVerificationInput.value = '';
      payVerificationInput.classList.remove('custom-invalid');

      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.switchToQueryTab) {
        window.switchToQueryTab();
      }
    }
  });

  /**
   * Dialog Light-Dismiss Fallback
   */
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    paymentDialog.addEventListener('click', (event) => {
      if (event.target !== paymentDialog) return;

      const rect = paymentDialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );

      if (isDialogContent) return;

      closeDialog();
    });
  }

  /**
   * Premium Toast Notification for Disabled Services
   */
  function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span style="font-size: 16px;">⚠️</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  const disabledOptions = document.querySelectorAll('.service-option.disabled');
  disabledOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      showToast('该服务暂时无可用号码，请留意后续补货或选择其他服务！');
    });
  });

});
