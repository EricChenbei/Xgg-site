/**
 * Xgg Accelerator landing Page Interactions & Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('purchase-form');
  const emailInput = document.getElementById('email');
  const confirmInput = document.getElementById('confirm-email');
  const submitBtn = document.getElementById('submit-btn');
  const spinner = submitBtn.querySelector('.btn-spinner');
  const btnText = submitBtn.querySelector('.btn-text');
  
  // Dialog Elements
  const paymentDialog = document.getElementById('payment-dialog');
  const registeredEmailSpan = document.getElementById('registered-email');
  const dialogCloseBtn = document.getElementById('dialog-close-btn');
  const closePaymentBtn = document.getElementById('close-payment-btn');
  const confirmPaymentBtn = document.getElementById('confirm-payment-btn');

  // Stricter Email Format Regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  /**
   * Sync native validation status with ARIA attributes (from modern guidance)
   */
  const syncAria = (el) => {
    const isInvalid = el.matches(':user-invalid') || el.classList.contains('custom-invalid');
    el.setAttribute('aria-invalid', isInvalid ? 'true' : 'false');
  };

  /**
   * Real-time Email Matching and Format Verification
   */
  const validateEmails = () => {
    const email = emailInput.value.trim();
    const confirmVal = confirmInput.value.trim();
    
    let isValid = true;

    // 1. Validate main email format
    if (email && !emailRegex.test(email)) {
      emailInput.classList.add('custom-invalid');
      isValid = false;
    } else {
      emailInput.classList.remove('custom-invalid');
    }
    
    // 2. Validate confirmation match
    if (confirmVal) {
      if (email !== confirmVal) {
        confirmInput.classList.add('custom-invalid');
        isValid = false;
      } else {
        confirmInput.classList.remove('custom-invalid');
      }
    } else {
      confirmInput.classList.remove('custom-invalid');
    }

    syncAria(emailInput);
    syncAria(confirmInput);

    return isValid;
  };

  // Real-time feedback listeners
  emailInput.addEventListener('input', validateEmails);
  confirmInput.addEventListener('input', validateEmails);
  emailInput.addEventListener('blur', validateEmails);
  confirmInput.addEventListener('blur', validateEmails);

  // Variable to store email during modal checkout
  let tempEmail = '';

  /**
   * Form Submission Logic: Shows the Payment QR Modal first (does NOT email yet)
   */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const confirmVal = confirmInput.value.trim();

    // Final checks before submission
    if (!email) {
      emailInput.classList.add('custom-invalid');
      emailInput.focus();
      return;
    }
    if (!confirmVal) {
      confirmInput.classList.add('custom-invalid');
      confirmInput.focus();
      return;
    }
    
    if (!emailRegex.test(email) || email !== confirmVal) {
      validateEmails();
      return;
    }

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
  
  /**
   * Payment Confirmation Click: Only trigger Formspree notification when customer clicks "I have paid"
   * MANDATORY: Requires filling in their Alipay Name/Transaction ID to prevent fake paid claims!
   */
  confirmPaymentBtn.addEventListener('click', async () => {
    if (!tempEmail) return;

    const payVerificationInput = document.getElementById('pay-verification');
    const payVerificationError = document.getElementById('pay-verification-error');
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
            alipay_verification: payVerification, // Attach the user's manual payment verification info!
            payment_status: '已手动确认支付 ￥25.20',
            plan: '普通套餐',
            duration: '30天',
            price: '￥25.20',
            recipient: 'larrymimo8@gmail.com'
          })
        });
      } else {
        // Mock testing response
        console.log(`[Email Notification Mock] Paid email notification sent. recipient: larrymimo8@gmail.com, customer email: ${tempEmail}, verification: ${payVerification}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        response = { ok: true };
      }

      if (response.ok) {
        closeDialog();
        // Custom elegant alert
        alert('感谢您的登记与支付！付款确认与您的付款凭证已成功发送至商家。系统将在 5-10 分钟内自动发送加速器账号凭证与使用说明至您的邮箱，请注意查收（含垃圾箱）。');
        
        // Fully reset form and clear state
        form.reset();
        payVerificationInput.value = '';
        emailInput.classList.remove('custom-invalid');
        confirmInput.classList.remove('custom-invalid');
        payVerificationInput.classList.remove('custom-invalid');
        tempEmail = '';
      } else {
        throw new Error('Notification transmission failed');
      }

    } catch (err) {
      console.warn('Network request failed, standard fallback executed.', err);
      closeDialog();
      // Even if network fails, don't lock customer out, warn them gracefully
      alert('登记通知已记录。如果您的账号未在 10 分钟内发送至您的邮箱，请随时发送邮件至 larrymimo8@gmail.com 联系客服处理！');
      
      form.reset();
      emailInput.classList.remove('custom-invalid');
      confirmInput.classList.remove('custom-invalid');
      tempEmail = '';
    } finally {
      // Restore button status
      confirmPaymentBtn.disabled = false;
      confirmPaymentBtn.textContent = originalText;
    }
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
});
