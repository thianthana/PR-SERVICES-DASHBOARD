// ============================================================
// PR PORTAL — Configuration
// ============================================================

const CONFIG = {
  // URL ของ Google Apps Script Web App (ได้จากการ Deploy)
  API_URL: 'https://script.google.com/macros/s/AKfycbzdObNiqN6K0tL9uw5eaeDi4S_XFw3OHv5H4PXTr8_r-2Ax5lAztp2mJ9fQLT-eMKFZ/exec',

  // Session timeout (มิลลิวินาที) — 15 นาที
  SESSION_TIMEOUT: 15 * 60 * 1000,

  // Heartbeat interval — ตรวจสอบ session ทุก 30 วินาที
  HEARTBEAT_INTERVAL: 30 * 1000,

  // Inactivity check interval — ตรวจสอบ inactivity ทุก 10 วินาที
  INACTIVITY_CHECK_INTERVAL: 10 * 1000,

  // หน้าต่างๆ
  PAGES: {
    LOGIN: 'login.html',
    DASHBOARD: 'dashboard.html',
    MEDIA: 'service-media.html',
    SURVEY: 'service-survey.html'
  },

  // ชื่อระบบ
  APP_NAME: 'ระบบงานประชาสัมพันธ์',
  APP_NAME_EN: 'PR Portal',
  ORG_NAME: 'สำนักหอสมุด มช.',
};
