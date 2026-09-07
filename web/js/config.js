const CONFIG = Object.freeze({
  API_URL: 'https://script.google.com/macros/s/AKfycbzdObNiqN6K0tL9uw5eaeDi4S_XFw3OHv5H4PXTr8_r-2Ax5lAztp2mJ9fQLT-eMKFZ/exec',
  SESSION_TIMEOUT: 15 * 60 * 1000,
  HEARTBEAT_INTERVAL: 30000,
  INACTIVITY_CHECK_INTERVAL: 10000,
  PAGES: Object.fromEntries(Object.entries({LOGIN:'login.html',DASHBOARD:'dashboard.html',MEDIA:'service-media.html',SURVEY:'service-survey.html'}).map(([key,file])=>[key,new URL('../'+file,document.currentScript.src).href])),
  APP_NAME:'ระบบงานประชาสัมพันธ์',APP_NAME_EN:'PR Portal',ORG_NAME:'สำนักหอสมุด มช.'
});
