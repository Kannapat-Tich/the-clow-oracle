/**
 * THE CLOW — แอปพลิเคชันหลัก (ย้ายจาก Google Apps Script สู่ Cloudflare Pages)
 * คงดีไซน์ แอนิเมชัน และพิธีกรรมเปิดไพ่ครบถ้วน + เพิ่มระบบ AI ตีความเชื่อมโยงกับปัญหาผู้ใช้
 */

import { SPREADS_DATA } from '../data/spreads.js';
import { CARDS_DATA } from '../data/cards.js';
import { COMPATIBILITY_READINGS } from '../data/compatibility-readings.js';
import { getCardBackUrl, getCardFrontUrl, getMagicCircleUrl } from '../data/assets.config.js';
import {
  updateBgmUI,
  initAutoBgm,
  preloadAllBgmTracks,
  toggleBgm,
  prevBgmTrack,
  nextBgmTrack,
  playSoftPaperRustle,
  playCardFlipSound,
  playRapidRiffleSound
} from './audio.js?v=20261124r';
import { requestAiInterpretation, clearAiReadingCache, buildLocalGuidebookSynthesis } from './ai-oracle.js?v=20261124r';
import { trackEvent, hasAnalyticsConsent, grantAnalyticsConsent } from './analytics.js';
import {
  applyLanguage,
  toggleLanguage as i18nToggleLanguage,
  getCurrentLang,
  t,
  getSpreadName,
  getSpreadPurpose,
  getSpreadTopicTags,
  getSpreadRitualNotice,
  getSpreadPlaceholder,
  getPosTitle,
  getPosMeaning
} from './i18n.js?v=20261124r';

/**
 * =========================================================================
 * 1. STATIC ASSET LOADER WITH INSTANT RENDER & BACKGROUND PRELOAD
 * แสดงรูปไพ่จริงทันทีไม่ต้องรอ probeImage และโหลดไพ่ทั้ง 52 ใบล่วงหน้าในพื้นหลัง
 * หากรูปใดโหลดไม่ได้จะสลับเป็นภาพเวกเตอร์ (SVG) สำรองอัตโนมัติ
 * =========================================================================
 */
const realCardBackUrl = getCardBackUrl();
let cardBackFailed = false;
let armedDeckIdx = null;
const failedCardImages = new Set();
const preloadedCardImages = new Set();

function updateMagicCircleBackdrop(url) {
  const container = document.getElementById('magic-circle-backdrop');
  if (!container || !url) return;

  const img = new Image();
  img.src = url;
  img.alt = 'Clow Magic Circle';
  img.decoding = 'async';
  img.className = 'w-full h-full object-contain celestial-ring-cw clow-magic-circle-real opacity-0 transition-opacity duration-700';

  const reveal = () => {
    requestAnimationFrame(() => img.classList.remove('opacity-0'));
  };

  container.innerHTML = '';
  container.appendChild(img);
  if (img.complete && img.naturalWidth > 0) {
    reveal();
  } else {
    img.onload = reveal;
    img.onerror = () => {
      container.innerHTML = '';
    };
  }
}

function preloadCardImage(card) {
  if (!card || !card.driveKey) return;
  if (preloadedCardImages.has(card.driveKey) || failedCardImages.has(card.driveKey)) return;

  const url = getCardFrontUrl(card.driveKey);
  if (!url) return;

  preloadedCardImages.add(card.driveKey);
  const img = new Image();
  img.decoding = 'async';
  img.onerror = () => {
    failedCardImages.add(card.driveKey);
  };
  img.src = url;
}

function preloadAllCardImagesInBackground() {
  const heroKeys = new Set(['light', 'windy', 'fly', 'shield', 'sword']);

  // โหลดหลังไพ่และไพ่หน้าแรก 5 ใบเป็นลำดับแรก
  if (realCardBackUrl) {
    const backImg = new Image();
    backImg.decoding = 'async';
    backImg.src = realCardBackUrl;
  }
  CARDS_DATA.filter((c) => heroKeys.has(c.driveKey)).forEach((c) => preloadCardImage(c));

  // โหลดไพ่ที่เหลือทั้งหมด 47 ใบเป็นชุดย่อยในพื้นหลังเพื่อไม่ให้แย่งแบนด์วิดท์ช่วงเปิดหน้าแรก
  const remainingCards = CARDS_DATA.filter((c) => !heroKeys.has(c.driveKey));
  const batchSize = 6;
  let cursor = 0;

  const scheduleNextBatch = () => {
    if (cursor >= remainingCards.length) return;
    const batch = remainingCards.slice(cursor, cursor + batchSize);
    cursor += batchSize;
    batch.forEach((card) => preloadCardImage(card));

    if (cursor < remainingCards.length) {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => setTimeout(scheduleNextBatch, 120), { timeout: 600 });
      } else {
        setTimeout(scheduleNextBatch, 180);
      }
    }
  };

  setTimeout(scheduleNextBatch, 320);
}

function initStaticAssets() {
  const circleUrl = getMagicCircleUrl();
  updateMagicCircleBackdrop(circleUrl);
  preloadAllCardImagesInBackground();
}

/**
 * =========================================================================
 * 2. CLOW CARD RENDERERS
 * =========================================================================
 */
function buildFallbackCardBackSVG() {
  return `
    <div class="clow-frame w-full h-full select-none">
      <div class="w-full h-full rounded-[3px] bg-gradient-to-b from-[#693448] via-[#4F2031] to-[#341220] border border-[#F8DF94]/85 relative flex flex-col items-center justify-between p-1 overflow-hidden">
        <svg viewBox="0 0 100 210" preserveAspectRatio="xMidYMid meet" class="w-full h-full" fill="none">
          <rect x="4" y="4" width="92" height="202" rx="3" stroke="#EBB844" stroke-width="1.3" stroke-opacity="0.9" />
          <rect x="8" y="8" width="84" height="194" rx="2" stroke="#F8DF94" stroke-width="0.65" stroke-opacity="0.6" />
          <circle cx="50" cy="34" r="11" fill="#EBB844" fill-opacity="0.22" stroke="#F8DF94" stroke-width="1.1" />
          <circle cx="50" cy="34" r="6" fill="#F8DF94" />
          <path d="M50 17V21M50 47V51M33 34H37M63 34H67M38 22L41 25M59 43L62 46M62 22L59 25M41 43L38 46" stroke="#F8DF94" stroke-width="1.1" stroke-linecap="round" />
          <circle cx="50" cy="105" r="24" stroke="#EBB844" stroke-width="1.1" />
          <circle cx="50" cy="105" r="18" stroke="#F8DF94" stroke-width="0.7" stroke-dasharray="2 2" />
          <polygon points="50,82 70,117 30,117" stroke="#F8DF94" stroke-width="0.9" />
          <polygon points="50,128 70,93 30,93" stroke="#F8DF94" stroke-width="0.9" />
          <circle cx="50" cy="105" r="4" fill="#EBB844" />
          <path d="M26 102C14 96 10 86 14 78C19 86 24 91 30 94" stroke="#F8DF94" stroke-width="1.1" stroke-linecap="round" />
          <path d="M74 102C86 96 90 86 86 78C81 86 76 91 70 94" stroke="#F8DF94" stroke-width="1.1" stroke-linecap="round" />
          <path d="M26 108C15 110 12 118 17 124C21 118 25 114 30 112" stroke="#EBB844" stroke-width="1" stroke-linecap="round" />
          <path d="M74 108C85 110 88 118 83 124C79 118 75 114 70 112" stroke="#EBB844" stroke-width="1" stroke-linecap="round" />
          <path d="M55 166C46 166 40 172 40 180C40 188 46 194 55 194C49 191 46 186 46 180C46 174 49 169 55 166Z" fill="#F8DF94" />
          <circle cx="58" cy="180" r="2" fill="#EBB844" />
        </svg>
      </div>
    </div>
  `;
}

function buildMinimalCardBackSVG() {
  if (realCardBackUrl && !cardBackFailed) {
    return `
      <div class="clow-frame w-full h-full select-none relative">
        <img src="${realCardBackUrl}" alt="Clow Card Back" loading="eager" decoding="async" onerror="window.__handleCardBackError && window.__handleCardBackError(this)" class="w-full h-full object-contain rounded-[7.5%/3.5%]" />
      </div>
    `;
  }

  return buildFallbackCardBackSVG();
}

function buildFallbackCardFrontHTML(card) {
  return `
    <div class="clow-frame select-none">
      <div class="w-full aspect-[1/2.18] rounded-[2px] bg-gradient-to-b from-[#9E6A7C] via-[#865466] to-[#683C4D] border border-[#4A1F12] flex flex-col justify-between p-1.5 relative overflow-hidden">
        <div class="w-full flex items-center justify-between text-[8px] text-[#F8DF94] px-0.5 leading-none border-b border-[#F8DF94]/35 pb-0.5 relative z-10">
          <span>❖</span>
          <span class="font-cinzel tracking-[0.16em] text-[6px] uppercase text-[#FFF6DC]">ARCANA</span>
          <span>❖</span>
        </div>

        <div class="my-auto mx-auto w-[86%] aspect-[1/1.44] rounded-t-full rounded-b-md border-[1.5px] border-[#F8DF94]/85 bg-[radial-gradient(circle,rgba(255,244,208,0.28)_0%,rgba(42,22,14,0.38)_100%)] flex flex-col items-center justify-center relative shadow-inner overflow-hidden">
          <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-dashed border-[#F8DF94]/85 bg-[#2A160E]/25 flex items-center justify-center text-xl sm:text-2xl text-[#FFF8E3] drop-shadow">
            ${card.symbol}
          </div>
          <span class="mt-1.5 font-fahkwang text-[8px] sm:text-[9px] text-[#FFF8E3] tracking-wide px-1 text-center leading-tight">
            ${card.thaiName}
          </span>
        </div>

        <div class="w-full bg-[#F3E2B3] border border-[#4A1F12] rounded-[2px] py-0.5 px-1 text-center shadow-xs relative z-10">
          <p class="font-cinzel text-[7.5px] sm:text-[8.5px] font-bold text-[#2A160E] tracking-wider truncate leading-tight">
            ${card.name}
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildMinimalCardFrontHTML(card, { priority = false } = {}) {
  const realUrl = getCardFrontUrl(card.driveKey);
  if (realUrl && !failedCardImages.has(card.driveKey)) {
    return `
      <div class="clow-frame select-none relative">
        <img src="${realUrl}" alt="${card.name}" loading="eager" decoding="async" ${priority ? 'fetchpriority="high"' : ''} onerror="window.__handleCardFrontError && window.__handleCardFrontError(this, '${card.id}')" class="w-full h-auto block rounded-[7.5%/3.5%]" />
      </div>
    `;
  }

  return buildFallbackCardFrontHTML(card);
}

window.__handleCardBackError = (imgEl) => {
  cardBackFailed = true;
  if (imgEl && imgEl.parentElement) {
    imgEl.parentElement.outerHTML = buildFallbackCardBackSVG();
  }
};

window.__handleCardFrontError = (imgEl, cardId) => {
  const card = CARDS_DATA.find((c) => c.id === cardId);
  if (card && card.driveKey) {
    failedCardImages.add(card.driveKey);
  }
  if (card && imgEl && imgEl.parentElement) {
    imgEl.parentElement.outerHTML = buildFallbackCardFrontHTML(card);
  }
};

/**
 * =========================================================================
 * 3. GAME STATE & GUIDED RITUAL
 * =========================================================================
 */
let activeSpread = null;
let userSecretQuestion = '';
let shuffledDeck = [];
let placedSlots = [];
let focusedBoardIdx = -1;
let ritualPhase = 'shuffle';
let shuffleCount = 0;
let isAnimatingRitual = false;
let drawNoticeTimer = null;
let isDrawInteractionLocked = false;

function clearPendingDrawNotice() {
  if (drawNoticeTimer) {
    clearTimeout(drawNoticeTimer);
    drawNoticeTimer = null;
  }
  isDrawInteractionLocked = false;
  const modal = document.getElementById('draw-notice-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  const fanContainer = document.getElementById('fan-arc-container');
  if (fanContainer) fanContainer.style.pointerEvents = '';
  const quickBtn = document.getElementById('btn-quick-draw');
  if (quickBtn) quickBtn.disabled = false;
  const quickAllBtn = document.getElementById('btn-quick-draw-all');
  if (quickAllBtn) quickAllBtn.disabled = false;
  const questArrow = document.getElementById('quest-nav-arrow');
  if (questArrow) questArrow.classList.add('hidden');
}

function openDrawNoticeModal() {
  const modal = document.getElementById('draw-notice-modal');
  if (!modal) {
    isDrawInteractionLocked = false;
    const fanContainer = document.getElementById('fan-arc-container');
    if (fanContainer) fanContainer.style.pointerEvents = '';
    const quickBtn = document.getElementById('btn-quick-draw');
    if (quickBtn) quickBtn.disabled = false;
    return;
  }
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  playSoftPaperRustle();
}

function closeDrawNoticeModal() {
  const modal = document.getElementById('draw-notice-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  isDrawInteractionLocked = false;
  const fanContainer = document.getElementById('fan-arc-container');
  if (fanContainer) fanContainer.style.pointerEvents = '';
  const quickBtn = document.getElementById('btn-quick-draw');
  if (quickBtn) quickBtn.disabled = false;
  const quickAllBtn = document.getElementById('btn-quick-draw-all');
  if (quickAllBtn) quickAllBtn.disabled = false;
  playSoftPaperRustle();
}

function scrollToTopSmooth() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function triggerPageFade(el) {
  if (!el) return;
  el.classList.remove('page-transition-fade');
  void el.offsetWidth;
  el.classList.add('page-transition-fade');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fisherYatesShuffle(sourceArray) {
  const copy = [...sourceArray];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function setTableProgressText(text) {
  const mobilePill = document.getElementById('table-progress-pill');
  const desktopPill = document.getElementById('table-progress-pill-desktop');
  const isHidden = !text;
  if (mobilePill) {
    mobilePill.textContent = text || '';
    mobilePill.classList.toggle('hidden', isHidden);
  }
  if (desktopPill) {
    desktopPill.textContent = text || '';
    desktopPill.classList.toggle('sm:inline-block', !isHidden);
  }
}

function updateRitualPhaseBadges(phase) {
  const bar = document.getElementById('ritual-stepper-bar');
  if (!bar || !activeSpread) return;

  const hasQuestionStep = Boolean(activeSpread.requiresQuestionPrompt);
  const needsCut = activeSpread.card_count > 1;
  const activeCls = 'whitespace-nowrap text-center leading-tight px-1.5 sm:px-2.5 py-0.5 rounded bg-[#EBB844] text-[#2A160E] border border-[#4A1F12]';
  const inactiveCls = 'whitespace-nowrap text-center leading-tight px-1.5 sm:px-2.5 py-0.5 rounded bg-[#FCF4DC] text-[#523020] border border-[#8A5414]/45';
  const sep = '<span class="text-[#8A5414] shrink-0">-</span>';

  if (hasQuestionStep && needsCut) {
    bar.innerHTML = `
      <span class="${phase === 'question' ? activeCls : inactiveCls}">${t('stepperQuestion')}</span>
      ${sep}
      <span class="${phase === 'shuffle' ? activeCls : inactiveCls}">${t('stepperShuffle')}</span>
      ${sep}
      <span class="${phase === 'cut' ? activeCls : inactiveCls}">${t('stepperCut')}</span>
      ${sep}
      <span class="${phase === 'draw' ? activeCls : inactiveCls}">${t('stepperDraw')}</span>
    `;
  } else if (needsCut) {
    bar.innerHTML = `
      <span class="${phase === 'shuffle' ? activeCls : inactiveCls}">${t('stepperShuffleAlt')}</span>
      ${sep}
      <span class="${phase === 'cut' ? activeCls : inactiveCls}">${t('stepperCut')}</span>
      ${sep}
      <span class="${phase === 'draw' ? activeCls : inactiveCls}">${t('stepperDraw')}</span>
    `;
  } else {
    bar.innerHTML = `
      <span class="${phase === 'shuffle' ? activeCls : inactiveCls}">${t('stepperShuffleAlt')}</span>
      ${sep}
      <span class="${phase === 'draw' ? activeCls : inactiveCls}">${t('stepperDraw')}</span>
    `;
  }
}

function resetCurrentSpreadSession() {
  if (!activeSpread) return;
  clearPendingDrawNotice();
  userSecretQuestion = '';
  clearAiReadingCache();
  const qInput = document.getElementById('user-question-input');
  if (qInput) {
    qInput.value = '';
    if (!qInput.dataset.boundCounter) {
      qInput.dataset.boundCounter = '1';
      qInput.addEventListener('input', updateQuestionCharCounter);
    }
    updateQuestionCharCounter();
  }

  if (activeSpread.requiresQuestionPrompt) {
    enterQuestionStage();
  } else {
    enterRitualShuffleStage();
  }
}

function enterQuestionStage() {
  if (!activeSpread) return;
  clearPendingDrawNotice();
  ritualPhase = 'question';
  placedSlots = [];
  focusedBoardIdx = -1;
  isAnimatingRitual = false;

  const fullBtn = document.getElementById('btn-full-reading');
  if (fullBtn) fullBtn.classList.add('hidden');
  document.getElementById('board-area').classList.add('hidden');
  document.getElementById('ritual-stepper-bar').classList.remove('hidden');
  const shuffleBtn = document.getElementById('btn-shuffle');
  if (shuffleBtn) shuffleBtn.disabled = true;

  const deckPanel = document.getElementById('deck-stage-panel');
  deckPanel.className = 'vintage-frame w-full max-w-xl mx-auto rounded-lg p-3 sm:p-5 transition-all';

  document.getElementById('ritual-question-stage').classList.remove('hidden');
  document.getElementById('ritual-stack-stage').classList.add('hidden');
  document.getElementById('ritual-cut-stage').classList.add('hidden');
  document.getElementById('fan-draw-stage').classList.add('hidden');
  document.getElementById('docked-resting-deck').classList.add('hidden');

  const qInput = document.getElementById('user-question-input');
  if (qInput) {
    qInput.placeholder = getSpreadPlaceholder(activeSpread) || '';
  }

  updateRitualPhaseBadges('question');
  setTableProgressText('');
  updateQuestionCharCounter();
  updateQuestionAiStatusNote();
  document.getElementById('deck-instruction-title').textContent = t('questionTitle');
  document.getElementById('deck-instruction-sub').textContent = t('questionSub');

  triggerPageFade(deckPanel);
  scrollToTopSmooth();
}

function updateQuestionAiStatusNote() {
  const noteEl = document.getElementById('question-ai-status-note');
  if (!noteEl) return;
  try {
    const until = Number(sessionStorage.getItem('clow_ai_cooldown_until') || '0');
    const remainMs = until - Date.now();
    if (remainMs > 0) {
      const mins = Math.max(1, Math.ceil(remainMs / 60000));
      const isEn = getCurrentLang() === 'en';
      noteEl.innerHTML = isEn
        ? `✦ Our free AI reader quota is resting for about <strong>${mins} min</strong> — you can still draw cards and enjoy your full <strong>Clow Guidebook</strong> reading.`
        : `✦ ขณะนี้โควตาผู้ช่วยตีความเต็มชั่วคราว (ใช้งานได้อีกครั้งในอีกประมาณ <strong>${mins} นาที</strong>) — ยังสามารถเปิดไพ่และรับคำทำนายจาก <strong>ตำราไพ่โคลว์</strong> ได้ตามปกติ`;
      noteEl.classList.remove('hidden');
      return;
    }
  } catch (_) {}
  noteEl.innerHTML = '';
  noteEl.classList.add('hidden');
}

function updateQuestionCharCounter() {
  const qInput = document.getElementById('user-question-input');
  const counterEl = document.getElementById('user-question-counter');
  if (!qInput || !counterEl) return;
  const len = qInput.value.length;
  const max = Number(qInput.getAttribute('maxlength')) || 500;
  counterEl.textContent = getCurrentLang() === 'en' ? `${len} / ${max} chars` : `${len} / ${max} ตัวอักษร`;
  counterEl.classList.toggle('text-[#9F1239]', len >= max - 40);
  counterEl.classList.toggle('text-[#8A5414]', len < max - 40);

  const hasText = qInput.value.trim().length > 0;
  const disabledClasses = [
    'bg-[#D6D3CD]',
    'text-[#7A756D]',
    'border',
    'border-[#B8B3AA]',
    'cursor-not-allowed',
    'opacity-85'
  ];

  const submitBtn = document.getElementById('btn-submit-question');
  if (submitBtn) {
    submitBtn.disabled = !hasText;
    if (hasText) {
      submitBtn.removeAttribute('aria-disabled');
      submitBtn.classList.add('btn-vintage-primary');
      submitBtn.classList.remove(...disabledClasses);
    } else {
      submitBtn.setAttribute('aria-disabled', 'true');
      submitBtn.classList.remove('btn-vintage-primary');
      submitBtn.classList.add(...disabledClasses);
    }
  }

  const skipBtn = document.getElementById('btn-skip-question');
  if (skipBtn) {
    skipBtn.disabled = hasText;
    if (hasText) {
      skipBtn.setAttribute('aria-disabled', 'true');
      skipBtn.classList.remove('btn-vintage-secondary');
      skipBtn.classList.add(...disabledClasses);
    } else {
      skipBtn.removeAttribute('aria-disabled');
      skipBtn.classList.add('btn-vintage-secondary');
      skipBtn.classList.remove(...disabledClasses);
    }
  }
}

function skipQuestionStep() {
  const qInput = document.getElementById('user-question-input');
  if (qInput && qInput.value.trim().length > 0) return;
  userSecretQuestion = '';
  if (qInput) {
    qInput.value = '';
    if (!qInput.dataset.boundCounter) {
      qInput.dataset.boundCounter = '1';
      qInput.addEventListener('input', updateQuestionCharCounter);
    }
    updateQuestionCharCounter();
  }
  enterRitualShuffleStage();
}

function submitQuestionStep() {
  const qInput = document.getElementById('user-question-input');
  const text = qInput ? qInput.value.trim() : '';
  if (!text) return;
  userSecretQuestion = text;
  enterRitualShuffleStage();
}

function enterRitualShuffleStage() {
  if (!activeSpread) return;
  clearPendingDrawNotice();

  clearCompatibilityTimer();
  ritualPhase = 'shuffle';
  shuffleCount = 0;
  spreadCanvasZoom = 1;
  placedSlots = [];
  focusedBoardIdx = -1;
  isAnimatingRitual = false;
  shuffledDeck = fisherYatesShuffle(CARDS_DATA);

  const fullBtn = document.getElementById('btn-full-reading');
  if (fullBtn) fullBtn.classList.add('hidden');
  document.getElementById('board-area').classList.add('hidden');
  document.getElementById('ritual-stepper-bar').classList.remove('hidden');
  const shuffleBtn = document.getElementById('btn-shuffle');
  if (shuffleBtn) shuffleBtn.disabled = true;

  const deckPanel = document.getElementById('deck-stage-panel');
  deckPanel.className = 'vintage-frame w-full max-w-xl mx-auto rounded-lg p-3 sm:p-5 transition-all';

  document.getElementById('ritual-question-stage').classList.add('hidden');
  document.getElementById('ritual-stack-stage').classList.remove('hidden');
  document.getElementById('ritual-cut-stage').classList.add('hidden');
  document.getElementById('fan-draw-stage').classList.add('hidden');
  document.getElementById('docked-resting-deck').classList.add('hidden');

  const needsCut = activeSpread.card_count > 1;
  const proceedBtn = document.getElementById('btn-proceed-next');
  proceedBtn.textContent = needsCut ? t('btnProceedCut') : t('btnProceedDraw');
  proceedBtn.disabled = true;
  proceedBtn.classList.add('opacity-50', 'cursor-not-allowed');

  updateRitualPhaseBadges('shuffle');
  setTableProgressText('');
  const isEn = getCurrentLang() === 'en';
  document.getElementById('shuffle-counter-badge').textContent = isEn
    ? 'Shuffled 0 times'
    : 'สับไพ่ไปแล้ว 0 ครั้ง';
  document.getElementById('deck-instruction-title').textContent = t('shuffleTitle');
  document.getElementById('deck-instruction-sub').textContent = t('shuffleSub');

  const zone = document.getElementById('interactive-deck-touchzone');
  if (zone) {
    const totalLayers = 14;
    // จัดวางกองไพ่ให้ซ้อนเหลื่อมและเอียงเล็กน้อยอย่างเป็นธรรมชาติ เพื่อให้เห็นชัดว่าเป็นกองไพ่หลายใบ
    const organicOffsets = [
      { x: -5, y: 11, rot: -3.2 },
      { x: 4, y: 10, rot: 2.6 },
      { x: -3, y: 9, rot: -1.8 },
      { x: 5, y: 8, rot: 3.1 },
      { x: -4, y: 7, rot: -2.4 },
      { x: 2, y: 6.5, rot: 1.5 },
      { x: -2.5, y: 5.5, rot: -1.2 },
      { x: 3.5, y: 4.5, rot: 2.1 },
      { x: -3, y: 4, rot: -1.7 },
      { x: 2, y: 3, rot: 1.1 },
      { x: -1.5, y: 2.5, rot: -0.9 },
      { x: 1.5, y: 1.5, rot: 0.7 },
      { x: -0.8, y: 0.8, rot: -0.4 },
      { x: 0, y: 0, rot: 0 }
    ];
    zone.innerHTML = Array.from({ length: totalLayers }, (_, idx) => {
      const isLeft = idx % 2 === 0;
      const sideClass = isLeft ? 'riffle-left' : 'riffle-right';
      const packetRank = Math.floor(idx / 2);
      const delayMs = idx * 38;
      const offset = organicOffsets[idx] || { x: 0, y: 0, rot: 0 };
      const packetY = Math.round((6 - packetRank) * 1.1);
      return `
        <div class="shuffle-layer-card ${sideClass}"
             style="--riffle-delay: ${delayMs}ms; --rest-x: ${offset.x}px; --rest-y: ${offset.y}px; --rest-rot: ${offset.rot}deg; --packet-y: ${packetY}px; transform: translate(${offset.x}px, ${offset.y}px) rotate(${offset.rot}deg); z-index: ${10 + idx};">
          ${buildMinimalCardBackSVG()}
        </div>
      `;
    }).join('');
  }

  triggerPageFade(deckPanel);
  scrollToTopSmooth();
}

function proceedFromShuffle() {
  if (isAnimatingRitual) return;
  if (shuffleCount < 1) {
    const sub = document.getElementById('deck-instruction-sub');
    if (sub) {
      sub.textContent =
        getCurrentLang() === 'en'
          ? 'Please tap to shuffle the deck at least once to focus your mind first.'
          : 'ลองแตะสับไพ่อย่างน้อย 1 ครั้งเพื่อรวบรวมสมาธิก่อนเริ่มพิธีกรรม';
    }
    return;
  }
  if (activeSpread.card_count > 1) enterDeckCutStage();
  else enterFanDrawPhase();
}

function enterDeckCutStage() {
  clearPendingDrawNotice();
  ritualPhase = 'cut';
  isAnimatingRitual = false;
  updateRitualPhaseBadges('cut');
  const shuffleBtn = document.getElementById('btn-shuffle');
  if (shuffleBtn) shuffleBtn.disabled = false;

  document.getElementById('ritual-question-stage').classList.add('hidden');
  document.getElementById('ritual-stack-stage').classList.add('hidden');
  document.getElementById('ritual-cut-stage').classList.remove('hidden');

  const cutZone = document.getElementById('cut-deck-touchzone');
  cutZone.classList.remove('is-cutting');
  document.getElementById('cut-target-ghost').classList.remove('hidden');
  document.getElementById('btn-trigger-cut').disabled = false;

  document.getElementById('cut-top-card').innerHTML = buildMinimalCardBackSVG();
  document.getElementById('cut-bottom-card').innerHTML = buildMinimalCardBackSVG();

  setTableProgressText('');
  document.getElementById('deck-instruction-title').textContent = t('cutTitle');
  document.getElementById('deck-instruction-sub').textContent = t('cutSub');

  const deckPanel = document.getElementById('deck-stage-panel');
  triggerPageFade(deckPanel);
  scrollToTopSmooth();
}

function performDeckCut() {
  if (isAnimatingRitual || ritualPhase !== 'cut') return;
  isAnimatingRitual = true;

  const cutIndex = Math.floor(shuffledDeck.length * (0.4 + Math.random() * 0.2));
  const topHalf = shuffledDeck.slice(0, cutIndex);
  const bottomHalf = shuffledDeck.slice(cutIndex);
  shuffledDeck = [...bottomHalf, ...topHalf];

  document.getElementById('btn-trigger-cut').disabled = true;
  document.getElementById('deck-instruction-sub').textContent =
    getCurrentLang() === 'en'
      ? 'Lifting the top half aside and placing the bottom half on top...'
      : 'กำลังยกกองครึ่งบนวางทางขวา และนำกองครึ่งล่างซ้อนทับด้านบน...';

  const cutZone = document.getElementById('cut-deck-touchzone');
  cutZone.classList.remove('is-cutting');
  void cutZone.offsetWidth;
  cutZone.classList.add('is-cutting');

  playSoftPaperRustle();
  setTimeout(() => playSoftPaperRustle(), 480);

  setTimeout(() => {
    cutZone.classList.remove('is-cutting');
    isAnimatingRitual = false;
    if (activeSpread && activeSpread.layoutType === 'compatibility52') {
      enterCompatibilityReadingStage();
    } else {
      enterFanDrawPhase();
    }
  }, 1350);
}

let compatCards = [];
let compatScanIndex = 0;
let compatEliminatedPairs = 0;
let compatTimer = null;
let compatFinished = false;

function clearCompatibilityTimer() {
  if (compatTimer) {
    clearTimeout(compatTimer);
    compatTimer = null;
  }
}

function getCardSuitGroup(card) {
  const el = String(card?.elementThai || '');
  if (el.startsWith('โพดำ')) return { key: 'spades', label: 'โพดำ', color: '#4F2031' };
  if (el.startsWith('โพแดง')) return { key: 'hearts', label: 'โพแดง', color: '#B45309' };
  if (el.startsWith('ดอกจิก')) return { key: 'clubs', label: 'ดอกจิก', color: '#1E40AF' };
  return { key: 'diamonds', label: 'ข้าวหลามตัด', color: '#166534' };
}

function getCompatibilityTier(remainingCount) {
  const isEn = getCurrentLang() === 'en';
  if (remainingCount <= 10) {
    return {
      title: isEn ? 'Effortless Connection' : 'เข้ากันได้อย่างลงตัว',
      range: isEn ? '0 – 10 cards' : '0 – 10 ใบ',
      stars: 5,
      desc: isEn
        ? 'Your hearts and energies flow in easy harmony—a bright, supportive bond that feels truly natural.'
        : 'ดวงชะตาสอดประสานกันอย่างเป็นธรรมชาติ ความสัมพันธ์เต็มไปด้วยความอบอุ่นและแรงเกื้อหนุนซึ่งกันและกัน',
      badgeCls: 'text-[#4A2508] bg-[#F8E7B4]/90 border-[#B47B1E]/75'
    };
  }
  if (remainingCount <= 20) {
    return {
      title: isEn ? 'Easy Understanding' : 'สบายใจและเข้าขากันได้ดี',
      range: isEn ? '11 – 20 cards' : '11 – 20 ใบ',
      stars: 4,
      desc: isEn
        ? 'You share gentle warmth and easy understanding. Open, honest moments together will draw you even closer.'
        : 'มีพลังบวกและความเข้าใจอันดีต่อกัน ยิ่งเปิดใจรับฟังและแบ่งปันเรื่องราว สายสัมพันธ์ก็ยิ่งมั่นคงงดงาม',
      badgeCls: 'text-[#3B2A14] bg-[#F4E9C9]/90 border-[#8A6D3B]/70'
    };
  }
  if (remainingCount <= 30) {
    return {
      title: isEn ? 'Balanced & Steady' : 'สมดุลและปรับตัวกันได้',
      range: isEn ? '21 – 30 cards' : '21 – 30 ใบ',
      stars: 3,
      desc: isEn
        ? 'A calm, steady connection with moments that naturally click and a few differences you can grow through together.'
        : 'ความสัมพันธ์อยู่ในสมดุลที่งดงาม มีทั้งมุมที่เข้าขากันและมุมที่ต่างกันให้ค่อย ๆ เรียนรู้และเติบโตไปด้วยกัน',
      badgeCls: 'text-[#4A2B15] bg-[#F5E6C4]/85 border-[#9A6B2F]/65'
    };
  }
  if (remainingCount <= 40) {
    return {
      title: isEn ? 'Different Perspectives' : 'ยังต่างคิดต่างมุมมอง',
      range: isEn ? '31 – 40 cards' : '31 – 40 ใบ',
      stars: 2,
      desc: isEn
        ? 'You move at slightly different paces and see things from your own angles. Calm patience and kind listening will bridge the gap.'
        : 'ต่างฝ่ายอาจมีมุมมองหรือจังหวะชีวิตที่ต่างกันบ้าง หากใช้ความใจเย็นและรับฟังกันด้วยความอ่อนโยนจะช่วยลดช่องว่างได้ดี',
      badgeCls: 'text-[#5C2415] bg-[#F2DFC8]/90 border-[#9A4B2E]/65'
    };
  }
  return {
    title: isEn ? 'Patience & Understanding' : 'ต้องอาศัยความอดทนและเข้าใจ',
    range: isEn ? '41 – 52 cards' : '41 – 52 ใบ',
    stars: 1,
    desc: isEn
      ? 'Your natures pull in very different directions. Extra patience, flexibility, and gentle words will be the key to understanding each other.'
      : 'มีความต่างและแรงต้านค่อนข้างชัด ต้องอาศัยความอดทน ความยืดหยุ่น และถ้อยคำที่นุ่มนวลเพื่อประคองความเข้าใจต่อกัน',
    badgeCls: 'text-[#4F2031] bg-[#EFE0DF]/90 border-[#7A3548]/65'
  };
}

function findAdjacentSuitPairs(cards) {
  const matchedIndices = new Set();
  for (let i = 0; i < cards.length - 1; i++) {
    if (getCardSuitGroup(cards[i]).key === getCardSuitGroup(cards[i + 1]).key) {
      matchedIndices.add(i);
      matchedIndices.add(i + 1);
      i += 1;
    }
  }
  return matchedIndices;
}

function updateCompatibilityHeaderUI(scanIndex = -1) {
  const isEn = getCurrentLang() === 'en';
  const boardHint = document.getElementById('board-stage-hint');
  const statusPill = document.getElementById('compat-scan-pill');
  const remainEl = document.getElementById('compat-remain-count');
  const pairsWrapEl = document.getElementById('compat-pairs-wrap');
  const actionWrap = document.getElementById('compat-action-btn-wrap');
  const curtain = document.getElementById('compat-curtain-overlay');

  const remain = compatCards.length;
  const tier = getCompatibilityTier(remain);

  if (boardHint) {
    boardHint.textContent = compatFinished
      ? isEn
        ? `Done · ${remain} ${remain === 1 ? 'card' : 'cards'} left (${tier.title})`
        : `คัดไพ่เสร็จสมบูรณ์ · เหลือไพ่ ${remain} ใบ (${tier.title})`
      : '';
  }
  if (statusPill) {
    if (!compatFinished && remain > 0) {
      statusPill.textContent = isEn ? '✦ Pairing cards...' : '✦ กำลังคัดไพ่ออก...';
      statusPill.classList.remove('hidden');
    } else {
      statusPill.classList.add('hidden');
    }
  }
  if (remainEl) remainEl.textContent = String(remain);
  if (pairsWrapEl) {
    pairsWrapEl.innerHTML = isEn
      ? `(<span id="compat-pairs-count">${compatEliminatedPairs}</span> ${compatEliminatedPairs === 1 ? 'pair' : 'pairs'} cleared)`
      : `(คัดออกแล้ว <span id="compat-pairs-count">${compatEliminatedPairs}</span> คู่)`;
  }
  if (curtain) {
    curtain.classList.toggle('opacity-0', compatFinished);
    curtain.classList.toggle('pointer-events-none', compatFinished);
  }
  if (actionWrap && compatFinished) {
    actionWrap.innerHTML = `<button onclick="openCompatibilitySummaryModal()" class="btn-vintage-plum px-3.5 py-1.5 rounded-md text-xs font-fahkwang">${isEn ? '✦ View Result' : '✦ ดูผลความเข้ากันได้'}</button>`;
  }
}

function renderCompatibilityCanvas(scanIndex = -1, matchedPairIndices = new Set()) {
  const wrapper = document.getElementById('board-slots-wrapper');
  const guideText = document.getElementById('board-ritual-guide-text');
  if (!wrapper) return;

  if (guideText && guideText.parentElement) {
    guideText.parentElement.classList.add('hidden');
  }

  const isEn = getCurrentLang() === 'en';
  const remain = compatCards.length;
  const cardsHtml = compatCards.length
    ? compatCards
        .map((card, idx) => {
          const isLeftmost = compatFinished && idx === 0;
          const isRightmost = compatFinished && idx === compatCards.length - 1;
          const ringCls = isLeftmost || isRightmost ? 'ring-2 ring-[#4F2031] z-20 shadow-md' : 'hover:z-20';
          return `
            <div data-compat-card="${card.id}"
                 style="transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.36s ease, width 0.36s ease, margin 0.36s ease;"
                 class="compat-card-item relative -ml-3.5 sm:-ml-4 first:ml-0 w-12 sm:w-16 md:w-[70px] shrink-0 rounded-md ${ringCls}"
                 title="${isEn ? card.name : `${card.name} — ${card.thaiName} (${getCardSuitGroup(card).label})`}">
              ${buildMinimalCardFrontHTML(card)}
              ${
                isLeftmost
                  ? `<span class="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-[#4F2031] text-[#FFF7DE] text-[8px] font-fahkwang shadow">${isEn ? 'Leftmost' : 'ซ้ายสุด'}</span>`
                  : isRightmost
                    ? `<span class="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-[#8A5414] text-[#FFF7DE] text-[8px] font-fahkwang shadow">${isEn ? 'Rightmost' : 'ขวาสุด'}</span>`
                    : ''
              }
            </div>
          `;
        })
        .join('')
    : `<div class="py-6 text-center font-charm text-lg text-[#4F2031]">${isEn ? '✦ All 52 cards paired with zero left — a perfect match! ✦' : '✦ ตัดคู่ไพ่ครบทั้ง 52 ใบ ไม่มีไพ่เหลือ — เข้ากันได้อย่างสมบูรณ์แบบ! ✦'}</div>`;

  wrapper.innerHTML = `
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2 bg-[#FCF4DC]/85 border border-[#8A5414]/40 rounded-lg px-3 py-2">
        <div class="flex flex-wrap items-center gap-2 text-xs font-fahkwang text-[#2A160E]">
          <span id="compat-scan-pill" class="${!compatFinished ? '' : 'hidden'} px-2.5 py-0.5 rounded-full bg-[#4F2031]/10 border border-[#4F2031]/35 text-[#4F2031]">${isEn ? '✦ Pairing cards...' : '✦ กำลังคัดไพ่ออก...'}</span>
          <span>${isEn ? `Cards left <strong id="compat-remain-count" class="text-[#4F2031]">${remain}</strong> / 52` : `เหลือไพ่ <strong id="compat-remain-count" class="text-[#4F2031]">${remain}</strong> / 52 ใบ`}</span>
          <span id="compat-pairs-wrap" class="text-[#523020]">${isEn ? `(<span id="compat-pairs-count">${compatEliminatedPairs}</span> ${compatEliminatedPairs === 1 ? 'pair' : 'pairs'} cleared)` : `(คัดออกแล้ว <span id="compat-pairs-count">${compatEliminatedPairs}</span> คู่)`}</span>
        </div>
        <div id="compat-action-btn-wrap">
          ${
            compatFinished
              ? `<button onclick="openCompatibilitySummaryModal()" class="btn-vintage-plum px-3.5 py-1.5 rounded-md text-xs font-fahkwang">${isEn ? '✦ View Result' : '✦ ดูผลความเข้ากันได้'}</button>`
              : `<button onclick="skipCompatibilityAnimation()" class="btn-vintage-secondary px-3 py-1 rounded-md text-[11px] font-fahkwang">${isEn ? 'Skip to Result →' : 'ข้ามไปดูผล →'}</button>`
          }
        </div>
      </div>

      <div class="relative w-full rounded-xl border border-[#8A5414]/30 bg-[#FBF1D4]/25 px-4 sm:px-6 py-4 overflow-hidden">
        <div id="compat-curtain-overlay"
             class="${compatFinished ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'} absolute inset-0 z-40 bg-[#FBF1D4]/30 backdrop-blur-[0.5px] rounded-xl transition-opacity duration-500 flex flex-col items-center justify-center gap-2.5">
          <div class="px-4 py-1.5 rounded-full bg-[#FCF4DC]/95 border border-[#8A5414]/60 shadow-md text-xs sm:text-sm font-fahkwang text-[#4F2031] animate-pulse">
            ${isEn ? '✦ Pairing matching cards...' : '✦ กำลังคัดไพ่ออก...'}
          </div>
          <button onclick="skipCompatibilityAnimation()"
                  class="btn-vintage-secondary px-3.5 py-1.5 rounded-md text-xs font-fahkwang shadow-md">
            ${isEn ? 'Skip to Result →' : 'ข้ามไปดูผล →'}
          </button>
        </div>
        <div id="compat-cards-row" class="flex flex-wrap items-center justify-center gap-y-4 pl-3.5 sm:pl-4">
          ${cardsHtml}
        </div>
      </div>
    </div>
  `;

  updateCompatibilityHeaderUI(scanIndex);
}

function highlightCompatCardNodes(scanIndex, matchedPairIndices = new Set()) {
  const row = document.getElementById('compat-cards-row');
  if (!row) return;
  const nodes = Array.from(row.querySelectorAll('.compat-card-item'));
  nodes.forEach((node, idx) => {
    node.classList.remove('ring-2', 'ring-[#9F1239]', 'ring-[#B47B1E]', 'bg-[#F4DC9C]/55', '-translate-y-2.5', '-translate-y-1.5', 'scale-105', 'z-30', 'shadow-lg', 'shadow-md');
    if (matchedPairIndices.has(idx)) {
      node.classList.add('ring-2', 'ring-[#9F1239]', 'bg-[#F4DC9C]/55', '-translate-y-2.5', 'scale-105', 'z-30', 'shadow-lg');
    } else if (idx === scanIndex) {
      node.classList.add('ring-2', 'ring-[#B47B1E]', '-translate-y-1.5', 'scale-105', 'z-30', 'shadow-md');
    }
  });
  updateCompatibilityHeaderUI(scanIndex);
}

function finalizeCompatibilityReading() {
  clearCompatibilityTimer();
  compatFinished = true;
  placedSlots = [];
  if (compatCards.length > 0) {
    placedSlots.push({ posIndex: 1, card: compatCards[0], isRevealed: true });
    if (compatCards.length > 1) {
      placedSlots.push({ posIndex: 2, card: compatCards[compatCards.length - 1], isRevealed: true });
    }
  }
  renderCompatibilityCanvas();
  const summaryCta = document.getElementById('board-summary-cta');
  if (summaryCta) summaryCta.classList.remove('hidden');
  const revealAllFooter = document.getElementById('board-reveal-all-footer');
  if (revealAllFooter) revealAllFooter.classList.add('hidden');
  openCompatibilitySummaryModal();
}

function openBoardSummaryModal() {
  if (activeSpread && activeSpread.layoutType === 'compatibility52') {
    openCompatibilitySummaryModal();
  } else {
    openFullReadingModal();
  }
}

function runCompatibilityStep() {
  if (compatFinished) return;

  if (compatCards.length < 2 || compatScanIndex >= compatCards.length - 1) {
    finalizeCompatibilityReading();
    return;
  }

  const i = compatScanIndex;
  const isPair = getCardSuitGroup(compatCards[i]).key === getCardSuitGroup(compatCards[i + 1]).key;

  if (isPair) {
    highlightCompatCardNodes(i, new Set([i, i + 1]));
    playSoftPaperRustle();
    compatTimer = setTimeout(() => {
      const row = document.getElementById('compat-cards-row');
      const nodes = row ? Array.from(row.querySelectorAll('.compat-card-item')) : [];
      const n1 = nodes[i];
      const n2 = nodes[i + 1];
      // แอนิเมชันค่อยๆ ลอยขึ้น ย่อตัว และจางหายแบบลื่นไหลก่อนลบออก
      [n1, n2].forEach((n) => {
        if (!n) return;
        n.style.opacity = '0';
        n.style.transform = 'translateY(-18px) scale(0.75)';
        n.style.width = '0px';
        n.style.marginLeft = '0px';
        n.style.overflow = 'hidden';
      });
      compatTimer = setTimeout(() => {
        if (n1) n1.remove();
        if (n2) n2.remove();
        compatCards.splice(i, 2);
        compatEliminatedPairs += 1;
        compatScanIndex = Math.max(0, i - 1);
        highlightCompatCardNodes(compatScanIndex);
        compatTimer = setTimeout(runCompatibilityStep, 260);
      }, 380);
    }, 420);
  } else {
    highlightCompatCardNodes(i);
    compatScanIndex = i + 1;
    compatTimer = setTimeout(runCompatibilityStep, 220);
  }
}

function skipCompatibilityAnimation() {
  clearCompatibilityTimer();
  while (true) {
    const matched = findAdjacentSuitPairs(compatCards);
    if (matched.size === 0) break;
    compatEliminatedPairs += matched.size / 2;
    compatCards = compatCards.filter((_, idx) => !matched.has(idx));
  }
  finalizeCompatibilityReading();
}

function enterCompatibilityReadingStage() {
  clearCompatibilityTimer();
  clearPendingDrawNotice();
  ritualPhase = 'draw';
  compatCards = [...shuffledDeck];
  compatScanIndex = 0;
  compatEliminatedPairs = 0;
  compatFinished = false;
  updateRitualPhaseBadges('draw');

  document.getElementById('deck-stage-panel').classList.add('hidden');
  const boardArea = document.getElementById('board-area');
  boardArea.classList.remove('hidden');
  const controlsBar = document.getElementById('board-canvas-controls');
  if (controlsBar) controlsBar.classList.add('hidden');
  const summaryCta = document.getElementById('board-summary-cta');
  if (summaryCta) summaryCta.classList.add('hidden');

  renderCompatibilityCanvas(0);
  triggerPageFade(boardArea);
  scrollToTopSmooth();
  compatTimer = setTimeout(runCompatibilityStep, 550);
}

async function openCompatibilitySummaryModal() {
  if (!activeSpread) return;
  const isEn = getCurrentLang() === 'en';
  const body = document.getElementById('modal-reading-body');
  const remain = compatCards.length;
  const tier = getCompatibilityTier(remain);
  const leftCard = compatCards.length > 0 ? compatCards[0] : null;
  const rightCard = compatCards.length > 1 ? compatCards[compatCards.length - 1] : leftCard;

  let compatDb = COMPATIBILITY_READINGS;
  if (isEn) {
    try {
      const mod = await import('../data/en/compatibility-readings.js');
      if (mod?.COMPATIBILITY_READINGS_EN) compatDb = mod.COMPATIBILITY_READINGS_EN;
    } catch (_) {}
  }

  const leftCauseText = (leftCard && compatDb[leftCard.id]?.cause) || (leftCard ? leftCard.meaning : '');
  const rightAdviceText = (rightCard && compatDb[rightCard.id]?.advice) || (rightCard ? rightCard.warning : '');

  const keyCardsHtml = leftCard
    ? `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="bg-[#FCF4DC]/85 border border-[#8A5414]/45 rounded-lg p-3 space-y-2">
          <p class="font-fahkwang text-[11px] text-[#4F2031]">${isEn ? '✦ Cause or Friction' : '✦ สาเหตุหรืออุปสรรค'}</p>
          <div class="flex items-center gap-3">
            <div class="w-16 sm:w-[76px] shrink-0">${buildMinimalCardFrontHTML(leftCard)}</div>
            <div class="space-y-1 text-left">
              <p class="font-cinzel text-xs font-bold text-[#2A160E]">${leftCard.name}</p>
              ${!isEn ? `<p class="font-charm text-sm text-[#4F2031]">${leftCard.thaiName}</p>` : ''}
              <p class="font-pridi text-xs text-[#2A160E] leading-relaxed">${leftCauseText}</p>
            </div>
          </div>
        </div>
        ${
          rightCard
            ? `
        <div class="bg-[#FCF4DC]/85 border border-[#8A5414]/45 rounded-lg p-3 space-y-2">
          <p class="font-fahkwang text-[11px] text-[#8A5414]">${isEn ? '✦ Gentle Advice' : '✦ คำแนะนำการปรับตัว'}</p>
          <div class="flex items-center gap-3">
            <div class="w-16 sm:w-[76px] shrink-0">${buildMinimalCardFrontHTML(rightCard)}</div>
            <div class="space-y-1 text-left">
              <p class="font-cinzel text-xs font-bold text-[#2A160E]">${rightCard.name}</p>
              ${!isEn ? `<p class="font-charm text-sm text-[#4F2031]">${rightCard.thaiName}</p>` : ''}
              <p class="font-pridi text-xs text-[#2A160E] leading-relaxed">${rightAdviceText}</p>
            </div>
          </div>
        </div>`
            : ''
        }
      </div>
    `
    : `<div class="bg-[#F8E7B4]/85 border border-[#B47B1E]/70 rounded-lg p-3.5 text-center font-pridi text-sm text-[#4A2508]">${isEn ? 'All 52 cards paired with no obstacles remaining—your harmony flows wonderfully.' : 'ตัดคู่ไพ่ครบทุกใบ ไม่มีอุปสรรคหลงเหลือ ความสัมพันธ์ราบรื่นและสอดคล้องกันอย่างยอดเยี่ยม'}</div>`;

  const starMeterHtml = Array.from({ length: 5 }, (_, idx) =>
    idx < (tier.stars || 3)
      ? '<span class="text-[#B47B1E] drop-shadow-[0_1px_2px_rgba(180,123,30,0.35)]">✦</span>'
      : '<span class="text-[#8A5414]/25">✦</span>'
  ).join('');

  body.innerHTML = `
    <div class="space-y-4">
      <div class="text-center space-y-1 border-b border-[#8A5414]/45 pb-3">
        <span class="font-cinzel text-xs tracking-[0.18em] uppercase text-[#4F2031]">${activeSpread.engTitle}</span>
        <h3 class="font-charm text-2xl sm:text-3xl text-[#2A160E] leading-snug">
          <span class="block">${escapeHtml(t('summaryHeader'))}</span>
          <span class="block text-xl sm:text-2xl text-[#4F2031]">${escapeHtml(getSpreadName(activeSpread))}</span>
        </h3>
      </div>

      <div class="rounded-xl border border-[#8A5414]/45 bg-[#FCF4DC]/85 px-4 py-4 sm:py-5 text-center space-y-2 text-[#2A160E]">
        <div class="flex items-center justify-center gap-2 text-2xl sm:text-3xl leading-none" aria-label="${isEn ? `Compatibility ${tier.stars} out of 5` : `ระดับความเข้ากัน ${tier.stars} จาก 5`}">${starMeterHtml}</div>
        <p class="font-charm text-lg sm:text-xl font-bold text-[#4F2031] leading-snug">${tier.title}</p>
        <p class="font-fahkwang text-[11px] text-[#8A5414]">${isEn ? `Remaining cards: <strong>${remain}</strong> (${tier.range})` : `เหลือไพ่ทั้งหมด <strong>${remain} ใบ</strong> (ช่วง ${tier.range})`}</p>
        <p class="font-pridi text-xs sm:text-sm text-[#523020] leading-relaxed pt-0.5 max-w-md mx-auto">${tier.desc}</p>
      </div>

      ${keyCardsHtml}
    </div>
  `;

  const fullFooterBar = document.getElementById('reading-modal-footer-bar');
  const fullFooterActions = document.getElementById('reading-modal-footer-actions');
  if (fullFooterBar && fullFooterActions) {
    fullFooterBar.classList.remove('hidden');
    fullFooterActions.innerHTML = `
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button onclick="resetToHome()" class="bg-white hover:bg-[#F9F2F5] text-[#4F2031] border border-[#4F2031] px-3.5 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang leading-tight transition-colors">
          ${escapeHtml(t('btnOtherSpreads'))}
        </button>
        <button onclick="closeReadingModal()" class="btn-vintage-primary px-5 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang">
          ${isEn ? 'Back to Board' : 'กลับไปแท่นไพ่'}
        </button>
      </div>
    `;
  }

  const modal = document.getElementById('reading-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('reading-modal-open');
  syncReadingModalOffset(modal);
  const scrollBox = modal.querySelector('.editorial-scroll');
  if (scrollBox) scrollBox.scrollTop = 0;
  playSoftPaperRustle();

  trackEvent('summary_view', { spreadId: activeSpread.spread_id, spreadName: activeSpread.name, remaining: remain });
}

function initHeroCardShowcase() {
  const fanContainer = document.getElementById('hero-card-fan');
  if (!fanContainer) return;

  const pickById = (id) => CARDS_DATA.find((c) => c.id === id) || CARDS_DATA[0];
  const shieldCard = pickById('the_shield');
  const windyCard = pickById('the_windy');
  const lightCard = pickById('the_light');
  const flyCard = pickById('the_fly');
  const swordCard = pickById('the_sword');

  fanContainer.innerHTML = `
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="w-56 sm:w-80 md:w-96 h-32 sm:h-40 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,248,220,0.75)_0%,rgba(235,184,68,0.22)_48%,transparent_75%)]"></div>
      <svg viewBox="0 0 640 240" class="w-full h-full absolute inset-0 opacity-75" fill="none" preserveAspectRatio="xMidYMid meet">
        <g stroke="#8A5414" stroke-width="0.9" stroke-opacity="0.32" stroke-linecap="round">
          <line x1="320" y1="125" x2="320" y2="12" />
          <line x1="320" y1="125" x2="255" y2="22" />
          <line x1="320" y1="125" x2="385" y2="22" />
          <line x1="320" y1="125" x2="195" y2="45" />
          <line x1="320" y1="125" x2="445" y2="45" />
          <line x1="320" y1="125" x2="145" y2="78" />
          <line x1="320" y1="125" x2="495" y2="78" />
        </g>
        <path d="M 155 215 L 155 128 A 165 112 0 0 1 485 128 L 485 215" stroke="#5E2C1B" stroke-width="1.2" stroke-opacity="0.45" fill="none" />
        <path d="M 163 215 L 163 130 A 157 104 0 0 1 477 130 L 477 215" stroke="#8A5414" stroke-width="0.8" stroke-dasharray="4 4" stroke-opacity="0.55" fill="none" />
        <line x1="40" y1="120" x2="600" y2="120" stroke="#8A5414" stroke-width="0.8" stroke-opacity="0.4" />
        <line x1="80" y1="126" x2="560" y2="126" stroke="#4F2031" stroke-width="0.6" stroke-opacity="0.35" />
        <polygon points="96,120 101,115 106,120 101,125" fill="#D99B26" fill-opacity="0.7" />
        <polygon points="534,120 539,115 544,120 539,125" fill="#D99B26" fill-opacity="0.7" />
      </svg>
      <div class="absolute bottom-1 sm:bottom-2 w-64 sm:w-96 h-3 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(42,22,14,0.22)_0%,transparent_72%)]"></div>
    </div>

    <div class="relative z-10 flex items-center justify-center gap-2.5 sm:gap-3.5 md:gap-5 px-2">
      <div title="${shieldCard.name} — ${shieldCard.thaiName}" class="hidden sm:block altar-card-outer-left sm:w-20 md:w-24 h-auto shrink-0">${buildMinimalCardFrontHTML(shieldCard, { priority: true })}</div>
      <div title="${windyCard.name} — ${windyCard.thaiName}" class="altar-card-left w-20 sm:w-24 md:w-28 h-auto shrink-0">${buildMinimalCardFrontHTML(windyCard, { priority: true })}</div>
      <div title="${lightCard.name} — ${lightCard.thaiName}" class="altar-card-center w-24 sm:w-28 md:w-32 h-auto shrink-0">${buildMinimalCardFrontHTML(lightCard, { priority: true })}</div>
      <div title="${flyCard.name} — ${flyCard.thaiName}" class="altar-card-right w-20 sm:w-24 md:w-28 h-auto shrink-0">${buildMinimalCardFrontHTML(flyCard, { priority: true })}</div>
      <div title="${swordCard.name} — ${swordCard.thaiName}" class="hidden sm:block altar-card-outer-right sm:w-20 md:w-24 h-auto shrink-0">${buildMinimalCardFrontHTML(swordCard, { priority: true })}</div>
    </div>
  `;
}

function initSpreadNavigation() {
  const isEn = getCurrentLang() === 'en';
  const pillsNav = document.getElementById('header-spread-pills');
  pillsNav.innerHTML = SPREADS_DATA.map((s) => {
    const isActive = activeSpread && activeSpread.spread_id === s.spread_id;
    return `
      <button onclick="selectSpread('${s.spread_id}')"
              class="whitespace-nowrap px-3 py-1 rounded text-xs font-fahkwang transition ${
                isActive
                  ? 'bg-[#EBB844] text-[#2A160E] border border-[#4A1F12] shadow-xs'
                  : 'text-[#523020] hover:text-[#2A160E]'
              }">
        ${getSpreadName(s)}
      </button>
    `;
  }).join('');

  const grid = document.getElementById('spread-options-grid');
  grid.innerHTML = SPREADS_DATA.map((spread) => {
    const tags = getSpreadTopicTags(spread);
    const ritual = getSpreadRitualNotice(spread);
    return `
    <button onclick="selectSpread('${spread.spread_id}')"
            class="vintage-spread-card rounded-lg p-3.5 sm:p-5 text-left flex flex-col justify-between focus:outline-none group">
      <div class="space-y-1.5 sm:space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-cinzel text-[10px] tracking-[0.16em] text-[#4F2031]">✦ ${spread.engTitle}</span>
          <span class="px-2 py-0.5 rounded text-[11px] font-fahkwang bg-[#F8DF94] text-[#2A160E] border border-[#4A1F12]/70">${spread.card_count} ${isEn ? (spread.card_count === 1 ? 'Card' : 'Cards') : 'ใบ'}</span>
        </div>
        <h2 class="font-charm text-xl sm:text-2xl text-[#2A160E] group-hover:text-[#4F2031] transition-colors">${getSpreadName(spread)}</h2>
        ${
          tags.length > 0
            ? `<div class="flex flex-wrap gap-1 pt-0.5">${tags
                .map(
                  (tag) =>
                    `<span class="px-1.5 py-0.5 rounded text-[10px] font-fahkwang bg-[#F4DC9C]/65 text-[#4F2031] border border-[#8A5414]/35">${tag}</span>`
                )
                .join('')}</div>`
            : ''
        }
        <p class="font-pridi text-xs sm:text-sm text-[#523020] leading-relaxed">${getSpreadPurpose(spread)}</p>
        ${
          ritual.body
            ? `
        <div class="mt-1.5 rounded-md bg-[#F4DC9C]/45 border border-[#8A5414]/35 px-2.5 py-1.5 text-[11px] sm:text-xs font-pridi text-[#4F2031] leading-relaxed">
          <span class="font-fahkwang text-[10px] sm:text-[11px] text-[#8A5414] block mb-0.5">☽ ${ritual.title || (isEn ? 'Set Your Intention' : 'ตั้งจิตก่อนเริ่มทำนาย')}</span>
          <span>${ritual.body}</span>
        </div>`
            : ''
        }
      </div>
      <div class="mt-3 pt-2 sm:mt-3.5 sm:pt-2.5 border-t border-[#8A5414]/45 flex items-center justify-between text-xs font-fahkwang text-[#2A160E]">
        <span>${isEn ? 'Open Grimoire & Shuffle' : 'เปิดตำราและสับไพ่'}</span>
        <span class="text-[#4F2031] group-hover:translate-x-1 transition-transform">✦ →</span>
      </div>
    </button>
  `;
  }).join('');
}

function resetToHome() {
  clearCompatibilityTimer();
  closeReadingModal();
  closeRitualFocusModal();
  clearPendingDrawNotice();
  activeSpread = null;
  placedSlots = [];
  clearAiReadingCache();
  initSpreadNavigation();

  const selectScreen = document.getElementById('screen-select');
  document.getElementById('screen-table').classList.add('hidden');
  selectScreen.classList.remove('hidden');
  document.getElementById('btn-home').classList.add('hidden');

  triggerPageFade(selectScreen);
  scrollToTopSmooth();
}

function selectSpread(spreadId) {
  const chosen = SPREADS_DATA.find((s) => s.spread_id === spreadId);
  if (!chosen) return;

  clearPendingDrawNotice();
  activeSpread = chosen;
  placedSlots = [];
  initSpreadNavigation();

  const tableScreen = document.getElementById('screen-table');
  document.getElementById('screen-select').classList.add('hidden');
  tableScreen.classList.remove('hidden');
  document.getElementById('btn-home').classList.remove('hidden');

  document.getElementById('table-spread-title').textContent = getSpreadName(activeSpread);
  const bannerIcon = document.getElementById('table-banner-icon');
  if (bannerIcon) {
    bannerIcon.innerHTML =
      activeSpread.spread_id === 'love_cross'
        ? '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 inline-block" fill="currentColor" aria-hidden="true"><path d="M12 21s-6.7-4.35-9.33-8.22C.9 10.17 1.7 6.3 5 4.8a5.2 5.2 0 0 1 6.1 1.35L12 7.2l.9-1.05A5.2 5.2 0 0 1 19 4.8c3.3 1.5 4.1 5.37 2.33 7.98C18.7 16.65 12 21 12 21Z"/></svg>'
        : '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 inline-block" fill="currentColor" aria-hidden="true"><path d="M12.3 3a9 9 0 1 0 8.7 11.4A7.5 7.5 0 0 1 12.3 3Z"/></svg>';
  }
  trackEvent('spread_start', { spreadId: activeSpread.spread_id, spreadName: activeSpread.name });

  triggerPageFade(tableScreen);
  resetCurrentSpreadSession();
  if (activeSpread.ritualNoticeBody) {
    openRitualFocusModal(activeSpread);
  }
}

function openRitualFocusModal(spread) {
  const modal = document.getElementById('ritual-focus-modal');
  const titleEl = document.getElementById('ritual-focus-title');
  const bodyEl = document.getElementById('ritual-focus-body');
  const tipEl = document.getElementById('ritual-focus-tip');
  if (!modal || !titleEl || !bodyEl || !tipEl) return;

  const isEn = getCurrentLang() === 'en';
  const ritual = getSpreadRitualNotice(spread);
  titleEl.textContent = ritual.title || (isEn ? 'Set Your Intention' : 'ตั้งจิตก่อนเริ่มทำนาย');
  bodyEl.innerHTML = ritual.body || '';
  if (ritual.tip) {
    tipEl.textContent = ritual.tip;
    tipEl.classList.remove('hidden');
  } else {
    tipEl.classList.add('hidden');
  }
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeRitualFocusModal() {
  const modal = document.getElementById('ritual-focus-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function dismissRitualFocusModal() {
  closeRitualFocusModal();
  resetToHome();
}

function handleRitualFocusBackdropClick(event) {
  if (event.target.id === 'ritual-focus-modal') {
    dismissRitualFocusModal();
  }
}

function handleDeckStackInteraction() {
  if (isAnimatingRitual || ritualPhase !== 'shuffle') return;

  isAnimatingRitual = true;
  shuffleCount += 1;
  shuffledDeck = fisherYatesShuffle(shuffledDeck);

  const zone = document.getElementById('interactive-deck-touchzone');
  zone.classList.remove('is-shuffling');
  void zone.offsetWidth;
  zone.classList.add('is-shuffling');

  const isEn = getCurrentLang() === 'en';
  document.getElementById('shuffle-counter-badge').textContent = isEn
    ? `Shuffled ${shuffleCount} ${shuffleCount === 1 ? 'time' : 'times'}`
    : `สับไพ่ไปแล้ว ${shuffleCount} ครั้ง`;
  const proceedBtn = document.getElementById('btn-proceed-next');
  if (proceedBtn && shuffleCount >= 1) {
    proceedBtn.disabled = false;
    proceedBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
  playRapidRiffleSound(14);

  setTimeout(() => {
    zone.classList.remove('is-shuffling');
    isAnimatingRitual = false;
  }, 980);
}

function enterFanDrawPhase() {
  if (isAnimatingRitual) return;
  if (shuffleCount === 0) {
    shuffledDeck = fisherYatesShuffle(shuffledDeck);
  }

  clearPendingDrawNotice();
  ritualPhase = 'draw';
  isDrawInteractionLocked = true;
  updateRitualPhaseBadges('draw');
  const shuffleBtn = document.getElementById('btn-shuffle');
  if (shuffleBtn) shuffleBtn.disabled = false;

  const workspace = document.getElementById('table-workspace');
  workspace.className = 'w-full flex flex-col items-stretch justify-center gap-3 sm:gap-4';

  const boardArea = document.getElementById('board-area');
  boardArea.classList.remove('hidden', 'order-1');
  boardArea.classList.add('order-2');
  renderSpreadBoard();

  const deckPanel = document.getElementById('deck-stage-panel');
  deckPanel.className = 'vintage-frame order-1 w-full rounded-lg p-3 sm:p-4 transition-all';

  document.getElementById('ritual-question-stage').classList.add('hidden');
  document.getElementById('ritual-stack-stage').classList.add('hidden');
  document.getElementById('ritual-cut-stage').classList.add('hidden');
  document.getElementById('docked-resting-deck').classList.add('hidden');
  document.getElementById('fan-draw-stage').classList.remove('hidden');

  const quickBtn = document.getElementById('btn-quick-draw');
  if (quickBtn) quickBtn.disabled = true;
  const quickAllBtn = document.getElementById('btn-quick-draw-all');
  if (quickAllBtn) {
    quickAllBtn.disabled = true;
    quickAllBtn.classList.toggle('hidden', activeSpread.card_count <= 1);
  }
  armedDeckIdx = null;
  const confirmArmedBtn = document.getElementById('btn-confirm-armed-card');
  if (confirmArmedBtn) confirmArmedBtn.classList.add('hidden');

  renderFannedDeckArc(true);
  updateTableProgress();
  playRapidRiffleSound(24, 0.055);
  triggerPageFade(deckPanel);
  scrollToTopSmooth();

  // แสดงป็อปอัปแจ้งเตือนช่วงกลางค่อนท้ายของการกรีดไพ่ (ไม่ต้องรอจนแอนิเมชันใบสุดท้ายจบ)
  const earlyNoticeDelayMs = Math.max(300, Math.round((shuffledDeck.length - 1) * 18));
  drawNoticeTimer = setTimeout(() => {
    drawNoticeTimer = null;
    if (ritualPhase === 'draw' && placedSlots.length < (activeSpread ? activeSpread.card_count : 0)) {
      openDrawNoticeModal();
    }
  }, earlyNoticeDelayMs);
}

function computeBalancedDeckRows(totalCards, containerWidth) {
  const w = containerWidth || window.innerWidth || 360;
  const isMobile = w < 640;
  const isTablet = w >= 640 && w < 1024;

  const cardW = isMobile ? 44 : isTablet ? 58 : 70;
  const minStep = isMobile ? 25 : isTablet ? 36 : 44;
  const maxPerRow = Math.max(8, Math.floor((w - cardW) / minStep) + 1);

  if (maxPerRow >= 26) return [26, 26];

  const rowCount = Math.max(3, Math.ceil(totalCards / maxPerRow));
  const base = Math.floor(totalCards / rowCount);
  const rem = totalCards % rowCount;

  const rows = Array.from({ length: rowCount }, (_, i) => base + (i < rem ? 1 : 0));
  const half = Math.floor(rowCount / 2);
  for (let i = 0; i < half; i++) {
    const j = rowCount - 1 - i;
    const shift = Math.min(2, rows[j] - 4);
    if (shift > 0 && rows[i] + shift <= maxPerRow) {
      rows[i] += shift;
      rows[j] -= shift;
    }
  }
  return rows;
}

function renderFannedDeckArc(animateDeal = false) {
  const container = document.getElementById('fan-arc-container');
  const hintEl = document.getElementById('fan-hover-hint');
  if (hintEl) {
    hintEl.textContent = t('drawHintDefault');
  }

  const containerWidth = container.clientWidth || container.parentElement.clientWidth || window.innerWidth;
  const isMobile = window.innerWidth < 640;
  const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;
  const cardW = isMobile ? 44 : isTablet ? 58 : 70;
  const cardSizeCls = isMobile ? 'w-[44px]' : isTablet ? 'w-[58px]' : 'w-[70px]';

  const rowSizes = computeBalancedDeckRows(shuffledDeck.length, containerWidth);
  const used = new Set(placedSlots.map((s) => s.deckIdx));

  container.style.pointerEvents = isDrawInteractionLocked ? 'none' : '';

  let cardCursor = 0;
  container.innerHTML = rowSizes
    .map((countInRow, rowIdx) => {
      const idealStep =
        countInRow > 1
          ? Math.min(cardW * 0.66, (containerWidth - cardW - 8) / (countInRow - 1))
          : cardW;
      const overlapPx = countInRow > 1 ? Math.min(-10, Math.round(idealStep - cardW)) : 0;

      const rowButtons = [];
      for (let i = 0; i < countInRow && cardCursor < shuffledDeck.length; i++, cardCursor++) {
        const idx = cardCursor;
        const isUsed = used.has(idx);
        const marginStyle = i === 0 ? 'margin-left: 0px;' : `margin-left: ${overlapPx}px;`;
        const dealDelayStyle = animateDeal ? `--deal-delay: ${idx * 28}ms;` : '';
        const dealCls = animateDeal ? 'fan-deal-in' : '';
        const cardTitleTip = getCurrentLang() === 'en' ? 'Choose this card' : 'เลือกไพ่ใบนี้';

        rowButtons.push(`
          <button id="deck-card-${idx}"
                  ${isUsed ? 'disabled' : ''}
                  onclick="pickCardFromDeck(${idx})"
                  onmouseenter="handleDeckCardHover()"
                  style="z-index: ${idx + 1}; ${marginStyle} ${dealDelayStyle}"
                  class="draw-row-card ${dealCls} relative shrink-0 ${cardSizeCls} clow-aspect focus:outline-none"
                  title="${cardTitleTip}">
            ${buildMinimalCardBackSVG()}
          </button>
        `);
      }

      return `
        <div class="w-full flex items-center justify-center ${rowIdx > 0 ? 'mt-1.5 sm:mt-2' : ''}">
          ${rowButtons.join('')}
        </div>
      `;
    })
    .join('');
}

function handleDeckCardHover() {
  if (armedDeckIdx !== null) return;
  const hintEl = document.getElementById('fan-hover-hint');
  if (hintEl) {
    hintEl.textContent = t('drawHintHover');
  }
}

function pickCardFromDeck(deckIdx) {
  if (!activeSpread || ritualPhase !== 'draw' || isDrawInteractionLocked) return;
  if (placedSlots.length >= activeSpread.card_count) return;
  if (placedSlots.some((s) => s.deckIdx === deckIdx)) return;

  const cardBtn = document.getElementById(`deck-card-${deckIdx}`);
  const hintEl = document.getElementById('fan-hover-hint');
  const confirmBtn = document.getElementById('btn-confirm-armed-card');

  // คลิกครั้งแรก: ยกไพ่ขึ้นและขอให้คลิกซ้ำเพื่อยืนยัน
  if (armedDeckIdx !== deckIdx) {
    if (armedDeckIdx !== null) {
      const prevBtn = document.getElementById(`deck-card-${armedDeckIdx}`);
      if (prevBtn) prevBtn.classList.remove('is-armed');
    }
    armedDeckIdx = deckIdx;
    if (cardBtn) {
      cardBtn.classList.remove('fan-deal-in');
      cardBtn.classList.add('is-armed');
    }
    if (hintEl) {
      hintEl.textContent = t('drawHintConfirm');
    }
    if (confirmBtn) confirmBtn.classList.remove('hidden');
    playSoftPaperRustle();
    return;
  }

  // คลิกครั้งที่สองบนไพ่ใบเดิม: ยืนยันเลือกและเฟดขึ้นด้านบน
  armedDeckIdx = null;
  if (confirmBtn) confirmBtn.classList.add('hidden');
  if (cardBtn) {
    cardBtn.classList.remove('fan-deal-in', 'is-armed');
    cardBtn.classList.add('is-picked');
    cardBtn.disabled = true;
  }
  if (hintEl) {
    hintEl.textContent = t('drawHintHover');
  }

  const chosenCard = shuffledDeck[deckIdx];
  const nextPosIndex = placedSlots.length + 1;
  placedSlots.push({
    posIndex: nextPosIndex,
    deckIdx,
    card: chosenCard,
    isRevealed: false
  });

  preloadCardImage(chosenCard);
  trackEvent('card_draw', {
    spreadId: activeSpread.spread_id,
    spreadName: activeSpread.name,
    cardId: chosenCard.id,
    cardName: chosenCard.name,
    posIndex: nextPosIndex
  });

  focusedBoardIdx = nextPosIndex;
  playSoftPaperRustle();
  renderSpreadBoard();
  updateTableProgress();

  if (placedSlots.length >= activeSpread.card_count) {
    const workspace = document.getElementById('table-workspace');
    workspace.className = 'w-full flex flex-col items-stretch justify-center gap-3 sm:gap-4';

    const boardArea = document.getElementById('board-area');
    boardArea.classList.remove('order-2');
    boardArea.classList.add('order-1');

    // ซ่อนกล่องสำรับไพ่ที่เหลือออกเพื่อให้หน้าแท่นพยากรณ์สะอาดและเต็มตา
    const deckPanel = document.getElementById('deck-stage-panel');
    deckPanel.classList.add('hidden');

    triggerPageFade(boardArea);
    scrollToTopSmooth();
  }
}

function drawRandomAvailableCard() {
  if (!activeSpread || ritualPhase !== 'draw' || isDrawInteractionLocked) return;
  if (placedSlots.length >= activeSpread.card_count) return;

  const used = new Set(placedSlots.map((s) => s.deckIdx));
  const available = [];
  for (let i = 0; i < shuffledDeck.length; i++) {
    if (!used.has(i)) available.push(i);
  }
  if (available.length === 0) return;

  const pool = available.length > 1 && armedDeckIdx !== null
    ? available.filter((idx) => idx !== armedDeckIdx)
    : available;
  const chosenIdx = pool[Math.floor(Math.random() * pool.length)];
  pickCardFromDeck(chosenIdx);
}

function confirmArmedCardSelection() {
  if (armedDeckIdx === null) return;
  pickCardFromDeck(armedDeckIdx);
}

function drawAllRemainingCards() {
  if (!activeSpread || ritualPhase !== 'draw' || isDrawInteractionLocked) return;
  const needed = activeSpread.card_count - placedSlots.length;
  if (needed <= 0) return;

  if (armedDeckIdx !== null) {
    const prevBtn = document.getElementById(`deck-card-${armedDeckIdx}`);
    if (prevBtn) prevBtn.classList.remove('is-armed');
    armedDeckIdx = null;
  }
  const confirmBtn = document.getElementById('btn-confirm-armed-card');
  if (confirmBtn) confirmBtn.classList.add('hidden');

  const used = new Set(placedSlots.map((s) => s.deckIdx));
  const available = [];
  for (let i = 0; i < shuffledDeck.length; i++) {
    if (!used.has(i)) available.push(i);
  }
  const chosenIndices = fisherYatesShuffle(available).slice(0, needed);
  if (chosenIndices.length === 0) return;

  isDrawInteractionLocked = true;
  const quickBtn = document.getElementById('btn-quick-draw');
  const quickAllBtn = document.getElementById('btn-quick-draw-all');
  if (quickBtn) quickBtn.disabled = true;
  if (quickAllBtn) quickAllBtn.disabled = true;

  chosenIndices.forEach((deckIdx, stepIdx) => {
    setTimeout(() => {
      isDrawInteractionLocked = false;
      armedDeckIdx = deckIdx;
      pickCardFromDeck(deckIdx);
      if (stepIdx < chosenIndices.length - 1) {
        isDrawInteractionLocked = true;
      } else {
        if (quickBtn) quickBtn.disabled = false;
        if (quickAllBtn) quickAllBtn.disabled = false;
      }
    }, stepIdx * 140);
  });
}

function updateTableProgress() {
  if (!activeSpread) return;
  const isEn = getCurrentLang() === 'en';
  const count = placedSlots.length;
  const total = activeSpread.card_count;
  const boardHint = document.getElementById('board-stage-hint');
  const guideText = document.getElementById('board-ritual-guide-text');
  const summaryCta = document.getElementById('board-summary-cta');
  const revealAllFooter = document.getElementById('board-reveal-all-footer');

  if (count < total) {
    setTableProgressText(isEn ? `Chosen ${count} / ${total}` : `เลือกไพ่ ${count} / ${total} ใบ`);
    boardHint.textContent = isEn
      ? `Choosing card ${count + 1} of ${total}`
      : `กำลังเลือกไพ่ใบที่ ${count + 1} จาก ${total} ใบ`;
    guideText.innerHTML = isEn
      ? `Trust your first feeling and choose 1 card that draws your eye — <em>cards cannot be swapped once chosen</em>`
      : `ใช้ความรู้สึกแวบแรกเลือกไพ่ 1 ใบที่สะดุดตาที่สุด — <em>เลือกแล้วไม่สามารถเปลี่ยนใบได้</em>`;
    document.getElementById('deck-instruction-title').textContent = isEn
      ? `Choose Card ${count + 1} of ${total}`
      : `เลือกไพ่ใบที่ ${count + 1} จาก ${total} ใบ`;
    document.getElementById('deck-instruction-sub').textContent = isEn
      ? 'Trust your first feeling and tap the face-down card that catches your eye.'
      : 'ใช้ความรู้สึกแวบแรก แตะเลือกไพ่คว่ำใบที่ถูกชะตาที่สุดโดยไม่ต้องลังเล';
    if (summaryCta) summaryCta.classList.add('hidden');
    if (revealAllFooter) revealAllFooter.classList.add('hidden');
  } else {
    setTableProgressText(isEn ? `All ${total} / ${total} placed` : `วางไพ่ครบ ${total} / ${total} ใบแล้ว`);
    document.getElementById('deck-instruction-title').textContent = isEn
      ? 'All Cards Are in Place'
      : 'อัญเชิญไพ่ครบตามผังแล้ว';
    document.getElementById('deck-instruction-sub').textContent = isEn
      ? 'Tap each card on the board in numbered order to reveal its message.'
      : 'แตะเปิดไพ่บนแท่นตามลำดับหมายเลขในคู่มือ';

    const unrevealed = placedSlots.filter((s) => !s.isRevealed);
    if (unrevealed.length > 0) {
      const nextPos = unrevealed[0].posIndex;
      const posMeta = activeSpread.positions.find((p) => p.index === nextPos);
      const posTitle = posMeta ? getPosTitle(activeSpread.spread_id, posMeta) : '';
      boardHint.textContent = isEn
        ? `Next to reveal: ${posMeta ? `${posMeta.index}. ${posTitle}` : ''}`
        : `ลำดับการเปิดตามคู่มือ: ${posMeta ? `${posMeta.index}. ${posTitle}` : ''}`;
      guideText.innerHTML = '';
      guideText.classList.add('hidden');
      if (guideText.parentElement) guideText.parentElement.classList.add('hidden');
      const fullBtn = document.getElementById('btn-full-reading');
      if (fullBtn) fullBtn.classList.add('hidden');
      if (summaryCta) summaryCta.classList.add('hidden');
      if (revealAllFooter) {
        if (activeSpread.card_count > 1) revealAllFooter.classList.remove('hidden');
        else revealAllFooter.classList.add('hidden');
      }
    } else {
      boardHint.textContent = t('boardHintDone');
      guideText.innerHTML = isEn
        ? `All cards have been revealed. Tap any card to read it again, or tap <strong>"View Summary"</strong> below.`
        : `เปิดเผยไพ่ครบทุกใบแล้ว แตะที่ไพ่ใบใดก็ได้เพื่อทบทวน หรือกด <strong>"ดูบทสรุป"</strong> ด้านล่าง`;
      const fullBtn = document.getElementById('btn-full-reading');
      if (fullBtn) fullBtn.classList.remove('hidden');
      if (revealAllFooter) revealAllFooter.classList.add('hidden');
      if (summaryCta) {
        summaryCta.classList.remove('hidden');
      }
    }
  }
  updateQuestNavArrow();
}

let spreadCanvasZoom = 1;

function applySpreadCanvasZoom() {
  const stage = document.getElementById('board-canvas-stage');
  const sizer = document.getElementById('board-canvas-sizer');
  const label = document.getElementById('board-zoom-label');
  if (label) {
    label.textContent = `${Math.round(spreadCanvasZoom * 100)}%`;
  }
  if (!stage) return;
  stage.style.transform = `scale(${spreadCanvasZoom})`;
  stage.style.transformOrigin = 'top left';
  if (sizer) {
    const baseW = stage.offsetWidth || 0;
    const baseH = stage.offsetHeight || 0;
    if (baseW && baseH) {
      sizer.style.width = `${Math.ceil(baseW * spreadCanvasZoom)}px`;
      sizer.style.height = `${Math.ceil(baseH * spreadCanvasZoom)}px`;
    }
  }
  requestAnimationFrame(updateQuestNavArrow);
}

function adjustSpreadZoom(delta) {
  spreadCanvasZoom = Math.min(1.5, Math.max(0.2, Math.round((spreadCanvasZoom + delta) * 100) / 100));
  applySpreadCanvasZoom();
}

function resetSpreadZoom() {
  spreadCanvasZoom = 1;
  applySpreadCanvasZoom();
  const vp = document.getElementById('board-canvas-viewport');
  if (vp) vp.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
}

function panSpreadCanvas(direction) {
  const vp = document.getElementById('board-canvas-viewport');
  if (!vp) return;
  const step = Math.max(140, Math.round(vp.clientWidth * 0.55));
  vp.scrollBy({ left: direction * step, behavior: 'smooth' });
}

function bindBoardCanvasInteractions() {
  const vp = document.getElementById('board-canvas-viewport');
  if (!vp || vp.dataset.boundCanvas) return;
  vp.dataset.boundCanvas = '1';
  vp.addEventListener('scroll', updateQuestNavArrow, { passive: true });

  // Pinch-to-zoom เฉพาะภายในแคนวาสแท่นวางไพ่
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  vp.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist = Math.hypot(dx, dy);
        pinchStartZoom = spreadCanvasZoom;
      }
    },
    { passive: true }
  );
  vp.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const nextZoom = pinchStartZoom * (dist / pinchStartDist);
        spreadCanvasZoom = Math.min(1.5, Math.max(0.2, Math.round(nextZoom * 100) / 100));
        applySpreadCanvasZoom();
      }
    },
    { passive: false }
  );
  vp.addEventListener(
    'touchend',
    () => {
      pinchStartDist = 0;
    },
    { passive: true }
  );
}

function updateQuestNavArrow() {
  const arrowBtn = document.getElementById('quest-nav-arrow');
  const arrowText = document.getElementById('quest-nav-arrow-text');
  const arrowIcon = document.getElementById('quest-nav-arrow-icon');
  if (!arrowBtn || !arrowText) return;

  const isAllPlaced = activeSpread && ritualPhase === 'draw' && placedSlots.length >= activeSpread.card_count;
  const unrevealed = isAllPlaced
    ? placedSlots.filter((s) => !s.isRevealed).sort((a, b) => a.posIndex - b.posIndex)
    : [];

  if (!isAllPlaced || unrevealed.length === 0) {
    arrowBtn.classList.add('hidden');
    return;
  }

  const nextTarget = document.querySelector('.next-in-sequence-ring');
  if (!nextTarget) {
    arrowBtn.classList.add('hidden');
    return;
  }

  const rect = nextTarget.getBoundingClientRect();
  const vp = document.getElementById('board-canvas-viewport');
  const vpRect = vp ? vp.getBoundingClientRect() : null;

  const minTop = Math.max(72, vpRect ? vpRect.top : 72);
  const maxBottom = Math.min(window.innerHeight - 16, vpRect ? vpRect.bottom : window.innerHeight - 16);
  const minLeft = Math.max(8, vpRect ? vpRect.left : 8);
  const maxRight = Math.min(window.innerWidth - 8, vpRect ? vpRect.right : window.innerWidth - 8);

  const isOut =
    rect.top < minTop || rect.bottom > maxBottom || rect.left < minLeft || rect.right > maxRight;

  if (!isOut) {
    arrowBtn.classList.add('hidden');
    return;
  }

  const nextPos = unrevealed[0].posIndex;
  const targetCx = rect.left + rect.width / 2;
  const targetCy = rect.top + rect.height / 2;
  const viewCx = (minLeft + maxRight) / 2;
  const viewCy = (minTop + maxBottom) / 2;
  const angleDeg = Math.round((Math.atan2(targetCy - viewCy, targetCx - viewCx) * 180) / Math.PI);

  if (arrowIcon) {
    arrowIcon.style.transform = `rotate(${angleDeg}deg)`;
  }
  arrowText.textContent =
    getCurrentLang() === 'en' ? `Tap to reveal card ${nextPos}` : `แตะเปิดไพ่ลำดับที่ ${nextPos}`;
  arrowBtn.classList.remove('hidden');
}

function scrollToNextQuestCard() {
  const nextTarget = document.querySelector('.next-in-sequence-ring');
  if (nextTarget) {
    nextTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
}

function buildSlotHTML(pos) {
  const placed = placedSlots.find((s) => s.posIndex === pos.index);
  const isAllPlaced = placedSlots.length >= activeSpread.card_count;
  const firstUnrevealed = placedSlots
    .filter((s) => !s.isRevealed)
    .sort((a, b) => a.posIndex - b.posIndex)[0];
  const isNextToFlip =
    isAllPlaced && placed && !placed.isRevealed && firstUnrevealed && firstUnrevealed.posIndex === pos.index;
  const isJustFocused = !isAllPlaced && placed && focusedBoardIdx === pos.index;

  const isCompactBoard = activeSpread.layoutType === 'general10' || activeSpread.layoutType === 'romance7';
  const cardSizeCls =
    activeSpread.layoutType === 'single'
      ? 'w-full max-w-[210px]'
      : isCompactBoard
        ? 'w-full max-w-[112px]'
        : 'w-full max-w-[144px]';
  const boxPadCls = isCompactBoard ? 'p-1 sm:p-1.5' : 'p-1.5 sm:p-2.5';
  const headerMinH = isCompactBoard ? 'min-h-[28px] sm:min-h-[34px] px-1 py-0.5 mb-1' : 'min-h-[36px] sm:min-h-[42px] px-1.5 sm:px-2 py-0.5 mb-1.5';
  const titleTextCls = isCompactBoard ? 'text-[7.5px] sm:text-[9.5px]' : 'text-[8.5px] sm:text-[11px]';

  const isEn = getCurrentLang() === 'en';
  const posTitleText = getPosTitle(activeSpread.spread_id, pos);
  const slotHeader = `
    <div class="inline-flex flex-wrap items-center justify-center gap-0.5 sm:gap-1 ${headerMinH} rounded-lg bg-[#FCF4DC]/40 border border-[#8A5414]/20 opacity-80 w-full text-center">
      <span class="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#8A5414]/20 text-[#523020]/85 font-cinzel text-[8px] sm:text-[9px] font-semibold flex items-center justify-center shrink-0 leading-none">
        ${pos.index}
      </span>
      <span class="font-fahkwang ${titleTextCls} text-[#523020]/75 leading-tight break-words">
        ${posTitleText}
      </span>
    </div>
  `;

  const slotHeightCls = isCompactBoard ? 'h-auto' : 'h-full';

  if (!placed) {
    const isCurrentTarget = placedSlots.length + 1 === pos.index;
    return `
      <div class="flex flex-col items-center justify-between w-full ${slotHeightCls} min-w-0 ${boxPadCls} rounded-xl bg-[#FBF1D4]/30 border border-[#8A5414]/25">
        ${slotHeader}
        <div class="${cardSizeCls} clow-aspect rounded-[10px] border-2 border-dashed ${
          isCurrentTarget ? 'border-[#4A1F12] bg-[#F8DF94]/65 shadow-inner' : 'border-[#8A5414]/45 bg-[#FCF4DC]/65'
        } flex flex-col items-center justify-center p-1 sm:p-2 text-center transition-all">
          <span class="font-cinzel text-xs sm:text-sm font-bold text-[#4F2031]/80">${pos.index}</span>
          <span class="font-pridi text-[8px] sm:text-[9.5px] text-[#523020]/85 mt-0.5 leading-tight">
            ${isCurrentTarget ? t('slotWaiting') : isEn ? 'Empty' : 'ว่าง'}
          </span>
        </div>
        <span class="mt-1 min-h-[18px] sm:min-h-[22px]"></span>
      </div>
    `;
  }

  const highlightCls = placed.isRevealed
    ? 'revealed-board-card'
    : isNextToFlip
      ? 'next-in-sequence-ring'
      : isJustFocused
        ? 'active-card-spotlight'
        : '';

  const slotBtnTitle = !isAllPlaced
    ? isEn
      ? 'Please draw all cards first before revealing'
      : 'กรุณาเลือกไพ่ให้ครบทุกใบก่อนเปิดคำทำนาย'
    : placed.isRevealed
      ? isEn
        ? `Read ${placed.card.name}`
        : `อ่านคำทำนาย ${placed.card.name}`
      : isEn
        ? `Tap to reveal card ${pos.index}`
        : `แตะเพื่อพลิกเปิดไพ่ตามลำดับที่ ${pos.index}`;

  const slotFooterLabel = placed.isRevealed
    ? isEn
      ? placed.card.name
      : placed.card.thaiName
    : !isAllPlaced
      ? t('slotWaitAll')
      : isNextToFlip
        ? isEn
          ? `✦ Tap to Reveal #${pos.index}`
          : `✦ แตะเปิดลำดับ ${pos.index}`
        : t('slotFaceDown');

  return `
    <div class="flex flex-col items-center justify-between w-full ${slotHeightCls} min-w-0 ${boxPadCls} rounded-xl bg-[#FBF1D4]/30 border border-[#8A5414]/25 card-enter">
      ${slotHeader}
      <button onclick="handlePlacedCardClick(${pos.index})"
              class="perspective-1200 ${cardSizeCls} clow-aspect focus:outline-none ${isAllPlaced ? 'cursor-pointer' : 'cursor-not-allowed'} group ${highlightCls}"
              title="${slotBtnTitle}">
        <div class="card-inner ${placed.isRevealed ? 'is-flipped' : ''}">
          <div class="card-face">
            ${buildMinimalCardBackSVG()}
          </div>
          <div class="card-face card-front" data-card-front-slot="${placed.card.id}">
            ${buildMinimalCardFrontHTML(placed.card)}
          </div>
        </div>
      </button>
      <span class="mt-1.5 min-h-[24px] sm:min-h-[28px] flex items-center justify-center font-fahkwang text-[8.5px] sm:text-[10px] text-center leading-tight ${
        placed.isRevealed ? 'text-[#4F2031]/70' : 'text-[#523020]/60'
      }">
        ${slotFooterLabel}
      </span>
    </div>
  `;
}

function renderSpreadBoard() {
  const wrapper = document.getElementById('board-slots-wrapper');
  const controlsBar = document.getElementById('board-canvas-controls');
  if (!activeSpread || !wrapper) return;

  const getPos = (idx) => activeSpread.positions.find((p) => p.index === idx);
  const showCanvasControls = activeSpread.card_count > 1;
  if (controlsBar) {
    controlsBar.classList.toggle('hidden', !showCanvasControls);
  }

  if (activeSpread.layoutType === 'single') {
    spreadCanvasZoom = 1;
    wrapper.innerHTML = `<div class="flex justify-center items-center py-1 max-w-xs mx-auto">${buildSlotHTML(getPos(1))}</div>`;
    return;
  }

  let innerBoardHTML = '';
  if (activeSpread.layoutType === 'romance7') {
    innerBoardHTML = `
      <div class="grid grid-cols-8 gap-x-1.5 sm:gap-x-2.5 gap-y-2 sm:gap-y-3 items-stretch w-[340px] sm:w-[600px] mx-auto">
        <div class="col-start-3 col-span-2">${buildSlotHTML(getPos(1))}</div>
        <div class="col-start-1 col-span-2 row-start-2">${buildSlotHTML(getPos(4))}</div>
        <div class="col-start-3 col-span-2 row-start-2">${buildSlotHTML(getPos(6))}</div>
        <div class="col-start-5 col-span-2 row-start-2">${buildSlotHTML(getPos(3))}</div>
        <div class="col-start-2 col-span-2 row-start-3">${buildSlotHTML(getPos(2))}</div>
        <div class="col-start-4 col-span-2 row-start-3">${buildSlotHTML(getPos(5))}</div>
        <div class="col-start-7 col-span-2 row-start-3">${buildSlotHTML(getPos(7))}</div>
      </div>
    `;
  } else if (activeSpread.layoutType === 'general10') {
    innerBoardHTML = `
      <div class="grid grid-cols-6 gap-x-1.5 sm:gap-x-2.5 items-stretch w-[560px] sm:w-[760px] mx-auto">
        <div class="flex flex-col justify-center">
          ${buildSlotHTML(getPos(7))}
        </div>
        <div class="flex flex-col justify-center gap-1.5 sm:gap-2.5">
          ${buildSlotHTML(getPos(3))}
          ${buildSlotHTML(getPos(5))}
        </div>
        <div class="flex flex-col justify-center gap-1.5 sm:gap-2.5">
          ${buildSlotHTML(getPos(1))}
          ${buildSlotHTML(getPos(9))}
          ${buildSlotHTML(getPos(2))}
        </div>
        <div class="flex flex-col justify-center gap-1.5 sm:gap-2.5">
          ${buildSlotHTML(getPos(4))}
          ${buildSlotHTML(getPos(6))}
        </div>
        <div class="flex flex-col justify-center">
          ${buildSlotHTML(getPos(8))}
        </div>
        <div class="flex flex-col justify-end">
          ${buildSlotHTML(getPos(10))}
        </div>
      </div>
    `;
  } else if (activeSpread.layoutType === 'cross') {
    innerBoardHTML = `
      <div class="grid grid-cols-3 gap-x-1.5 sm:gap-x-3 gap-y-2 sm:gap-y-3.5 items-stretch justify-items-stretch w-[320px] sm:w-[540px] mx-auto">
        <div></div>${buildSlotHTML(getPos(2))}<div></div>
        ${buildSlotHTML(getPos(4))}${buildSlotHTML(getPos(1))}${buildSlotHTML(getPos(3))}
        <div></div>${buildSlotHTML(getPos(5))}<div></div>
      </div>
    `;
  } else {
    innerBoardHTML = `
      <div class="space-y-2.5 sm:space-y-3.5 w-[320px] sm:w-[540px] mx-auto">
        <div class="grid grid-cols-3 gap-x-1.5 sm:gap-x-3 gap-y-2 items-stretch justify-items-stretch">
          ${buildSlotHTML(getPos(1))}${buildSlotHTML(getPos(2))}${buildSlotHTML(getPos(3))}
        </div>
        <div class="border-t border-dashed border-[#8A5414]/45"></div>
        <div class="grid grid-cols-3 gap-x-1.5 sm:gap-x-3 gap-y-2 items-stretch justify-items-stretch">
          ${buildSlotHTML(getPos(4))}${buildSlotHTML(getPos(5))}${buildSlotHTML(getPos(6))}
        </div>
      </div>
    `;
  }

  const prevVp = document.getElementById('board-canvas-viewport');
  const prevLeft = prevVp ? prevVp.scrollLeft : 0;
  const prevTop = prevVp ? prevVp.scrollTop : 0;

  wrapper.innerHTML = `
    <div id="board-canvas-viewport" class="w-full overflow-auto rounded-lg border border-[#8A5414]/25 bg-[#FBF1D4]/20 p-2 sm:p-3">
      <div id="board-canvas-sizer" class="relative mx-auto">
        <div id="board-canvas-stage" class="inline-block">
          ${innerBoardHTML}
        </div>
      </div>
    </div>
  `;

  bindBoardCanvasInteractions();
  requestAnimationFrame(() => {
    applySpreadCanvasZoom();
    const vp = document.getElementById('board-canvas-viewport');
    if (vp && (prevLeft || prevTop)) {
      vp.scrollLeft = prevLeft;
      vp.scrollTop = prevTop;
    }
    updateQuestNavArrow();
  });
}

function handlePlacedCardClick(posIndex) {
  if (!activeSpread) return;
  const isEn = getCurrentLang() === 'en';
  if (placedSlots.length < activeSpread.card_count) {
    const remain = activeSpread.card_count - placedSlots.length;
    const guideText = document.getElementById('board-ritual-guide-text');
    const boardHint = document.getElementById('board-stage-hint');
    const msg = isEn
      ? `✦ Please choose all ${activeSpread.card_count} cards first before revealing (${remain} left)`
      : `✦ เลือกไพ่ให้ครบทั้ง ${activeSpread.card_count} ใบก่อน แล้วค่อยเปิดรับสารจากหน้าไพ่ (ยังขาดอีก ${remain} ใบ)`;
    if (guideText) guideText.innerHTML = `<strong class="text-[#4F2031]">${msg}</strong>`;
    if (boardHint) boardHint.textContent = isEn ? `Draw all cards first (${remain} left)` : `เลือกไพ่ให้ครบก่อนเปิด (ขาดอีก ${remain} ใบ)`;
    return;
  }
  const placed = placedSlots.find((s) => s.posIndex === posIndex);
  if (!placed) return;

  preloadCardImage(placed.card);

  if (!placed.isRevealed) {
    const unrevealedSorted = placedSlots
      .filter((s) => !s.isRevealed)
      .sort((a, b) => a.posIndex - b.posIndex);
    const nextUnrevealed = unrevealedSorted[0];
    if (!nextUnrevealed || nextUnrevealed.posIndex !== posIndex) {
      const boardHint = document.getElementById('board-stage-hint');
      if (boardHint && nextUnrevealed) {
        boardHint.textContent = isEn
          ? `Please reveal cards in order (start with card #${nextUnrevealed.posIndex})`
          : `ลองเปิดไพ่ทีละใบตามลำดับ (เริ่มที่ใบที่ ${nextUnrevealed.posIndex} ก่อน)`;
      }
      return;
    }
    placed.isRevealed = true;
    trackEvent('card_reveal', {
      spreadId: activeSpread.spread_id,
      cardId: placed.card.id,
      cardName: placed.card.name,
      posIndex
    });
    focusedBoardIdx = posIndex;
    playCardFlipSound();
    renderSpreadBoard();
    updateTableProgress();
    setTimeout(() => {
      if (activeSpread.card_count === 1) {
        openFullReadingModal();
      } else {
        openSingleCardModal(posIndex);
      }
    }, 650);
  } else if (activeSpread.card_count === 1) {
    openFullReadingModal();
  } else {
    openSingleCardModal(posIndex);
  }
}

function revealAllAndOpenSummary() {
  if (!activeSpread) return;
  placedSlots.forEach((slot) => {
    slot.isRevealed = true;
    preloadCardImage(slot.card);
  });
  playCardFlipSound();
  renderSpreadBoard();
  updateTableProgress();
  openFullReadingModal();
}

function openNextUnrevealedCard(posIndex) {
  const placed = placedSlots.find((s) => s.posIndex === posIndex);
  if (!placed) return;
  if (placed.isRevealed) {
    focusedBoardIdx = posIndex;
    openSingleCardModal(posIndex);
    return;
  }
  const unrevealedSorted = placedSlots
    .filter((s) => !s.isRevealed)
    .sort((a, b) => a.posIndex - b.posIndex);
  const nextUnrevealed = unrevealedSorted[0];
  if (!nextUnrevealed || nextUnrevealed.posIndex !== posIndex) return;
  preloadCardImage(placed.card);
  placed.isRevealed = true;
  focusedBoardIdx = posIndex;
  playCardFlipSound();
  renderSpreadBoard();
  updateTableProgress();
  openSingleCardModal(posIndex);
}

/**
 * =========================================================================
 * 4. AI ORACLE SECTION IN READING MODAL
 * =========================================================================
 */
function buildAiOraclePanelHTML() {
  return `
    <div id="ai-oracle-section" class="space-y-3 text-left">
      <div id="ai-oracle-output" class="hidden"></div>
    </div>
  `;
}

async function triggerAiInterpretation() {
  if (!activeSpread || placedSlots.length < activeSpread.card_count) return;

  const outputEl = document.getElementById('ai-oracle-output');
  if (!outputEl) return;

  const isEn = getCurrentLang() === 'en';
  outputEl.classList.remove('hidden');
  outputEl.innerHTML = `
    <div class="ai-loading-pulse py-4 text-center space-y-1.5">
      <p class="font-fahkwang text-xs sm:text-sm text-[#4F2031]">${escapeHtml(t('loadingSummaryTitle'))}</p>
      <p class="font-pridi text-[11px] text-[#523020]">${escapeHtml(t('loadingSummarySub'))}</p>
    </div>
  `;

  const result = await requestAiInterpretation({
    spread: activeSpread,
    question: userSecretQuestion,
    drawnCards: placedSlots
  });

  if (result.mode === 'quota' || result.mode === 'fallback') {
    const isEnNotice = getCurrentLang() === 'en';
    outputEl.innerHTML = `
      <div class="bg-[#FCF4DC] border border-[#8F5B6E]/60 rounded-lg p-3.5 space-y-1">
        <p class="font-fahkwang text-xs text-[#4F2031]">${isEnNotice ? '☽ Note from the Grimoire' : '☽ คำแนะนำจากคัมภีร์'}</p>
        <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(result.message)}</p>
      </div>
    `;
    return;
  }

  const rawAdviceText = Array.isArray(result.advice)
    ? result.advice
        .map((line) => String(line || '').replace(/^ไพ่เหล่านี้ต้องการเตือนคุณว่า\s*/, '').trim())
        .filter(Boolean)
        .join(' ')
    : String(result.advice || '').replace(/^ไพ่เหล่านี้ต้องการเตือนคุณว่า\s*/, '').trim();
  const cleanAdviceText = rawAdviceText.replace(/,/g, '');

  const isSingleDaily = activeSpread && activeSpread.spread_id === 'daily_single';
  const hasUserQuestion = Boolean(userSecretQuestion && userSecretQuestion.trim());
  const cleanOverviewText = String(result.overview || '').replace(/,/g, '').trim();
  const firstConnectionInsight =
    Array.isArray(result.connections) && result.connections[0]
      ? String(result.connections[0].insight || '').replace(/,/g, '').trim()
      : '';
  const shouldShowQuestionOverview =
    hasUserQuestion &&
    Boolean(cleanOverviewText) &&
    Array.isArray(result.connections) &&
    result.connections.length > 0 &&
    (!isSingleDaily || cleanOverviewText !== firstConnectionInsight);

  const noticeHtml = result.notice
    ? `<div class="bg-[#FFF4D6]/90 border border-[#B47B1E]/55 rounded-lg px-3.5 py-2 text-[11px] sm:text-xs font-pridi text-[#6D3B16] leading-relaxed">✦ ${escapeHtml(String(result.notice).replace(/,/g, '').trim())}</div>`
    : '';

  const questionOverviewHtml = shouldShowQuestionOverview
    ? `
      <div class="bg-[#F8E7B9]/85 border border-[#8A5414]/60 rounded-lg p-3.5 sm:p-4 space-y-1.5 text-left">
        <div class="font-fahkwang text-xs sm:text-sm text-[#4F2031]">${escapeHtml(t('summaryOverviewHeader'))}</div>
        <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(cleanOverviewText)}</p>
      </div>
    `
    : '';

  const overviewBlocks =
    Array.isArray(result.connections) && result.connections.length > 0
      ? result.connections
          .map((item, idx) => {
            const stepNum = item.positionIndex || idx + 1;
            const posMeta = activeSpread.positions.find((p) => Number(p.index) === Number(stepNum));
            const titleOnly = (posMeta ? getPosTitle(activeSpread.spread_id, posMeta) : item.positionTitle) || '';
            const headerLabel = isSingleDaily
              ? `✦ ${titleOnly || (isEn ? 'Message for Today' : 'สารหลักประจำวัน')}`
              : isEn
                ? `✦ Card ${stepNum}${titleOnly ? ` · ${titleOnly}` : ''}`
                : `✦ ใบที่ ${stepNum}${titleOnly ? ` · ${titleOnly}` : ''}`;
            const insightText = isEn
              ? String(item.insight || '').trim()
              : String(item.insight || '').replace(/,/g, '').trim();
            const matchedSlot = placedSlots.find((s) => Number(s.posIndex) === Number(stepNum));
            const cardThumbHtml =
              matchedSlot && matchedSlot.card && !isSingleDaily
                ? `<div class="w-16 sm:w-[76px] shrink-0" data-card-front-slot="${matchedSlot.card.id}">${buildMinimalCardFrontHTML(matchedSlot.card)}</div>`
                : '';
            const cardHeaderHtml = isSingleDaily
              ? `<div class="font-fahkwang text-[11px] sm:text-xs text-[#4F2031]">✦ ${escapeHtml(titleOnly || (isEn ? 'Message for Today' : 'สารหลักประจำวัน'))}</div>`
              : matchedSlot && matchedSlot.card
                ? `<div class="space-y-0.5 leading-snug">
                     <div class="flex flex-wrap items-baseline gap-x-1.5 text-[11px] sm:text-xs">
                       <span class="font-fahkwang text-[#8A5414]">${isEn ? `✦ No. ${stepNum}` : `✦ ลำดับที่ ${stepNum}`}</span>
                       <span class="font-cinzel font-bold text-[#2A160E]">${escapeHtml(matchedSlot.card.name)}</span>
                       ${!isEn ? `<span class="font-charm text-xs sm:text-sm text-[#4F2031]">(${escapeHtml(matchedSlot.card.thaiName)})</span>` : ''}
                     </div>
                     ${titleOnly ? `<div class="font-fahkwang text-[11px] sm:text-xs text-[#4F2031]">${escapeHtml(titleOnly)}</div>` : ''}
                   </div>`
                : `<div class="font-fahkwang text-[11px] sm:text-xs text-[#4F2031]">${escapeHtml(headerLabel)}</div>`;
            return `
              <div class="bg-[#FCF4DC]/80 border border-[#8A5414]/45 rounded-lg p-3 sm:p-3.5">
                <div class="flex items-center gap-3 sm:gap-3.5">
                  ${cardThumbHtml}
                  <div class="flex-1 min-w-0 space-y-1 text-left">
                    ${cardHeaderHtml}
                    <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(insightText)}</p>
                  </div>
                </div>
              </div>
            `;
          })
          .join('')
      : `<div class="bg-[#FCF4DC]/80 border border-[#8A5414]/45 rounded-lg px-3.5 py-2.5"><p class="font-pridi text-sm text-[#2A160E] leading-relaxed">${escapeHtml(cleanOverviewText)}</p></div>`;

  outputEl.innerHTML = `
    <div class="space-y-3">
      ${noticeHtml}
      ${questionOverviewHtml}
      <div class="space-y-2.5">
        ${overviewBlocks}
      </div>

      ${
        cleanAdviceText
          ? `
        <div class="bg-[#8F5B6E]/12 border-l-4 border-[#4F2031] rounded-r-md px-3.5 py-2.5 space-y-1">
          <h5 class="font-fahkwang text-xs text-[#4F2031]">${escapeHtml(t('summaryWarningHeader'))}</h5>
          <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(isEn ? rawAdviceText : cleanAdviceText)}</p>
        </div>
      `
          : ''
      }

      ${
        result.closing
          ? `
        <p id="reading-closing-quote" class="font-charm text-[13px] sm:text-[14px] text-[#4F2031] text-center pt-0.5 leading-relaxed">
          “${escapeHtml(result.closing)}”
        </p>
      `
          : ''
      }
    </div>
  `;
}

function openSingleCardModal(posIndex) {
  const placed = placedSlots.find((s) => s.posIndex === posIndex);
  const posMeta = activeSpread.positions.find((p) => p.index === posIndex);
  if (!placed || !posMeta) return;

  const isEn = getCurrentLang() === 'en';
  const card = placed.card;
  const posTitle = getPosTitle(activeSpread.spread_id, posMeta);
  const posMeaning = getPosMeaning(activeSpread.spread_id, posMeta);
  const body = document.getElementById('modal-reading-body');
  body.innerHTML = `
    <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 pt-1">
      <div class="flex flex-col items-center shrink-0 mx-auto sm:mx-0 space-y-2">
        <div class="w-44 sm:w-52 md:w-56 h-auto hero-float-2" data-card-front-slot="${card.id}">
          ${buildMinimalCardFrontHTML(card)}
        </div>
        <div class="text-center space-y-0.5">
          <span class="font-cinzel text-sm sm:text-base font-bold text-[#2A160E] tracking-wider block">${card.name}</span>
          ${!isEn ? `<h3 class="font-charm text-lg sm:text-xl text-[#4F2031]">${card.thaiName}</h3>` : ''}
        </div>
      </div>

      <div class="flex-1 space-y-3.5 text-left w-full">
        <div id="single-card-ai-box" class="ai-oracle-panel rounded-lg p-3.5 sm:p-4 space-y-2 text-left">
          <div class="border-b border-[#8A5414]/25 pb-2 space-y-0.5">
            <span class="font-fahkwang text-xs sm:text-sm text-[#4F2031] block">${isEn ? `✦ No. ${posMeta.index} · ${posTitle}` : `✦ ลำดับที่ ${posMeta.index} · ${posTitle}`}</span>
            <p class="font-pridi text-[11px] sm:text-xs text-[#523020]">${posMeaning}</p>
          </div>
          <p class="ai-loading-pulse font-pridi text-xs text-[#523020]">
            ${isEn ? '☽ Preparing your message for this position...' : '☽ กำลังจัดเตรียมคำทำนายเฉพาะตำแหน่งนี้...'}
          </p>
        </div>

        ${
          !isEn
            ? `
        <div class="bg-[#8F5B6E]/15 border-l-4 border-[#4F2031] rounded-r-md px-4 py-3">
          <h4 class="font-fahkwang text-xs text-[#4F2031]">${escapeHtml(t('singleCardWarningHeader'))}</h4>
          <p class="font-pridi text-xs sm:text-sm text-[#2A160E] mt-1 leading-relaxed">${card.warning}</p>
        </div>`
            : ''
        }
      </div>
    </div>
  `;

  const footerBar = document.getElementById('reading-modal-footer-bar');
  const singleFooterActions = document.getElementById('reading-modal-footer-actions');
  if (singleFooterActions && footerBar) {
    const isMulti = activeSpread && activeSpread.card_count > 1 && placedSlots.length >= activeSpread.card_count;
    const unrevealed = placedSlots
      .filter((s) => !s.isRevealed)
      .sort((a, b) => a.posIndex - b.posIndex);

    if (isMulti) {
      const curPos = Number(posIndex);
      const hasPrev = curPos > 1;
      const hasNext = curPos < activeSpread.card_count;
      const isEnModal = getCurrentLang() === 'en';
      const prevBtnHtml = hasPrev
        ? `<button onclick="openSingleCardModal(${curPos - 1})" class="btn-vintage-secondary px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-fahkwang whitespace-nowrap">${escapeHtml(t('btnPrevCard'))}</button>`
        : `<button type="button" disabled aria-disabled="true" class="bg-[#D6D3CD] text-[#7A756D] border border-[#B8B3AA] cursor-not-allowed opacity-85 px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-fahkwang whitespace-nowrap">${escapeHtml(t('btnPrevCard'))}</button>`;
      const nextBtnHtml = hasNext
        ? `<button onclick="openNextUnrevealedCard(${curPos + 1})" class="btn-vintage-primary px-3.5 py-1.5 rounded-md text-[11px] sm:text-xs font-fahkwang whitespace-nowrap">${isEnModal ? `Next (${curPos + 1}) →` : `ใบถัดไป (${curPos + 1}) →`}</button>`
        : `<button onclick="openFullReadingModal()" class="btn-vintage-plum px-3.5 py-1.5 rounded-md text-[11px] sm:text-xs font-fahkwang whitespace-nowrap">✦ ${escapeHtml(t('btnViewSummarySmall'))}</button>`;
      const summarySubBtn =
        unrevealed.length > 0
          ? `<button onclick="revealAllAndOpenSummary()" class="bg-white hover:bg-[#F9F2F5] text-[#4F2031] border border-[#4F2031] px-2.5 py-1 rounded text-[11px] font-fahkwang leading-tight transition-colors">${escapeHtml(t('btnViewSummarySmall'))}</button>`
          : hasNext
            ? `<button onclick="openFullReadingModal()" class="bg-white hover:bg-[#F9F2F5] text-[#4F2031] border border-[#4F2031] px-2.5 py-1 rounded text-[11px] font-fahkwang leading-tight transition-colors">${escapeHtml(t('btnViewSummarySmall'))}</button>`
            : '';

      footerBar.classList.remove('hidden');
      singleFooterActions.innerHTML = `
        <div class="w-full flex items-start justify-between gap-2">
          <div class="shrink-0">${prevBtnHtml}</div>
          <div class="flex flex-col items-end gap-1.5">
            ${nextBtnHtml}
            ${summarySubBtn}
          </div>
        </div>
      `;
    } else {
      footerBar.classList.add('hidden');
      singleFooterActions.innerHTML = '';
    }
  }

  const modal = document.getElementById('reading-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('reading-modal-open');
  syncReadingModalOffset(modal);
  const scrollBox = modal.querySelector('.editorial-scroll');
  if (scrollBox) scrollBox.scrollTop = 0;
  playSoftPaperRustle();

  loadSingleCardAiInsight(posIndex);
}

async function loadSingleCardAiInsight(posIndex) {
  if (!activeSpread || placedSlots.length < activeSpread.card_count) return;
  const box = document.getElementById('single-card-ai-box');
  if (!box) return;

  // รายใบใช้ระบบจับคู่ตำแหน่ง + คำถามจากคัมภีร์ในเครื่องทันที (ไม่เปลืองโควต้า AI — เก็บ AI ไว้ใช้ครั้งเดียวตอนหน้าบทสรุป)
  const result = buildLocalGuidebookSynthesis(activeSpread, userSecretQuestion, placedSlots);

  const conn = Array.isArray(result.connections)
    ? result.connections.find((c) => Number(c.positionIndex) === Number(posIndex)) || result.connections[posIndex - 1]
    : null;

  const insightText = conn && (conn.detailInsight || conn.insight)
    ? conn.detailInsight || conn.insight
    : result.overview;

  const isEnPos = getCurrentLang() === 'en';
  const posMeta = activeSpread.positions.find((p) => Number(p.index) === Number(posIndex));
  const posTitle = posMeta ? getPosTitle(activeSpread.spread_id, posMeta) : '';
  const posMeaning = posMeta ? getPosMeaning(activeSpread.spread_id, posMeta) : '';
  const headerTitle = posMeta
    ? isEnPos
      ? `✦ No. ${posMeta.index} · ${posTitle}`
      : `✦ ลำดับที่ ${posMeta.index} · ${posTitle}`
    : isEnPos
      ? `✦ No. ${posIndex}`
      : `✦ ลำดับที่ ${posIndex}`;
  const headerSub = posMeaning ? `<p class="font-pridi text-[11px] sm:text-xs text-[#523020]">${escapeHtml(posMeaning)}</p>` : '';

  box.innerHTML = `
    <div class="border-b border-[#8A5414]/25 pb-2 space-y-0.5">
      <span class="font-fahkwang text-xs sm:text-sm text-[#4F2031] block">${escapeHtml(headerTitle)}</span>
      ${headerSub}
    </div>
    <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(insightText || '')}</p>
  `;
}

function openFullReadingModal() {
  if (!activeSpread || placedSlots.length < activeSpread.card_count) return;

  const sortedSlots = [...placedSlots].sort((a, b) => a.posIndex - b.posIndex);
  const body = document.getElementById('modal-reading-body');
  const isDaily = activeSpread.spread_id === 'daily_single';

  if (isDaily) {
    const card = sortedSlots[0].card;
    const isEnDaily = getCurrentLang() === 'en';
    body.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 pt-1">
          <div class="flex flex-col items-center shrink-0 mx-auto sm:mx-0 space-y-2">
            <div class="w-36 sm:w-44 h-auto" data-card-front-slot="${card.id}">
              ${buildMinimalCardFrontHTML(card)}
            </div>
            <div class="text-center space-y-0.5">
              <span class="font-cinzel text-sm sm:text-base font-bold text-[#2A160E] tracking-wider block">${card.name}</span>
              ${!isEnDaily ? `<h3 class="font-charm text-lg sm:text-xl text-[#4F2031]">${card.thaiName}</h3>` : ''}
            </div>
          </div>

          <div class="flex-1 space-y-3 text-left w-full">
            ${buildAiOraclePanelHTML()}
          </div>
        </div>
      </div>
    `;
  } else {
    const isEnSummary = getCurrentLang() === 'en';
    body.innerHTML = `
      <div class="space-y-4">
        <div class="text-center space-y-1 border-b border-[#8A5414]/45 pb-3">
          <span class="font-cinzel text-xs tracking-[0.18em] uppercase text-[#4F2031]">${activeSpread.engTitle}</span>
          <h3 class="font-charm text-2xl sm:text-3xl text-[#2A160E] leading-snug">
            <span class="block">${escapeHtml(t('summaryHeader'))}</span>
            <span class="block text-xl sm:text-2xl text-[#4F2031]">${escapeHtml(getSpreadName(activeSpread))}</span>
          </h3>
        </div>

        ${buildAiOraclePanelHTML()}
      </div>
    `;
  }

  const isEnFooter = getCurrentLang() === 'en';
  const fullFooterBar = document.getElementById('reading-modal-footer-bar');
  const fullFooterActions = document.getElementById('reading-modal-footer-actions');
  if (fullFooterBar && fullFooterActions) {
    fullFooterBar.classList.remove('hidden');
    fullFooterActions.innerHTML = `
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button onclick="resetToHome()" class="bg-white hover:bg-[#F9F2F5] text-[#4F2031] border border-[#4F2031] px-3.5 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang leading-tight transition-colors">
          ${escapeHtml(t('btnOtherSpreads'))}
        </button>
        <button onclick="closeReadingModal()" class="btn-vintage-primary px-5 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang">
          ${isEnFooter ? 'Back to Board' : 'กลับไปแท่นไพ่'}
        </button>
      </div>
    `;
  }

  const modal = document.getElementById('reading-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('reading-modal-open');
  syncReadingModalOffset(modal);
  const scrollBox = modal.querySelector('.editorial-scroll');
  if (scrollBox) scrollBox.scrollTop = 0;
  playSoftPaperRustle();

  // ตีความด้วย AI อัตโนมัติทันทีที่เปิดหน้าสรุป (ใช้ผลแคช ไม่ยิงซ้ำ)
  trackEvent('summary_view', { spreadId: activeSpread.spread_id, spreadName: activeSpread.name });
  triggerAiInterpretation();
}

let isModalScrollControlsVisible = false;
let modalScrollAutoHideTimer = null;

function scheduleModalScrollControlsHide() {
  if (modalScrollAutoHideTimer) {
    clearTimeout(modalScrollAutoHideTimer);
  }
  modalScrollAutoHideTimer = setTimeout(() => {
    isModalScrollControlsVisible = false;
    updateModalScrollButtons();
  }, 3000);
}

function showModalScrollControlsTemporarily() {
  isModalScrollControlsVisible = true;
  updateModalScrollButtons();
  scheduleModalScrollControlsHide();
}

function syncReadingModalOffset(modal) {
  if (!modal) return;
  if (modalScrollAutoHideTimer) {
    clearTimeout(modalScrollAutoHideTimer);
    modalScrollAutoHideTimer = null;
  }
  isModalScrollControlsVisible = false;
  const controlsWrap = document.getElementById('modal-scroll-controls');
  if (controlsWrap) {
    controlsWrap.classList.remove('opacity-100');
    controlsWrap.classList.add('opacity-0');
  }
  const headerEl = document.getElementById('main-header');
  const headerBottom = headerEl ? Math.ceil(headerEl.getBoundingClientRect().bottom) : 64;
  const isMobile = window.innerWidth < 640;
  modal.classList.toggle('items-start', isMobile);
  modal.classList.toggle('items-center', !isMobile);
  modal.style.paddingTop = `${headerBottom + (isMobile ? 10 : 6)}px`;
  const scrollBox = modal.querySelector('.editorial-scroll');
  if (scrollBox) {
    scrollBox.style.maxHeight = `calc(100dvh - ${headerBottom + (isMobile ? 22 : 18)}px)`;
    if (!scrollBox.dataset.boundScrollNav) {
      scrollBox.dataset.boundScrollNav = '1';
      scrollBox.addEventListener('scroll', () => {
        if (isModalScrollControlsVisible) {
          updateModalScrollButtons();
          scheduleModalScrollControlsHide();
        }
      }, { passive: true });
      scrollBox.addEventListener('click', (event) => {
        if (event.target.closest('button, a, input, textarea, select')) return;
        showModalScrollControlsTemporarily();
      });
    }
    requestAnimationFrame(updateModalScrollButtons);
  }
}

function updateModalScrollButtons() {
  const modal = document.getElementById('reading-modal');
  const scrollBox = modal ? modal.querySelector('.editorial-scroll') : null;
  const controlsWrap = document.getElementById('modal-scroll-controls');
  const upBtn = document.getElementById('modal-scroll-up-btn');
  const downBtn = document.getElementById('modal-scroll-down-btn');
  if (!scrollBox || !upBtn || !downBtn) return;

  const canScroll = scrollBox.scrollHeight > scrollBox.clientHeight + 10;
  if (!canScroll) {
    if (controlsWrap) {
      controlsWrap.classList.add('hidden', 'opacity-0');
      controlsWrap.classList.remove('opacity-100');
    }
    upBtn.classList.add('hidden');
    downBtn.classList.add('hidden');
    return;
  }

  if (controlsWrap) controlsWrap.classList.remove('hidden');

  if (!isModalScrollControlsVisible) {
    if (controlsWrap) {
      controlsWrap.classList.remove('opacity-100');
      controlsWrap.classList.add('opacity-0');
    }
    upBtn.classList.remove('pointer-events-auto');
    downBtn.classList.remove('pointer-events-auto');
    upBtn.classList.add('pointer-events-none');
    downBtn.classList.add('pointer-events-none');
    return;
  }

  if (controlsWrap) {
    controlsWrap.classList.remove('opacity-0');
    controlsWrap.classList.add('opacity-100');
  }
  const atTop = scrollBox.scrollTop <= 8;
  const atBottom = scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 8;
  upBtn.classList.toggle('hidden', atTop);
  downBtn.classList.toggle('hidden', atBottom);
  upBtn.classList.toggle('pointer-events-auto', !atTop);
  upBtn.classList.toggle('pointer-events-none', atTop);
  downBtn.classList.toggle('pointer-events-auto', !atBottom);
  downBtn.classList.toggle('pointer-events-none', atBottom);
}

function scrollReadingModal(direction) {
  const modal = document.getElementById('reading-modal');
  const scrollBox = modal ? modal.querySelector('.editorial-scroll') : null;
  if (!scrollBox) return;
  scheduleModalScrollControlsHide();
  const step = Math.max(180, Math.round(scrollBox.clientHeight * 0.65));
  scrollBox.scrollBy({ top: direction * step, behavior: 'smooth' });
}

async function loadHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.html2canvas;
}

async function shareOrSaveSummary() {
  if (!activeSpread || !placedSlots.length) return;
  const isEn = getCurrentLang() === 'en';
  trackEvent('summary_share', { spreadId: activeSpread.spread_id, spreadName: activeSpread.name });
  const btn = document.getElementById('btn-share-summary');
  if (btn) btn.textContent = isEn ? '✦ Saving reading image...' : '✦ กำลังบันทึกภาพหน้าสรุป...';
  const sorted = [...placedSlots].sort((a, b) => a.posIndex - b.posIndex);
  const result = buildLocalGuidebookSynthesis(activeSpread, userSecretQuestion, placedSlots);

  const lines = [
    `THE CLOW — ${getSpreadName(activeSpread)}`,
    isEn
      ? `Cards drawn: ${sorted.map((s) => `${s.posIndex}. ${s.card.name}`).join(' · ')}`
      : `ไพ่ที่ได้: ${sorted.map((s) => `${s.posIndex}. ${s.card.name} (${s.card.thaiName})`).join(' · ')}`,
    ''
  ];
  if (Array.isArray(result.connections)) {
    result.connections.forEach((item, idx) => {
      const stepNum = item.positionIndex || idx + 1;
      const titleText = item.positionTitle ? ` · ${item.positionTitle}` : '';
      const insightText = isEn ? String(item.insight || '').trim() : String(item.insight || '').replace(/,/g, '').trim();
      lines.push(isEn ? `Card ${stepNum}${titleText}: ${insightText}` : `ใบที่ ${stepNum}${titleText}: ${insightText}`);
    });
  }
  const cleanWarn = Array.isArray(result.advice)
    ? result.advice.map((l) => (isEn ? String(l || '').trim() : String(l || '').replace(/,/g, '').trim())).filter(Boolean).join(' ')
    : isEn
      ? String(result.advice || '').trim()
      : String(result.advice || '').replace(/,/g, '').trim();
  if (cleanWarn) {
    lines.push('', isEn ? `Guiding message: ${cleanWarn}` : `ไพ่เหล่านี้ต้องการเตือนคุณว่า ${cleanWarn}`);
  }
  const shareText = lines.join('\n');

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    let blob = null;
    const modalCard = document.querySelector('#reading-modal > div');
    if (modalCard) {
      try {
        const html2canvas = await loadHtml2Canvas();
        const prevMaxH = modalCard.style.maxHeight;
        const prevOverflow = modalCard.style.overflow;
        const prevScrollTop = modalCard.scrollTop;
        const footerBar = document.getElementById('reading-modal-footer-bar');
        const closeBtn = modalCard.querySelector('button[onclick="closeReadingModal()"]');
        if (footerBar) footerBar.style.display = 'none';
        if (closeBtn) closeBtn.style.display = 'none';
        modalCard.scrollTop = 0;
        modalCard.style.maxHeight = 'none';
        modalCard.style.overflow = 'visible';

        const shot = await html2canvas(modalCard, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#FBF1D4'
        });

        modalCard.style.maxHeight = prevMaxH;
        modalCard.style.overflow = prevOverflow;
        modalCard.scrollTop = prevScrollTop;
        if (footerBar) footerBar.style.display = '';
        if (closeBtn) closeBtn.style.display = '';

        // วางภาพป็อปอัปจริงลงบนเฟรม IG Story (1080x1920)
        const story = document.createElement('canvas');
        story.width = 1080;
        story.height = 1920;
        const sctx = story.getContext('2d');
        sctx.fillStyle = '#EED69A';
        sctx.fillRect(0, 0, story.width, story.height);

        const maxW = story.width - 72;
        const maxH = story.height - 140;
        const ratio = Math.min(maxW / shot.width, maxH / shot.height);
        const drawW = Math.round(shot.width * ratio);
        const drawH = Math.round(shot.height * ratio);
        const drawX = Math.round((story.width - drawW) / 2);
        const drawY = Math.round((story.height - drawH) / 2);
        sctx.drawImage(shot, drawX, drawY, drawW, drawH);

        blob = await new Promise((resolve) => story.toBlob(resolve, 'image/png'));
      } catch (_) {}
    }

    if (!blob) {
      // Fallback: วาดบน Canvas หากโหลด html2canvas ไม่สำเร็จ
      const loadCardImg = (url) =>
        new Promise((resolve) => {
          if (!url) return resolve(null);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        });

      const cardImages = await Promise.all(sorted.map((s) => loadCardImg(getCardFrontUrl(s.card.driveKey))));
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FCF4DC';
      ctx.fillRect(0, 0, 1080, 1920);
      ctx.fillStyle = '#2A160E';
      ctx.font = 'bold 40px Charm, serif';
      ctx.textAlign = 'center';
      ctx.fillText(getSpreadName(activeSpread), 540, 120);
      cardImages.forEach((img, i) => {
        if (img) ctx.drawImage(img, 100 + (i % 3) * 300, 180 + Math.floor(i / 3) * 440, 200, 420);
      });
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    }
    const file = blob ? new File([blob], 'the-clow-summary.png', { type: 'image/png' }) : null;

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `THE CLOW — ${activeSpread.name}`,
        text: shareText,
        files: [file]
      });
    } else if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'the-clow-summary.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText).catch(() => {});
      }
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareText);
    }

    if (btn) {
      btn.textContent = isEn ? '✓ Saved & copied reading' : '✓ บันทึกและคัดลอกคำทำนายแล้ว';
      setTimeout(() => {
        if (btn) btn.textContent = t('btnShareSummary');
      }, 2600);
    }
  } catch (err) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareText).catch(() => {});
    }
    if (btn) {
      btn.textContent = isEn ? '✓ Copied reading' : '✓ คัดลอกคำทำนายแล้ว';
      setTimeout(() => {
        if (btn) btn.textContent = t('btnShareSummary');
      }, 2600);
    }
  }
}

function closeReadingModal() {
  const modal = document.getElementById('reading-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('reading-modal-open');
}

function handleBackdropClick(event) {
  if (event.target.id === 'reading-modal') {
    closeReadingModal();
  }
}

function initStickyCompactHeader() {
  const headerEl = document.getElementById('main-header');
  if (!headerEl) return;

  let isScrolled = false;
  const handleScroll = () => {
    const y = window.scrollY;
    if (!isScrolled && y > 90) {
      isScrolled = true;
      headerEl.classList.add('is-scrolled');
    } else if (isScrolled && y < 20) {
      isScrolled = false;
      headerEl.classList.remove('is-scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

// เปิดฟังก์ชันให้ปุ่ม onclick ใน HTML เรียกใช้งานได้
Object.assign(window, {
  resetToHome,
  selectSpread,
  resetCurrentSpreadSession,
  skipQuestionStep,
  submitQuestionStep,
  handleDeckStackInteraction,
  proceedFromShuffle,
  performDeckCut,
  handleDeckCardHover,
  pickCardFromDeck,
  drawRandomAvailableCard,
  drawAllRemainingCards,
  confirmArmedCardSelection,
  closeDrawNoticeModal,
  closeRitualFocusModal,
  dismissRitualFocusModal,
  handleRitualFocusBackdropClick,
  acceptAnalyticsConsent,
  scrollToNextQuestCard,
  adjustSpreadZoom,
  resetSpreadZoom,
  panSpreadCanvas,
  handlePlacedCardClick,
  shareOrSaveSummary,
  toggleLanguage,
  revealAllAndOpenSummary,
  openNextUnrevealedCard,
  openFullReadingModal,
  openBoardSummaryModal,
  openCompatibilitySummaryModal,
  skipCompatibilityAnimation,
  closeReadingModal,
  scrollReadingModal,
  handleBackdropClick,
  triggerAiInterpretation,
  toggleBgm,
  prevBgmTrack,
  nextBgmTrack
});

function toggleLanguage() {
  const nextLang = i18nToggleLanguage();
  initSpreadNavigation();
  if (activeSpread) {
    document.getElementById('table-spread-title').textContent = getSpreadName(activeSpread);
  const bannerIcon = document.getElementById('table-banner-icon');
  if (bannerIcon) {
    bannerIcon.innerHTML =
      activeSpread.spread_id === 'love_cross'
        ? '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 inline-block" fill="currentColor" aria-hidden="true"><path d="M12 21s-6.7-4.35-9.33-8.22C.9 10.17 1.7 6.3 5 4.8a5.2 5.2 0 0 1 6.1 1.35L12 7.2l.9-1.05A5.2 5.2 0 0 1 19 4.8c3.3 1.5 4.1 5.37 2.33 7.98C18.7 16.65 12 21 12 21Z"/></svg>'
        : '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 inline-block" fill="currentColor" aria-hidden="true"><path d="M12.3 3a9 9 0 1 0 8.7 11.4A7.5 7.5 0 0 1 12.3 3Z"/></svg>';
  }
    updateRitualPhaseBadges(ritualPhase);
    updateQuestionAiStatusNote();
    const qInput = document.getElementById('user-question-input');
    if (qInput) qInput.placeholder = getSpreadPlaceholder(activeSpread) || '';
    if (ritualPhase === 'question') {
      document.getElementById('deck-instruction-title').textContent = t('questionTitle');
      document.getElementById('deck-instruction-sub').textContent = t('questionSub');
    } else if (ritualPhase === 'shuffle') {
      document.getElementById('deck-instruction-title').textContent = t('shuffleTitle');
      document.getElementById('deck-instruction-sub').textContent = t('shuffleSub');
    } else if (ritualPhase === 'cut') {
      document.getElementById('deck-instruction-title').textContent = t('cutTitle');
      document.getElementById('deck-instruction-sub').textContent = t('cutSub');
    } else if (ritualPhase === 'draw') {
      document.getElementById('fan-hover-hint').textContent = t('drawHintDefault');
      renderSpreadBoard();
      updateTableProgress();
    }
    const modal = document.getElementById('reading-modal');
    if (modal && !modal.classList.contains('hidden')) {
      if (document.getElementById('ai-oracle-output')) {
        openFullReadingModal();
      } else if (focusedBoardIdx > 0) {
        openSingleCardModal(focusedBoardIdx);
      }
    }
  }
  const isEn = nextLang === 'en';
  updateBgmUI();
  const proceedBtn = document.getElementById('btn-proceed-next');
  if (proceedBtn && activeSpread) {
    proceedBtn.textContent = activeSpread.card_count > 1 ? t('btnProceedCut') : t('btnProceedDraw');
  }
  const shuffleBadge = document.getElementById('shuffle-counter-badge');
  if (shuffleBadge) {
    shuffleBadge.textContent = isEn
      ? `Shuffled ${shuffleCount} ${shuffleCount === 1 ? 'time' : 'times'}`
      : `สับไพ่ไปแล้ว ${shuffleCount} ครั้ง`;
  }
  updateQuestionCharCounter();
  const ritualModal = document.getElementById('ritual-focus-modal');
  if (ritualModal && !ritualModal.classList.contains('hidden') && activeSpread) {
    openRitualFocusModal(activeSpread);
  }
  return nextLang;
}

function acceptAnalyticsConsent() {
  grantAnalyticsConsent();
  const modal = document.getElementById('analytics-consent-modal');
  if (modal) {
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }, 500);
  }
  trackEvent('page_view');
}

function initAnalyticsConsentGate() {
  if (hasAnalyticsConsent()) {
    trackEvent('page_view');
    return;
  }
  const modal = document.getElementById('analytics-consent-modal');
  if (modal) {
    setTimeout(() => {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        const card = modal.querySelector('.vintage-frame');
        if (card) card.classList.remove('translate-y-2');
      });
    }, 400);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initStickyCompactHeader();
  initHeroCardShowcase();
  applyLanguage(getCurrentLang());
  initSpreadNavigation();
  initStaticAssets();
  initAutoBgm();
  preloadAllBgmTracks();
  initAnalyticsConsentGate();

  window.addEventListener('scroll', updateQuestNavArrow, { passive: true });
  window.addEventListener('resize', () => {
    updateQuestNavArrow();
    if (ritualPhase === 'draw' && activeSpread && placedSlots.length < activeSpread.card_count) {
      renderFannedDeckArc(false);
    }
  });
});
