// ============================================================
// PR PORTAL — Configuration
// ============================================================

const CONFIG = {
  // URL ของ Google Apps Script Web App (ได้จากการ Deploy)
  API_URL: 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE',

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
