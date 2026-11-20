/**
 * THE CLOW — แอปพลิเคชันหลัก (ย้ายจาก Google Apps Script สู่ Cloudflare Pages)
 * คงดีไซน์ แอนิเมชัน และพิธีกรรมเปิดไพ่ครบถ้วน + เพิ่มระบบ AI ตีความเชื่อมโยงกับปัญหาผู้ใช้
 */

import { SPREADS_DATA } from '../data/spreads.js';
import { CARDS_DATA } from '../data/cards.js';
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
} from './audio.js';
import { requestAiInterpretation, clearAiReadingCache, buildLocalGuidebookSynthesis } from './ai-oracle.js';
import { trackEvent } from './analytics.js';
import {
  applyLanguage,
  toggleLanguage as i18nToggleLanguage,
  getCurrentLang,
  t,
  getSpreadName,
  getSpreadPurpose,
  getSpreadPlaceholder,
  getPosTitle,
  getPosMeaning
} from './i18n.js';

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
  const activeCls = 'whitespace-nowrap px-1.5 sm:px-2.5 py-0.5 rounded bg-[#EBB844] text-[#2A160E] border border-[#4A1F12]';
  const inactiveCls = 'whitespace-nowrap px-1.5 sm:px-2.5 py-0.5 rounded bg-[#FCF4DC] text-[#523020] border border-[#8A5414]/45';
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
      <span class="${phase === 'shuffle' ? activeCls : inactiveCls}">ตั้งจิตสับไพ่</span>
      ${sep}
      <span class="${phase === 'draw' ? activeCls : inactiveCls}">เลือกไพ่</span>
    `;
  }
}

function resetCurrentSpreadSession() {
  if (!activeSpread) return;
  clearPendingDrawNotice();
  userSecretQuestion = '';
  clearAiReadingCache();
  const qInput = document.getElementById('user-question-input');
  if (qInput) qInput.value = '';

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
  if (qInput && activeSpread.questionPlaceholder) {
    qInput.placeholder = activeSpread.questionPlaceholder;
  }

  updateRitualPhaseBadges('question');
  setTableProgressText('');
  updateQuestionAiStatusNote();
  document.getElementById('deck-instruction-title').textContent = 'ตั้งจิตและบอกเล่าเรื่องราว (ข้ามได้)';
  document.getElementById('deck-instruction-sub').textContent =
    'การเรียบเรียงเรื่องราวหรือคำถามที่อยู่ในใจให้ชัดเจน จะช่วยให้คำทำนายเชื่อมโยงกับสิ่งที่คุณอยากรู้ได้ตรงจุดมากขึ้น';

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
      noteEl.innerHTML = `✦ ขณะนี้โควตา <strong>AI วิเคราะห์เรื่องราว</strong> เต็มชั่วคราว (ใช้งานได้อีกครั้งในอีกประมาณ <strong>${mins} นาที</strong>) — คุณยังสามารถเปิดไพ่และรับคำทำนายจาก <strong>ตำราโคลว์</strong> ได้ตามปกติค่ะ`;
      return;
    }
  } catch (_) {}
  noteEl.innerHTML = t('aiNoteDefault');
}

function skipQuestionStep() {
  userSecretQuestion = '';
  const qInput = document.getElementById('user-question-input');
  if (qInput) qInput.value = '';
  enterRitualShuffleStage();
}

function submitQuestionStep() {
  const qInput = document.getElementById('user-question-input');
  userSecretQuestion = qInput ? qInput.value.trim() : '';
  enterRitualShuffleStage();
}

function enterRitualShuffleStage() {
  if (!activeSpread) return;
  clearPendingDrawNotice();

  ritualPhase = 'shuffle';
  shuffleCount = 0;
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
  proceedBtn.textContent = needsCut
    ? '✦ พอใจแล้ว · ไปตัดกองไพ่'
    : '✦ พอใจแล้ว · ไปเลือกไพ่';
  proceedBtn.disabled = true;
  proceedBtn.classList.add('opacity-50', 'cursor-not-allowed');

  updateRitualPhaseBadges('shuffle');
  setTableProgressText('');
  document.getElementById('shuffle-counter-badge').textContent = 'สับไพ่ไปแล้ว 0 ครั้ง';
  document.getElementById('deck-instruction-title').textContent = 'ตั้งจิตและสับสำรับไพ่';
  document.getElementById('deck-instruction-sub').textContent =
    'การสับไพ่คือการรวบรวมสมาธิและฝากคำถามลงสู่สำรับ แตะที่กองไพ่ซ้ำๆ จนกว่าจะรู้สึกพร้อม';

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
    if (sub) sub.textContent = 'กรุณาแตะสับไพ่อย่างน้อย 1 ครั้งก่อนดำเนินการต่อ';
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
  document.getElementById('deck-instruction-title').textContent = 'ตัดแบ่งครึ่งกองไพ่';
  document.getElementById('deck-instruction-sub').textContent =
    'การตัดไพ่คือการปิดรับคำถามและรวมพลังสมาธิ แตะที่กองไพ่เพื่อแบ่งครึ่งสำรับและสลับวางซ้อนกันก่อนเปิดไพ่';

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
    'กำลังยกกองครึ่งบนวางทางขวา และนำกองครึ่งล่างซ้อนทับด้านบน...';

  const cutZone = document.getElementById('cut-deck-touchzone');
  cutZone.classList.remove('is-cutting');
  void cutZone.offsetWidth;
  cutZone.classList.add('is-cutting');

  playSoftPaperRustle();
  setTimeout(() => playSoftPaperRustle(), 480);

  setTimeout(() => {
    cutZone.classList.remove('is-cutting');
    isAnimatingRitual = false;
    enterFanDrawPhase();
  }, 1350);
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
  grid.innerHTML = SPREADS_DATA.map(
    (spread) => `
    <button onclick="selectSpread('${spread.spread_id}')"
            class="vintage-spread-card rounded-lg p-3.5 sm:p-5 text-left flex flex-col justify-between focus:outline-none group">
      <div class="space-y-1.5 sm:space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-cinzel text-[10px] tracking-[0.16em] text-[#4F2031]">✦ ${spread.engTitle}</span>
          <span class="px-2 py-0.5 rounded text-[11px] font-fahkwang bg-[#F8DF94] text-[#2A160E] border border-[#4A1F12]/70">${spread.card_count} ${isEn ? (spread.card_count === 1 ? 'Card' : 'Cards') : 'ใบ'}</span>
        </div>
        <h2 class="font-charm text-xl sm:text-2xl text-[#2A160E] group-hover:text-[#4F2031] transition-colors">${getSpreadName(spread)}</h2>
        <p class="font-pridi text-xs sm:text-sm text-[#523020] leading-relaxed">${getSpreadPurpose(spread)}</p>
      </div>
      <div class="mt-3 pt-2 sm:mt-3.5 sm:pt-2.5 border-t border-[#8A5414]/45 flex items-center justify-between text-xs font-fahkwang text-[#2A160E]">
        <span>${isEn ? 'Open Grimoire & Shuffle' : 'เปิดตำราและสับไพ่'}</span>
        <span class="text-[#4F2031] group-hover:translate-x-1 transition-transform">✦ →</span>
      </div>
    </button>
  `
  ).join('');
}

function resetToHome() {
  closeReadingModal();
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

  document.getElementById('shuffle-counter-badge').textContent = `สับไพ่ไปแล้ว ${shuffleCount} ครั้ง`;
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

  // แสดงป็อปอัปแจ้งเตือนทันทีเมื่อกรีดไพ่คว่ำใบสุดท้ายเสร็จ
  const totalDealDurationMs = Math.max(0, (shuffledDeck.length - 1) * 28 + 460);
  drawNoticeTimer = setTimeout(() => {
    drawNoticeTimer = null;
    if (ritualPhase === 'draw' && placedSlots.length < (activeSpread ? activeSpread.card_count : 0)) {
      openDrawNoticeModal();
    }
  }, totalDealDurationMs);
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
    hintEl.textContent = 'ใช้ความรู้สึกแวบแรก แตะเลือกใบที่สะดุดตาที่สุดจากสำรับ 52 ใบ';
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

        rowButtons.push(`
          <button id="deck-card-${idx}"
                  ${isUsed ? 'disabled' : ''}
                  onclick="pickCardFromDeck(${idx})"
                  onmouseenter="handleDeckCardHover()"
                  style="z-index: ${idx + 1}; ${marginStyle} ${dealDelayStyle}"
                  class="draw-row-card ${dealCls} relative shrink-0 ${cardSizeCls} clow-aspect focus:outline-none"
                  title="เลือกไพ่ใบนี้">
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
    hintEl.textContent = 'แตะไพ่ครั้งแรกเพื่อยกขึ้น แล้วแตะซ้ำอีกครั้งเพื่อยืนยันเลือก';
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
      hintEl.textContent = '✦ แตะไพ่ใบเดิมอีกครั้งเพื่อยืนยันการเลือก';
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
    hintEl.textContent = 'แตะไพ่ครั้งแรกเพื่อยกขึ้น แล้วแตะซ้ำอีกครั้งเพื่อยืนยันเลือก';
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
  const count = placedSlots.length;
  const total = activeSpread.card_count;
  const boardHint = document.getElementById('board-stage-hint');
  const guideText = document.getElementById('board-ritual-guide-text');
  const summaryCta = document.getElementById('board-summary-cta');
  const revealAllFooter = document.getElementById('board-reveal-all-footer');

  if (count < total) {
    setTableProgressText(`เลือกไพ่ ${count} / ${total} ใบ`);
    boardHint.textContent = `กำลังเลือกไพ่ใบที่ ${count + 1} จาก ${total} ใบ`;
    guideText.innerHTML =
      `ใช้ความรู้สึกแวบแรกเลือกไพ่ 1 ใบที่สะดุดตาที่สุด — <em>เลือกแล้วไม่สามารถเปลี่ยนใบได้</em>`;
    document.getElementById('deck-instruction-title').textContent = `เลือกไพ่ใบที่ ${count + 1} จาก ${total} ใบ`;
    document.getElementById('deck-instruction-sub').textContent = 'ใช้ความรู้สึกแวบแรก แตะเลือกไพ่คว่ำใบที่ถูกชะตาที่สุดโดยไม่ต้องลังเล';
    if (summaryCta) summaryCta.classList.add('hidden');
    if (revealAllFooter) revealAllFooter.classList.add('hidden');
  } else {
    setTableProgressText(`วางไพ่ครบ ${total} / ${total} ใบแล้ว`);
    document.getElementById('deck-instruction-title').textContent = 'อัญเชิญไพ่ครบตามผังแล้ว';
    document.getElementById('deck-instruction-sub').textContent = 'แตะเปิดไพ่บนแท่นตามลำดับหมายเลขในคู่มือ';

    const unrevealed = placedSlots.filter((s) => !s.isRevealed);
    if (unrevealed.length > 0) {
      const nextPos = unrevealed[0].posIndex;
      const posMeta = activeSpread.positions.find((p) => p.index === nextPos);
      boardHint.textContent = `ลำดับการเปิดตามคู่มือ: ${posMeta ? `${posMeta.index}. ${posMeta.title}` : ''}`;
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
      boardHint.textContent = 'เปิดเผยไพ่ครบทุกตำแหน่งแล้ว';
      guideText.innerHTML =
        `เปิดเผยไพ่ครบทุกใบแล้ว แตะที่ไพ่ใบใดก็ได้เพื่อทบทวน หรือกด <strong>"อ่านบทสรุปคำทำนาย"</strong> ด้านล่าง`;
      const fullBtn = document.getElementById('btn-full-reading');
      if (fullBtn) fullBtn.classList.remove('hidden');
      if (revealAllFooter) revealAllFooter.classList.add('hidden');
      if (summaryCta) {
        if (activeSpread.card_count > 1) summaryCta.classList.remove('hidden');
        else summaryCta.classList.add('hidden');
      }
    }
  }
  updateQuestNavArrow();
}

function updateQuestNavArrow() {
  const arrowBtn = document.getElementById('quest-nav-arrow');
  const arrowText = document.getElementById('quest-nav-arrow-text');
  if (!arrowBtn || !arrowText) return;

  const isAllPlaced = activeSpread && ritualPhase === 'draw' && placedSlots.length >= activeSpread.card_count;
  const unrevealed = isAllPlaced ? placedSlots.filter((s) => !s.isRevealed) : [];

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
  const nextPos = unrevealed[0].posIndex;
  const isAbove = rect.top < 72;
  const isBelow = rect.bottom > window.innerHeight - 16;

  if (isAbove) {
    arrowText.textContent = `↑ แตะเปิดไพ่ลำดับที่ ${nextPos}`;
    arrowBtn.classList.remove('hidden');
  } else if (isBelow) {
    arrowText.textContent = `↓ แตะเปิดไพ่ลำดับที่ ${nextPos}`;
    arrowBtn.classList.remove('hidden');
  } else {
    arrowBtn.classList.add('hidden');
  }
}

function scrollToNextQuestCard() {
  const nextTarget = document.querySelector('.next-in-sequence-ring');
  if (nextTarget) {
    nextTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function buildSlotHTML(pos) {
  const placed = placedSlots.find((s) => s.posIndex === pos.index);
  const isAllPlaced = placedSlots.length >= activeSpread.card_count;
  const firstUnrevealed = placedSlots.find((s) => !s.isRevealed);
  const isNextToFlip =
    isAllPlaced && placed && !placed.isRevealed && firstUnrevealed && firstUnrevealed.posIndex === pos.index;
  const isJustFocused = !isAllPlaced && placed && focusedBoardIdx === pos.index;

  const cardSizeCls = activeSpread.layoutType === 'single' ? 'w-full max-w-[210px]' : 'w-full max-w-[144px]';

  const slotHeader = `
    <div class="inline-flex flex-wrap items-center justify-center gap-1 px-1.5 sm:px-2 py-0.5 mb-1.5 rounded-lg bg-[#FCF4DC]/40 border border-[#8A5414]/20 opacity-70 w-full min-h-[36px] sm:min-h-[42px] text-center">
      <span class="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#8A5414]/15 text-[#523020]/75 font-cinzel text-[8px] sm:text-[9px] font-medium flex items-center justify-center shrink-0 leading-none">
        ${pos.index}
      </span>
      <span class="font-fahkwang text-[8.5px] sm:text-[11px] text-[#523020]/65 leading-tight break-words">
        ${pos.title}
      </span>
    </div>
  `;

  if (!placed) {
    const isCurrentTarget = placedSlots.length + 1 === pos.index;
    return `
      <div class="flex flex-col items-center justify-between w-full h-full min-w-0 p-1.5 sm:p-2.5 rounded-xl bg-[#FBF1D4]/30 border border-[#8A5414]/25">
        ${slotHeader}
        <div class="${cardSizeCls} clow-aspect rounded-[10px] border-2 border-dashed ${
          isCurrentTarget ? 'border-[#4A1F12] bg-[#F8DF94]/65 shadow-inner' : 'border-[#8A5414]/45 bg-[#FCF4DC]/65'
        } flex flex-col items-center justify-center p-1 sm:p-2 text-center transition-all">
          <span class="font-cinzel text-xs sm:text-sm font-bold text-[#4F2031]/80">${pos.index}</span>
          <span class="font-pridi text-[8.5px] sm:text-[10px] text-[#523020]/85 mt-1 leading-tight">
            ${isCurrentTarget ? 'รอวางไพ่' : 'ตำแหน่งว่าง'}
          </span>
        </div>
        <span class="mt-1.5 min-h-[24px] sm:min-h-[28px]"></span>
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

  return `
    <div class="flex flex-col items-center justify-between w-full h-full min-w-0 p-1.5 sm:p-2.5 rounded-xl bg-[#FBF1D4]/30 border border-[#8A5414]/25 card-enter">
      ${slotHeader}
      <button onclick="handlePlacedCardClick(${pos.index})"
              class="perspective-1200 ${cardSizeCls} clow-aspect focus:outline-none ${isAllPlaced ? 'cursor-pointer' : 'cursor-not-allowed'} group ${highlightCls}"
              title="${!isAllPlaced ? 'กรุณาเลือกไพ่ให้ครบทุกใบก่อนเปิดคำทำนาย' : placed.isRevealed ? `อ่านคำทำนาย ${placed.card.name}` : `แตะเพื่อพลิกเปิดไพ่ตามลำดับที่ ${pos.index}`}">
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
        ${placed.isRevealed ? placed.card.thaiName : !isAllPlaced ? 'รอเลือกให้ครบ' : isNextToFlip ? '✦ แตะเปิดลำดับ ' + pos.index : 'คว่ำหน้า'}
      </span>
    </div>
  `;
}

function renderSpreadBoard() {
  const wrapper = document.getElementById('board-slots-wrapper');
  if (!activeSpread || !wrapper) return;

  const getPos = (idx) => activeSpread.positions.find((p) => p.index === idx);

  if (activeSpread.layoutType === 'single') {
    wrapper.innerHTML = `<div class="flex justify-center items-center py-1 max-w-xs mx-auto">${buildSlotHTML(getPos(1))}</div>`;
  } else if (activeSpread.layoutType === 'cross') {
    wrapper.innerHTML = `
      <div class="grid grid-cols-3 gap-x-1.5 sm:gap-x-3 gap-y-2 sm:gap-y-3.5 items-stretch justify-items-stretch max-w-xl mx-auto">
        <div></div>${buildSlotHTML(getPos(2))}<div></div>
        ${buildSlotHTML(getPos(4))}${buildSlotHTML(getPos(1))}${buildSlotHTML(getPos(3))}
        <div></div>${buildSlotHTML(getPos(5))}<div></div>
      </div>
    `;
  } else {
    wrapper.innerHTML = `
      <div class="space-y-2.5 sm:space-y-3.5">
        <div class="grid grid-cols-3 gap-x-1.5 sm:gap-x-3 gap-y-2 items-stretch justify-items-stretch max-w-xl mx-auto">
          ${buildSlotHTML(getPos(1))}${buildSlotHTML(getPos(2))}${buildSlotHTML(getPos(3))}
        </div>
        <div class="border-t border-dashed border-[#8A5414]/45"></div>
        <div class="grid grid-cols-3 gap-x-1.5 sm:gap-x-3 gap-y-2 items-stretch justify-items-stretch max-w-xl mx-auto">
          ${buildSlotHTML(getPos(4))}${buildSlotHTML(getPos(5))}${buildSlotHTML(getPos(6))}
        </div>
      </div>
    `;
  }
}

function handlePlacedCardClick(posIndex) {
  if (!activeSpread) return;
  if (placedSlots.length < activeSpread.card_count) {
    const remain = activeSpread.card_count - placedSlots.length;
    const guideText = document.getElementById('board-ritual-guide-text');
    const boardHint = document.getElementById('board-stage-hint');
    const msg = `✦ กรุณาเลือกไพ่ให้ครบทั้ง ${activeSpread.card_count} ใบก่อน จึงจะเปิดอ่านคำทำนายได้ค่ะ (ยังขาดอีก ${remain} ใบ)`;
    if (guideText) guideText.innerHTML = `<strong class="text-[#4F2031]">${msg}</strong>`;
    if (boardHint) boardHint.textContent = `เลือกไพ่ให้ครบก่อนเปิด (ขาดอีก ${remain} ใบ)`;
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
        boardHint.textContent = `กรุณาเปิดไพ่ตามลำดับ (เปิดใบที่ ${nextUnrevealed.posIndex} ก่อน)`;
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
  const unrevealedSorted = placedSlots
    .filter((s) => !s.isRevealed)
    .sort((a, b) => a.posIndex - b.posIndex);
  const nextUnrevealed = unrevealedSorted[0];
  if (!nextUnrevealed || nextUnrevealed.posIndex !== posIndex) return;
  const placed = placedSlots.find((s) => s.posIndex === posIndex);
  if (!placed) return;
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
  const isDaily = activeSpread && activeSpread.spread_id === 'daily_single';

  return `
    <div id="ai-oracle-section" class="ai-oracle-panel rounded-xl p-4 sm:p-5 space-y-3 text-left">
      <div class="flex items-center gap-2 border-b border-[#4F2031]/20 pb-2">
        <span class="w-5 h-5 rounded-full bg-[#4F2031] text-[#F8DF94] text-[10px] flex items-center justify-center shrink-0">✦</span>
        <h4 class="font-fahkwang text-xs sm:text-sm text-[#4F2031] font-medium">
          ${isDaily ? 'คำทำนายและแนวทางประจำวัน' : 'บทสรุปคำทำนาย'}
        </h4>
      </div>
      <div id="ai-oracle-output" class="hidden pt-1"></div>
    </div>
  `;
}

async function triggerAiInterpretation() {
  if (!activeSpread || placedSlots.length < activeSpread.card_count) return;

  const outputEl = document.getElementById('ai-oracle-output');
  if (!outputEl) return;

  outputEl.classList.remove('hidden');
  outputEl.innerHTML = `
    <div class="ai-loading-pulse py-4 text-center space-y-1.5">
      <p class="font-fahkwang text-xs sm:text-sm text-[#4F2031]">☽ กำลังร้อยเรียงบทสรุปคำทำนาย...</p>
      <p class="font-pridi text-[11px] text-[#523020]">โปรดรอสักครู่</p>
    </div>
  `;

  const result = await requestAiInterpretation({
    spread: activeSpread,
    question: userSecretQuestion,
    drawnCards: placedSlots
  });

  if (result.mode === 'quota' || result.mode === 'fallback') {
    outputEl.innerHTML = `
      <div class="bg-[#FCF4DC] border border-[#8F5B6E]/60 rounded-lg p-3.5 space-y-1">
        <p class="font-fahkwang text-xs text-[#4F2031]">☽ คำแนะนำจากคัมภีร์</p>
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

  const overviewBlocks =
    Array.isArray(result.connections) && result.connections.length > 0
      ? result.connections
          .map((item, idx) => {
            const stepNum = item.positionIndex || idx + 1;
            const titleText = item.positionTitle ? ` · ${item.positionTitle}` : '';
            const insightText = String(item.insight || '').replace(/,/g, '').trim();
            return `
              <div class="bg-[#F4DC9C]/55 border border-[#8A5414]/40 rounded-lg px-3.5 py-2.5 space-y-1">
                <div class="font-fahkwang text-[11px] sm:text-xs text-[#4F2031]">ใบที่ ${stepNum}${escapeHtml(titleText)}</div>
                <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(insightText)}</p>
              </div>
            `;
          })
          .join('')
      : `<div class="bg-[#F4DC9C]/55 border border-[#8A5414]/40 rounded-lg px-3.5 py-2.5"><p class="font-pridi text-sm text-[#2A160E] leading-relaxed">${escapeHtml(String(result.overview || '').replace(/,/g, ''))}</p></div>`;

  outputEl.innerHTML = `
    <div class="space-y-3.5 pt-1">
      <div class="space-y-2">
        <h5 class="font-fahkwang text-xs uppercase tracking-wider text-[#4F2031]">✦ ภาพรวมคำทำนาย</h5>
        <div class="space-y-2">
          ${overviewBlocks}
        </div>
      </div>

      ${
        cleanAdviceText
          ? `
        <div class="bg-[#8F5B6E]/12 border-l-4 border-[#4F2031] rounded-r-md px-3.5 py-2.5 space-y-1">
          <h5 class="font-fahkwang text-xs text-[#4F2031]">☽ ไพ่เหล่านี้ต้องการเตือนคุณว่า</h5>
          <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(cleanAdviceText)}</p>
        </div>
      `
          : ''
      }

      ${
        result.closing
          ? `
        <p class="font-charm text-base sm:text-lg text-[#4F2031] text-center pt-1">
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

  const card = placed.card;
  const body = document.getElementById('modal-reading-body');
  body.innerHTML = `
    <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 pt-1">
      <!-- ชื่อไพ่และคำแปลด้านบนรูปไพ่สำหรับจอมือถือ -->
      <div class="sm:hidden text-center space-y-0.5 w-full">
        <span class="font-cinzel text-base font-bold text-[#2A160E] tracking-wider block">${card.name}</span>
        <h3 class="font-charm text-xl text-[#4F2031]">${card.thaiName}</h3>
      </div>

      <div class="w-48 sm:w-56 md:w-64 h-auto shrink-0 mx-auto sm:mx-0 hero-float-2" data-card-front-slot="${card.id}">
        ${buildMinimalCardFrontHTML(card)}
      </div>

      <div class="flex-1 space-y-3.5 text-left w-full">
        <div class="bg-[#F4DC9C]/80 border border-[#8A5414]/60 rounded-lg px-4 py-2.5">
          <span class="font-fahkwang text-xs text-[#4F2031]">ลำดับที่ ${posMeta.index} · ${posMeta.title}</span>
          <p class="font-pridi text-xs text-[#523020] mt-0.5">${posMeta.meaning}</p>
        </div>

        <div class="hidden sm:block">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-cinzel text-lg sm:text-xl text-[#2A160E]">${card.name}</span>
          </div>
          <h3 class="font-charm text-2xl sm:text-3xl text-[#4F2031] mt-0.5">${card.thaiName}</h3>
        </div>

        <div class="flex flex-wrap gap-1.5">
          ${card.keywords.map((kw) => `<span class="px-2.5 py-0.5 rounded text-xs font-fahkwang bg-[#FCF4DC] border border-[#8A5414]/55 text-[#2A160E]">✦ ${kw}</span>`).join('')}
        </div>

        <div id="single-card-ai-box" class="ai-oracle-panel rounded-lg p-3.5 space-y-2 text-left">
          <div class="flex items-center justify-between gap-2">
            <span class="font-fahkwang text-xs text-[#4F2031]">✦ คำทำนายเชื่อมโยงกับตำแหน่งและเรื่องของคุณ</span>
          </div>
          <p class="ai-loading-pulse font-pridi text-xs text-[#523020]">
            ☽ กำลังจัดเตรียมคำทำนายเฉพาะตำแหน่งนี้...
          </p>
        </div>

        <div class="bg-[#8F5B6E]/15 border-l-4 border-[#4F2031] rounded-r-md px-4 py-3">
          <h4 class="font-fahkwang text-xs text-[#4F2031]">☽ ไพ่ต้องการเตือนคุณว่า</h4>
          <p class="font-pridi text-xs sm:text-sm text-[#2A160E] mt-1 leading-relaxed">${card.warning}</p>
        </div>
      </div>
    </div>
  `;

  const footerBar = document.getElementById('reading-modal-footer-bar');
  const singleFooterActions = document.getElementById('reading-modal-footer-actions');
  if (singleFooterActions && footerBar) {
    const unrevealed = placedSlots
      .filter((s) => !s.isRevealed)
      .sort((a, b) => a.posIndex - b.posIndex);
    const allRevealedMulti =
      activeSpread &&
      activeSpread.card_count > 1 &&
      placedSlots.length >= activeSpread.card_count &&
      unrevealed.length === 0;

    if (unrevealed.length > 0 && activeSpread && activeSpread.card_count > 1) {
      const nextSlot = unrevealed[0];
      footerBar.classList.remove('hidden');
      singleFooterActions.innerHTML = `
        <div class="flex flex-col items-end gap-2">
          <button onclick="openNextUnrevealedCard(${nextSlot.posIndex})" class="btn-vintage-primary px-5 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang">
            เปิดไพ่ใบถัดไป (ลำดับที่ ${nextSlot.posIndex}) →
          </button>
          <button onclick="revealAllAndOpenSummary()" class="bg-white hover:bg-[#F9F2F5] text-[#4F2031] border border-[#4F2031] px-2.5 py-1 rounded text-[11px] font-fahkwang leading-tight transition-colors">
            ดูบทสรุปคำทำนาย
          </button>
        </div>
      `;
    } else if (allRevealedMulti) {
      footerBar.classList.remove('hidden');
      singleFooterActions.innerHTML = `
        <button onclick="openFullReadingModal()" class="btn-vintage-plum px-5 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang">
          ✦ ดูบทสรุปคำทำนาย
        </button>
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

  box.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <span class="font-fahkwang text-xs text-[#4F2031]">✦ คำทำนายตามตำแหน่งนี้</span>
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
    body.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 pt-1">
          <!-- ชื่อไพ่และคำแปลด้านบนรูปไพ่สำหรับจอมือถือ -->
          <div class="sm:hidden text-center space-y-0.5 w-full">
            <span class="font-cinzel text-base font-bold text-[#2A160E] tracking-wider block">${card.name}</span>
            <h3 class="font-charm text-xl text-[#4F2031]">${card.thaiName}</h3>
          </div>

          <div class="w-36 sm:w-44 h-auto shrink-0 mx-auto sm:mx-0" data-card-front-slot="${card.id}">
            ${buildMinimalCardFrontHTML(card)}
          </div>

          <div class="flex-1 space-y-3 text-left w-full">
            <div class="hidden sm:block">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-cinzel text-lg sm:text-xl text-[#2A160E]">${card.name}</span>
              </div>
              <h3 class="font-charm text-2xl sm:text-3xl text-[#4F2031] mt-0.5">${card.thaiName}</h3>
            </div>

            <div class="flex flex-wrap gap-1.5">
              ${card.keywords.map((kw) => `<span class="px-2.5 py-0.5 rounded text-xs font-fahkwang bg-[#FCF4DC] border border-[#8A5414]/55 text-[#2A160E]">✦ ${kw}</span>`).join('')}
            </div>

            ${buildAiOraclePanelHTML()}
          </div>
        </div>
      </div>
    `;
  } else {
    const mid = Math.ceil(sortedSlots.length / 2);
    const row1 = sortedSlots.slice(0, mid);
    const row2 = sortedSlots.slice(mid);
    const renderStripRow = (slots) =>
      slots
        .map(
          (slot) => `
          <div class="w-20 sm:w-24 md:w-28 shrink-0 hero-float-2" data-card-front-slot="${slot.card.id}" title="${slot.card.name} — ${slot.card.thaiName}">
            ${buildMinimalCardFrontHTML(slot.card)}
          </div>
        `
        )
        .join('');

    body.innerHTML = `
      <div class="space-y-4">
        <div class="text-center space-y-1 border-b border-[#8A5414]/45 pb-3">
          <span class="font-cinzel text-xs tracking-[0.18em] uppercase text-[#4F2031]">${activeSpread.engTitle}</span>
          <h3 class="font-charm text-2xl sm:text-3xl text-[#2A160E] leading-snug">
            <span class="block">บทสรุปคำพยากรณ์</span>
            <span class="block text-xl sm:text-2xl text-[#4F2031]">${activeSpread.name}</span>
          </h3>
        </div>

        <div class="flex flex-col items-center gap-2.5 py-1">
          <div class="flex items-center justify-center gap-2.5 sm:gap-3">
            ${renderStripRow(row1)}
          </div>
          ${
            row2.length
              ? `<div class="flex items-center justify-center gap-2.5 sm:gap-3">${renderStripRow(row2)}</div>`
              : ''
          }
        </div>

        ${buildAiOraclePanelHTML()}
      </div>
    `;
  }

  const fullFooterBar = document.getElementById('reading-modal-footer-bar');
  const fullFooterActions = document.getElementById('reading-modal-footer-actions');
  if (fullFooterBar && fullFooterActions) {
    fullFooterBar.classList.remove('hidden');
    fullFooterActions.innerHTML = `
      <div class="flex flex-col items-end gap-2">
        <button onclick="closeReadingModal()" class="btn-vintage-primary px-5 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang">
          กลับสู่แท่นพยากรณ์
        </button>
        <button onclick="resetToHome()" class="bg-white hover:bg-[#F9F2F5] text-[#4F2031] border border-[#4F2031] px-2.5 py-1 rounded text-[11px] font-fahkwang leading-tight transition-colors">
          การทำนายอื่น ๆ
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

let isModalScrollControlsHidden = false;

function syncReadingModalOffset(modal) {
  if (!modal) return;
  isModalScrollControlsHidden = false;
  const controlsWrap = document.getElementById('modal-scroll-controls');
  if (controlsWrap) controlsWrap.classList.remove('hidden');
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
      scrollBox.addEventListener('scroll', updateModalScrollButtons, { passive: true });
      scrollBox.addEventListener('click', (event) => {
        if (event.target.closest('button, a, input, textarea, select')) return;
        isModalScrollControlsHidden = !isModalScrollControlsHidden;
        updateModalScrollButtons();
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

  if (controlsWrap) {
    controlsWrap.classList.toggle('hidden', isModalScrollControlsHidden);
  }
  if (isModalScrollControlsHidden) return;

  const canScroll = scrollBox.scrollHeight > scrollBox.clientHeight + 10;
  if (!canScroll) {
    upBtn.classList.add('hidden');
    downBtn.classList.add('hidden');
    return;
  }

  const atTop = scrollBox.scrollTop <= 8;
  const atBottom = scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 8;
  upBtn.classList.toggle('hidden', atTop);
  downBtn.classList.toggle('hidden', atBottom);
}

function scrollReadingModal(direction) {
  const modal = document.getElementById('reading-modal');
  const scrollBox = modal ? modal.querySelector('.editorial-scroll') : null;
  if (!scrollBox) return;
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
  trackEvent('summary_share', { spreadId: activeSpread.spread_id, spreadName: activeSpread.name });
  const btn = document.getElementById('btn-share-summary');
  if (btn) btn.textContent = '✦ กำลังบันทึกภาพหน้าสรุป...';
  const sorted = [...placedSlots].sort((a, b) => a.posIndex - b.posIndex);
  const result = buildLocalGuidebookSynthesis(activeSpread, userSecretQuestion, placedSlots);

  const lines = [
    `THE CLOW — ${activeSpread.name}`,
    `ไพ่ที่ได้: ${sorted.map((s) => `${s.posIndex}. ${s.card.name} (${s.card.thaiName})`).join(' · ')}`,
    ''
  ];
  if (Array.isArray(result.connections)) {
    result.connections.forEach((item, idx) => {
      const stepNum = item.positionIndex || idx + 1;
      const titleText = item.positionTitle ? ` · ${item.positionTitle}` : '';
      lines.push(`ใบที่ ${stepNum}${titleText}: ${String(item.insight || '').replace(/,/g, '').trim()}`);
    });
  }
  const cleanWarn = Array.isArray(result.advice)
    ? result.advice.map((l) => String(l || '').replace(/,/g, '').trim()).filter(Boolean).join(' ')
    : String(result.advice || '').replace(/,/g, '').trim();
  if (cleanWarn) {
    lines.push('', `ไพ่เหล่านี้ต้องการเตือนคุณว่า ${cleanWarn}`);
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
      btn.textContent = '✓ บันทึกและคัดลอกคำทำนายแล้ว';
      setTimeout(() => {
        if (btn) btn.textContent = '✦ แชร์ / บันทึกคำทำนาย';
      }, 2600);
    }
  } catch (err) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareText).catch(() => {});
    }
    if (btn) {
      btn.textContent = '✓ คัดลอกคำทำนายแล้ว';
      setTimeout(() => {
        if (btn) btn.textContent = '✦ แชร์ / บันทึกคำทำนาย';
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
  scrollToNextQuestCard,
  handlePlacedCardClick,
  shareOrSaveSummary,
  toggleLanguage,
  revealAllAndOpenSummary,
  openNextUnrevealedCard,
  openFullReadingModal,
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
  return nextLang;
}

window.addEventListener('DOMContentLoaded', () => {
  initStickyCompactHeader();
  initHeroCardShowcase();
  initSpreadNavigation();
  initStaticAssets();
  initAutoBgm();
  preloadAllBgmTracks();
  applyLanguage('th');
  trackEvent('page_view');

  window.addEventListener('scroll', updateQuestNavArrow, { passive: true });
  window.addEventListener('resize', () => {
    updateQuestNavArrow();
    if (ritualPhase === 'draw' && activeSpread && placedSlots.length < activeSpread.card_count) {
      renderFannedDeckArc(false);
    }
  });
});
