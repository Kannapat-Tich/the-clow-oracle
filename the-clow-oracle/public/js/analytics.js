/**
 * THE CLOW — Client-side Anonymous Analytics Tracker
 * ส่งสถิติแบบไม่ระบุตัวตน (ไม่เก็บคำถามหรือข้อมูลส่วนตัว) ไปยัง /api/analytics (Cloudflare D1)
 * และเก็บสรุปเบื้องต้นใน localStorage เมื่อรันแบบพรีวิวท้องถิ่น
 */

const SESSION_KEY = 'clow_anon_session_id';
const CONSENT_KEY = 'clow_analytics_consent_v1';

export function hasAnalyticsConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch (_) {
    return false;
  }
}

export function grantAnalyticsConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, 'accepted');
  } catch (_) {}
}

function getAnonSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch (_) {
    return `s_${Date.now()}`;
  }
}

export function trackEvent(eventType, details = {}) {
  if (!hasAnalyticsConsent()) return;
  const payload = {
    eventType,
    sessionId: getAnonSessionId(),
    spreadId: details.spreadId || null,
    spreadName: details.spreadName || null,
    cardId: details.cardId || null,
    cardName: details.cardName || null,
    posIndex: details.posIndex ?? null,
    aiMode: details.aiMode || null,
    viewportW: typeof window !== 'undefined' ? window.innerWidth : null
  };

  // ข้ามการยิง POST /api/analytics บนพรีวิว localhost แบบ static เพื่อไม่ให้ขึ้น 404 ใน console
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return;
    }
  }

  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics', blob);
    } else {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    }
  } catch (_) {}
}
