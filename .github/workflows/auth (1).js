// ============================================================
// PR PORTAL — Authentication Module
// จัดการ Session, Heartbeat, Single Session, Inactivity Timeout
// ============================================================

const Auth = (() => {
  let heartbeatTimer = null;
  let inactivityTimer = null;
  let lastActivity = Date.now();
  let isLoggingOut = false;

  // ---------- Device ID ----------
  function getDeviceId() {
    let id = localStorage.getItem('pr_device_id');
    if (!id) {
      id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('pr_device_id', id);
    }
    return id;
  }

  // ---------- Session Storage ----------
  function saveSession(data) {
    const session = {
      token: data.sessionToken,
      username: data.username,
      displayName: data.displayName,
      role: data.role,
      loginTime: Date.now(),
      lastActivity: Date.now()
    };
    sessionStorage.setItem('pr_session', JSON.stringify(session));
  }

  function getSession() {
    const raw = sessionStorage.getItem('pr_session');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem('pr_session');
  }

  function updateLastActivity() {
    const session = getSession();
    if (session) {
      session.lastActivity = Date.now();
      sessionStorage.setItem('pr_session', JSON.stringify(session));
    }
    lastActivity = Date.now();
  }

  // ---------- API Call ----------
  async function apiCall(action, data = {}) {
    try {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, ...data })
      });
      return await response.json();
    } catch (err) {
      console.error('API Error:', err);
      return { success: false, error: 'NETWORK_ERROR' };
    }
  }

  // ---------- Login Flow ----------
  async function login(username, password) {
    return apiCall('login', {
      username,
      password,
      deviceId: getDeviceId()
    });
  }

  async function verifyOTP(username, otp) {
    const result = await apiCall('verifyOTP', {
      username,
      otp,
      deviceId: getDeviceId()
    });

    if (result.success && result.sessionToken) {
      saveSession(result);
      startSessionGuard();
    }

    return result;
  }

  // ---------- Logout ----------
  async function logout(reason = 'manual') {
    if (isLoggingOut) return;
    isLoggingOut = true;

    const session = getSession();
    if (session) {
      try {
        await apiCall('logout', {
          sessionToken: session.token,
          username: session.username
        });
      } catch { /* ignore */ }
    }

    stopSessionGuard();
    clearSession();

    // redirect พร้อมแสดงเหตุผล
    const messages = {
      manual: '',
      timeout: '?reason=timeout',
      replaced: '?reason=replaced',
      invalid: '?reason=invalid'
    };

    window.location.href = CONFIG.PAGES.LOGIN + (messages[reason] || '');
  }

  // ---------- Session Guard ----------
  function startSessionGuard() {
    // Activity listeners
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(evt => {
      document.addEventListener(evt, updateLastActivity, { passive: true });
    });

    // Heartbeat — ตรวจสอบ session กับ server
    heartbeatTimer = setInterval(async () => {
      const session = getSession();
      if (!session) { logout('invalid'); return; }

      const result = await apiCall('heartbeat', {
        sessionToken: session.token,
        username: session.username
      });

      if (!result.success || !result.valid) {
        if (result.reason === 'SESSION_REPLACED') {
          logout('replaced');
        } else {
          logout('invalid');
        }
      }
    }, CONFIG.HEARTBEAT_INTERVAL);

    // Inactivity check — ตรวจสอบว่าไม่ได้ใช้งานเกิน 15 นาทีหรือไม่
    inactivityTimer = setInterval(() => {
      const session = getSession();
      if (!session) return;

      const idle = Date.now() - lastActivity;
      if (idle >= CONFIG.SESSION_TIMEOUT) {
        logout('timeout');
      }

      // แสดง warning ก่อนหมดเวลา 2 นาที
      const warningThreshold = CONFIG.SESSION_TIMEOUT - (2 * 60 * 1000);
      if (idle >= warningThreshold && idle < CONFIG.SESSION_TIMEOUT) {
        const remaining = Math.ceil((CONFIG.SESSION_TIMEOUT - idle) / 1000);
        showSessionWarning(remaining);
      }
    }, CONFIG.INACTIVITY_CHECK_INTERVAL);
  }

  function stopSessionGuard() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (inactivityTimer) clearInterval(inactivityTimer);
    heartbeatTimer = null;
    inactivityTimer = null;
  }

  // ---------- Session Warning ----------
  function showSessionWarning(secondsLeft) {
    let warningEl = document.getElementById('sessionWarning');
    if (!warningEl) {
      warningEl = document.createElement('div');
      warningEl.id = 'sessionWarning';
      warningEl.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;text-align:center;padding:12px 20px;font-family:"Prompt",sans-serif;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
      document.body.appendChild(warningEl);
    }
    warningEl.innerHTML = `⚠️ เซสชันจะหมดอายุใน <strong>${secondsLeft} วินาที</strong> — กรุณาขยับเมาส์หรือกดปุ่มใดก็ได้เพื่อต่ออายุ`;
    warningEl.style.display = 'flex';

    if (secondsLeft > 120) {
      warningEl.style.display = 'none';
    }
  }

  // ---------- Auth Guard (สำหรับหน้าที่ต้อง Login) ----------
  async function requireAuth() {
    const session = getSession();

    if (!session) {
      window.location.href = CONFIG.PAGES.LOGIN + '?reason=noauth';
      return false;
    }

    // ตรวจสอบ inactivity ฝั่ง client ก่อน
    const idle = Date.now() - session.lastActivity;
    if (idle >= CONFIG.SESSION_TIMEOUT) {
      logout('timeout');
      return false;
    }

    // ตรวจสอบกับ server
    const result = await apiCall('checkSession', {
      sessionToken: session.token,
      username: session.username
    });

    if (!result.success || !result.valid) {
      if (result.reason === 'SESSION_REPLACED') {
        logout('replaced');
      } else if (result.reason === 'SESSION_EXPIRED') {
        logout('timeout');
      } else {
        logout('invalid');
      }
      return false;
    }

    // Session ยังใช้ได้ — เริ่ม guard
    startSessionGuard();
    updateLastActivity();
    return true;
  }

  // ---------- Request Access ----------
  async function requestAccess(data) {
    return apiCall('requestAccess', data);
  }

  async function checkStatus(email) {
    return apiCall('checkStatus', { email });
  }

  // ---------- Public API ----------
  return {
    getDeviceId,
    getSession,
    login,
    verifyOTP,
    logout,
    requireAuth,
    updateLastActivity,
    requestAccess,
    checkStatus,
    apiCall
  };
})();
