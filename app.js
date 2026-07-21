/**
 * Xgg Accelerator landing Page Interactions & Logic
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

  const successDialog = document.getElementById('success-dialog');
  const successCloseBtn = document.getElementById('success-close-btn');
  const finishBtn = document.getElementById('finish-btn');

  // Selected Plan State
  let currentPlan = {
    price: '25.20',
    label: '季度套餐 (3个月)',
    duration: '3个月',
    qr: 'qr-25.jpg'
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
      } else if (currentPlan.label.includes('仅买小火箭')) {
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
        // User is not logged in, show auth dialog
        const authDialog = document.getElementById('auth-dialog');
        if (authDialog) authDialog.showModal();
        return;
      }
      
      const email = auth.currentUser.email;

      // Toggle button state to loading temporarily for visual feedback
      submitBtn.disabled = true;
      spinner.classList.remove('hidden');
      btnText.textContent = '正在进入付款...';

    setTimeout(() => {
      // Restore button status
      submitBtn.disabled = false;
      spinner.classList.add('hidden');
      btnText.textContent = '立即购买';

      // Store the verified email
      tempEmail = email;
      registeredEmailSpan.textContent = email;
      
      // Open the elegant glassmorphic payment dialog modal
      const qrImage = document.querySelector('.qr-image');
      const amountVal = document.querySelector('.amount-val');
      if (qrImage) {
        qrImage.src = `assets/${currentPlan.qr}`;
      }
      if (amountVal) {
        amountVal.textContent = `￥${currentPlan.price}`;
      }
      
      paymentDialog.showModal();
    }, 600); // Quick smooth delay for premium interactive feel
  });

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
   * Payment Confirmation Click: Only trigger Formspree notification when customer clicks "I have paid"
   * MANDATORY: Requires filling in their Alipay Name/Transaction ID to prevent fake paid claims!
   */
  confirmPaymentBtn.addEventListener('click', async () => {
    if (!tempEmail) return;

    const payVerification = payVerificationInput.value.trim();

    // Validate manual payment confirmation info
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
    confirmPaymentBtn.textContent = '正在发送已付款通知...';

    // Formspree API Endpoint
    const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mnjrwaap'; 

    try {
      let response;
      
      if (FORMSPREE_ENDPOINT && !FORMSPREE_ENDPOINT.includes('your_form_id_here')) {
        response = await fetch(FORMSPREE_ENDPOINT, {
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
      } else {
        // Mock testing response
        console.log(`[Email Notification Mock] Paid email notification sent. recipient: larrymimo8@gmail.com, customer email: ${tempEmail}, verification: ${payVerification}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        response = { ok: true };
      }

      // We don't throw error on !response.ok because we want the user to see the success UI regardless.
      if (!response.ok) {
        console.warn('Formspree responded with an error, but proceeding to show success UI to user.');
      }

    } catch (err) {
      console.warn('Network request failed, standard fallback executed.', err);
    } finally {
      // Restore button status
      confirmPaymentBtn.disabled = false;
      confirmPaymentBtn.textContent = originalText;
      
      closeDialog();
      
      // Setup success dialog content based on plan type
      const vpnContent = document.getElementById('success-vpn-content');
      const serviceContent = document.getElementById('success-service-content');
      const subtitle = document.getElementById('success-dialog-subtitle');

      if (currentPlan.type === 'service' || currentPlan.label.includes('仅买小火箭')) {
        vpnContent.style.display = 'none';
        serviceContent.style.display = 'block';
        subtitle.style.display = 'none';
      } else {
        vpnContent.style.display = 'block';
        serviceContent.style.display = 'none';
        subtitle.style.display = 'block';
      }

      // Show success and subscription links dialog
      successDialog.showModal();
    }
  });

  /**
   * Success Dialog and Copy Logic
   */
  const closeSuccess = () => {
    successDialog.close();
    form.reset();
    payVerificationInput.value = '';
    payVerificationInput.classList.remove('custom-invalid');
    confirmPaymentBtn.disabled = true;
  };

  successCloseBtn.addEventListener('click', closeSuccess);
  finishBtn.addEventListener('click', closeSuccess);

  const copyBtns = document.querySelectorAll('.copy-btn');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.getAttribute('data-clipboard');
      navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = btn.textContent;
        btn.textContent = '已复制!';
        btn.style.background = '#10b981';
        btn.style.color = '#fff';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.style.color = '';
        }, 2000);
      }).catch(err => {
        console.error('Copy failed', err);
        alert('复制失败，请手动选择复制。');
      });
    });
  });

  /**
   * Dialog Light-Dismiss Fallback (from modern web guidelines)
   * Essential for browser compatibility (e.g., iOS Safari) where closedby="any" is not yet baseline.
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

  // Bind click event to disabled service options to show the toast
  const disabledOptions = document.querySelectorAll('.service-option.disabled');
  disabledOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      showToast('该服务暂时无可用号码，请留意后续补货或选择其他服务！');
    });
  });

});
