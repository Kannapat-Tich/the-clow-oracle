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
import { requestAiInterpretation, clearAiReadingCache } from './ai-oracle.js';

/**
 * =========================================================================
 * 1. STATIC ASSET LOADER WITH INSTANT RENDER & BACKGROUND PRELOAD
 * แสดงรูปไพ่จริงทันทีไม่ต้องรอ probeImage และโหลดไพ่ทั้ง 52 ใบล่วงหน้าในพื้นหลัง
 * หากรูปใดโหลดไม่ได้จะสลับเป็นภาพเวกเตอร์ (SVG) สำรองอัตโนมัติ
 * =========================================================================
 */
const realCardBackUrl = getCardBackUrl();
let cardBackFailed = false;
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

function updateRitualPhaseBadges(phase) {
  const bar = document.getElementById('ritual-stepper-bar');
  if (!bar || !activeSpread) return;

  const hasQuestionStep = Boolean(activeSpread.requiresQuestionPrompt);
  const needsCut = activeSpread.card_count > 1;
  const activeCls = 'whitespace-nowrap px-2.5 py-0.5 rounded bg-[#EBB844] text-[#2A160E] border border-[#4A1F12]';
  const inactiveCls = 'whitespace-nowrap px-2.5 py-0.5 rounded bg-[#FCF4DC] text-[#523020] border border-[#8A5414]/45';

  if (hasQuestionStep && needsCut) {
    bar.innerHTML = `
      <span class="${phase === 'question' ? activeCls : inactiveCls}">ฝากคำถาม (ข้ามได้)</span>
      <span class="text-[#8A5414]">—</span>
      <span class="${phase === 'shuffle' ? activeCls : inactiveCls}">สับไพ่</span>
      <span class="text-[#8A5414]">—</span>
      <span class="${phase === 'cut' ? activeCls : inactiveCls}">ตัดกองไพ่</span>
      <span class="text-[#8A5414]">—</span>
      <span class="${phase === 'draw' ? activeCls : inactiveCls}">คลี่ไพ่เลือก</span>
    `;
  } else if (needsCut) {
    bar.innerHTML = `
      <span class="${phase === 'shuffle' ? activeCls : inactiveCls}">สับสำรับไพ่</span>
      <span class="text-[#8A5414]">—</span>
      <span class="${phase === 'cut' ? activeCls : inactiveCls}">ตัดกองไพ่</span>
      <span class="text-[#8A5414]">—</span>
      <span class="${phase === 'draw' ? activeCls : inactiveCls}">คลี่ไพ่เลือกวาง</span>
    `;
  } else {
    bar.innerHTML = `
      <span class="${phase === 'shuffle' ? activeCls : inactiveCls}">ตั้งจิตสับไพ่</span>
      <span class="text-[#8A5414]">—</span>
      <span class="${phase === 'draw' ? activeCls : inactiveCls}">คลี่ไพ่เลือกวาง</span>
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

  document.getElementById('btn-reveal-all').classList.add('hidden');
  document.getElementById('btn-full-reading').classList.add('hidden');
  document.getElementById('board-area').classList.add('hidden');
  document.getElementById('ritual-stepper-bar').classList.remove('hidden');

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
  document.getElementById('table-progress-pill').textContent = 'ตั้งจิตฝากคำถาม';
  document.getElementById('deck-instruction-title').textContent = 'ตั้งจิตและบอกเล่าเรื่องราว (ข้ามได้)';
  document.getElementById('deck-instruction-sub').textContent =
    `ตามตำรา (${activeSpread.manualRef}) การเรียบเรียงปัญหาหรือคำถามให้ชัดเจนจะช่วยให้ AI ตีความคำทำนายได้ตรงกับเรื่องของคุณมากขึ้น`;

  triggerPageFade(deckPanel);
  scrollToTopSmooth();
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

  document.getElementById('btn-reveal-all').classList.add('hidden');
  document.getElementById('btn-full-reading').classList.add('hidden');
  document.getElementById('board-area').classList.add('hidden');
  document.getElementById('ritual-stepper-bar').classList.remove('hidden');

  const deckPanel = document.getElementById('deck-stage-panel');
  deckPanel.className = 'vintage-frame w-full max-w-xl mx-auto rounded-lg p-3 sm:p-5 transition-all';

  document.getElementById('ritual-question-stage').classList.add('hidden');
  document.getElementById('ritual-stack-stage').classList.remove('hidden');
  document.getElementById('ritual-cut-stage').classList.add('hidden');
  document.getElementById('fan-draw-stage').classList.add('hidden');
  document.getElementById('docked-resting-deck').classList.add('hidden');

  const needsCut = activeSpread.card_count > 1;
  document.getElementById('btn-proceed-next').textContent = needsCut
    ? '✦ พอใจแล้ว · ไปตัดกองไพ่'
    : '✦ พอใจแล้ว · คลี่ไพ่เลือก';

  updateRitualPhaseBadges('shuffle');
  document.getElementById('table-progress-pill').textContent = 'ตั้งจิตสับไพ่';
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
  if (shuffleCount === 0) {
    shuffledDeck = fisherYatesShuffle(shuffledDeck);
  }
  if (activeSpread.card_count > 1) enterDeckCutStage();
  else enterFanDrawPhase();
}

function enterDeckCutStage() {
  clearPendingDrawNotice();
  ritualPhase = 'cut';
  isAnimatingRitual = false;
  updateRitualPhaseBadges('cut');

  document.getElementById('ritual-question-stage').classList.add('hidden');
  document.getElementById('ritual-stack-stage').classList.add('hidden');
  document.getElementById('ritual-cut-stage').classList.remove('hidden');

  const cutZone = document.getElementById('cut-deck-touchzone');
  cutZone.classList.remove('is-cutting');
  document.getElementById('cut-target-ghost').classList.remove('hidden');
  document.getElementById('btn-trigger-cut').disabled = false;

  document.getElementById('cut-top-card').innerHTML = buildMinimalCardBackSVG();
  document.getElementById('cut-bottom-card').innerHTML = buildMinimalCardBackSVG();

  document.getElementById('table-progress-pill').textContent = 'ตัดกองไพ่';
  document.getElementById('deck-instruction-title').textContent = 'ตัดแบ่งครึ่งกองไพ่';
  document.getElementById('deck-instruction-sub').textContent =
    'การตัดไพ่คือการปิดรับคำถามและแบ่งพลังงานก่อนเปิดไพ่ แตะปุ่มด้านล่างเพื่อยกครึ่งบนวางแยก แล้วนำครึ่งล่างซ้อนทับด้านบน';

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
        ${s.name}
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
          <span class="px-2 py-0.5 rounded text-[11px] font-fahkwang bg-[#F8DF94] text-[#2A160E] border border-[#4A1F12]/70">${spread.card_count} ใบ</span>
        </div>
        <h2 class="font-charm text-xl sm:text-2xl text-[#2A160E] group-hover:text-[#4F2031] transition-colors">${spread.name}</h2>
        <p class="font-pridi text-xs sm:text-sm text-[#523020] leading-relaxed">${spread.purpose}</p>
      </div>
      <div class="mt-3 pt-2 sm:mt-3.5 sm:pt-2.5 border-t border-[#8A5414]/45 flex items-center justify-between text-xs font-fahkwang text-[#2A160E]">
        <span>เปิดตำราและสับไพ่</span>
        <span class="text-[#4F2031] group-hover:translate-x-1 transition-transform">✦ →</span>
      </div>
    </button>
  `
  ).join('');
}

function resetToHome() {
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

  document.getElementById('table-spread-eng').textContent = activeSpread.engTitle;
  document.getElementById('table-spread-title').textContent = activeSpread.name;

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

  renderFannedDeckArc(true);
  updateTableProgress();
  playRapidRiffleSound(24, 0.055);
  triggerPageFade(deckPanel);
  scrollToTopSmooth();

  // แสดงป็อปอัปแจ้งเตือนหลังจากกรีดไพ่คว่ำครบทั้ง 52 ใบแล้ว
  const totalDealDurationMs = shuffledDeck.length * 28 + 520;
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
                  onmouseenter="document.getElementById('fan-hover-hint').textContent = 'หากรู้สึกถูกชะตากับไพ่ใบนี้ ให้แตะเลือกทันที'"
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

function pickCardFromDeck(deckIdx) {
  if (!activeSpread || ritualPhase !== 'draw' || isDrawInteractionLocked) return;
  if (placedSlots.length >= activeSpread.card_count) return;
  if (placedSlots.some((s) => s.deckIdx === deckIdx)) return;

  const cardBtn = document.getElementById(`deck-card-${deckIdx}`);
  if (cardBtn) {
    cardBtn.classList.remove('fan-deal-in');
    cardBtn.classList.add('is-picked');
    cardBtn.disabled = true;
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

  focusedBoardIdx = nextPosIndex;
  playSoftPaperRustle();
  renderSpreadBoard();
  updateTableProgress();

  if (placedSlots.length >= activeSpread.card_count) {
    const workspace = document.getElementById('table-workspace');
    workspace.className = 'w-full flex flex-col lg:flex-row items-stretch justify-center gap-3 sm:gap-4';

    const boardArea = document.getElementById('board-area');
    boardArea.classList.remove('order-2');
    boardArea.classList.add('order-1');

    const deckPanel = document.getElementById('deck-stage-panel');
    deckPanel.className = 'vintage-frame order-2 w-full lg:w-44 shrink-0 rounded-lg p-3 sm:p-3.5 flex flex-col justify-center transition-all';

    document.getElementById('ritual-stepper-bar').classList.add('hidden');
    document.getElementById('fan-draw-stage').classList.add('hidden');
    document.getElementById('docked-resting-deck').classList.remove('hidden');
    document.getElementById('resting-deck-back').innerHTML = buildMinimalCardBackSVG();

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

  const chosenIdx = available[Math.floor(Math.random() * available.length)];
  pickCardFromDeck(chosenIdx);
}

function updateTableProgress() {
  if (!activeSpread) return;
  const count = placedSlots.length;
  const total = activeSpread.card_count;
  const pill = document.getElementById('table-progress-pill');
  const boardHint = document.getElementById('board-stage-hint');
  const guideText = document.getElementById('board-ritual-guide-text');

  const summaryCta = document.getElementById('board-summary-cta');

  if (count < total) {
    const nextPosObj = activeSpread.positions[count];
    pill.textContent = `เลือกไพ่ ${count} / ${total} ใบ`;
    boardHint.textContent = `ตำแหน่งถัดไป: ${nextPosObj.index}. ${nextPosObj.title}`;
    guideText.innerHTML =
      `ใช้ความรู้สึกแวบแรกเลือกไพ่ 1 ใบที่สะดุดตาที่สุดสำหรับตำแหน่งลำดับที่ <strong>${nextPosObj.index}. ${nextPosObj.title}</strong> (${nextPosObj.meaning}) — <em>เลือกแล้วไม่สามารถเปลี่ยนใบได้</em>`;
    document.getElementById('deck-instruction-title').textContent = `หยิบไพ่สำหรับตำแหน่งที่ ${nextPosObj.index} (${nextPosObj.title})`;
    document.getElementById('deck-instruction-sub').textContent = nextPosObj.meaning;
    if (summaryCta) summaryCta.classList.add('hidden');
  } else {
    pill.textContent = `วางไพ่ครบ ${total} / ${total} ใบแล้ว`;
    document.getElementById('deck-instruction-title').textContent = 'อัญเชิญไพ่ครบตามผังแล้ว';
    document.getElementById('deck-instruction-sub').textContent = 'แตะเปิดไพ่บนแท่นตามลำดับหมายเลขในคู่มือ';

    const unrevealed = placedSlots.filter((s) => !s.isRevealed);
    if (unrevealed.length > 0) {
      const nextPos = unrevealed[0].posIndex;
      const posMeta = activeSpread.positions.find((p) => p.index === nextPos);
      boardHint.textContent = `ลำดับการเปิดตามคู่มือ: ${posMeta ? `${posMeta.index}. ${posMeta.title}` : ''}`;
      guideText.innerHTML =
        `แตะเปิดไพ่ตามลำดับคู่มือ (<strong>${posMeta ? `ลำดับที่ ${posMeta.index}: ${posMeta.title}` : ''}</strong>) เพื่อพลิกเปิดเผยความหมาย`;
      document.getElementById('btn-reveal-all').classList.remove('hidden');
      document.getElementById('btn-full-reading').classList.add('hidden');
      if (summaryCta) summaryCta.classList.add('hidden');
    } else {
      boardHint.textContent = 'เปิดเผยไพ่ครบทุกตำแหน่งแล้ว';
      guideText.innerHTML =
        `เปิดเผยไพ่ครบทุกใบแล้ว แตะที่ไพ่ใบใดก็ได้เพื่อทบทวน หรือกด <strong>"อ่านคำทำนายฉบับเต็ม + AI"</strong> ด้านบน`;
      document.getElementById('btn-reveal-all').classList.add('hidden');
      document.getElementById('btn-full-reading').classList.remove('hidden');
      if (summaryCta) {
        if (activeSpread.card_count > 1) summaryCta.classList.remove('hidden');
        else summaryCta.classList.add('hidden');
      }
    }
  }
}

function buildSlotHTML(pos) {
  const placed = placedSlots.find((s) => s.posIndex === pos.index);
  const isAllPlaced = placedSlots.length >= activeSpread.card_count;
  const firstUnrevealed = placedSlots.find((s) => !s.isRevealed);
  const isNextToFlip =
    isAllPlaced && placed && !placed.isRevealed && firstUnrevealed && firstUnrevealed.posIndex === pos.index;
  const isJustFocused = !isAllPlaced && placed && focusedBoardIdx === pos.index;

  const cardSizeCls = activeSpread.layoutType === 'single' ? 'w-32 sm:w-44 md:w-52' : 'w-20 sm:w-28 md:w-32';

  const slotHeader = `
    <div class="inline-flex flex-wrap items-center justify-center gap-1 px-2 py-1 mb-1 rounded-lg bg-[#F8DF94] border border-[#4A1F12]/75 shadow-2xs max-w-[130px] sm:max-w-[170px] text-center">
      <span class="w-4 h-4 rounded-full bg-[#4F2031] text-[#FFF8E3] font-cinzel text-[9px] font-bold flex items-center justify-center shrink-0 leading-none">
        ${pos.index}
      </span>
      <span class="font-fahkwang text-[9px] sm:text-[11px] text-[#2A160E] leading-tight break-words">
        ${pos.title}
      </span>
    </div>
  `;

  if (!placed) {
    const isCurrentTarget = placedSlots.length + 1 === pos.index;
    return `
      <div class="flex flex-col items-center w-full p-1 sm:p-2 rounded-xl bg-[#FBF1D4]/30 border border-[#8A5414]/25">
        ${slotHeader}
        <div class="${cardSizeCls} clow-aspect rounded-[10px] border-2 border-dashed ${
          isCurrentTarget ? 'border-[#4A1F12] bg-[#F8DF94]/65 shadow-inner' : 'border-[#8A5414]/45 bg-[#FCF4DC]/65'
        } flex flex-col items-center justify-center p-1 sm:p-2 text-center transition-all">
          <span class="font-cinzel text-xs sm:text-sm font-bold text-[#4F2031]/80">${pos.index}</span>
          <span class="font-pridi text-[9px] sm:text-[10px] text-[#523020]/85 mt-1 leading-tight">
            ${isCurrentTarget ? 'รอวางไพ่' : 'ตำแหน่งว่าง'}
          </span>
        </div>
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
    <div class="flex flex-col items-center w-full p-1 sm:p-2 rounded-xl bg-[#FBF1D4]/30 border border-[#8A5414]/25 card-enter">
      ${slotHeader}
      <button onclick="handlePlacedCardClick(${pos.index})"
              class="perspective-1200 ${cardSizeCls} clow-aspect focus:outline-none cursor-pointer group ${highlightCls}"
              title="${placed.isRevealed ? `อ่านคำทำนาย ${placed.card.name}` : `แตะเพื่อพลิกเปิดไพ่ตามลำดับที่ ${pos.index}`}">
        <div class="card-inner ${placed.isRevealed ? 'is-flipped' : ''}">
          <div class="card-face">
            ${buildMinimalCardBackSVG()}
          </div>
          <div class="card-face card-front" data-card-front-slot="${placed.card.id}">
            ${buildMinimalCardFrontHTML(placed.card)}
          </div>
        </div>
      </button>
      <span class="mt-1.5 font-fahkwang text-[9px] sm:text-[10px] text-center leading-tight ${
        placed.isRevealed ? 'text-[#4F2031]' : 'text-[#523020]'
      }">
        ${placed.isRevealed ? placed.card.thaiName : isNextToFlip ? '✦ แตะเปิดลำดับ ' + pos.index : 'คว่ำหน้า'}
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
      <div class="grid grid-cols-3 gap-x-2 sm:gap-x-3 gap-y-2.5 sm:gap-y-3.5 items-start justify-items-center max-w-xl mx-auto">
        <div></div>${buildSlotHTML(getPos(2))}<div></div>
        ${buildSlotHTML(getPos(4))}${buildSlotHTML(getPos(1))}${buildSlotHTML(getPos(3))}
        <div></div>${buildSlotHTML(getPos(5))}<div></div>
      </div>
    `;
  } else {
    wrapper.innerHTML = `
      <div class="space-y-2.5 sm:space-y-3.5">
        <div class="grid grid-cols-3 gap-x-2 sm:gap-x-3 gap-y-2 items-start justify-items-center max-w-xl mx-auto">
          ${buildSlotHTML(getPos(1))}${buildSlotHTML(getPos(2))}${buildSlotHTML(getPos(3))}
        </div>
        <div class="border-t border-dashed border-[#8A5414]/45"></div>
        <div class="grid grid-cols-3 gap-x-2 sm:gap-x-3 gap-y-2 items-start justify-items-center max-w-xl mx-auto">
          ${buildSlotHTML(getPos(4))}${buildSlotHTML(getPos(5))}${buildSlotHTML(getPos(6))}
        </div>
      </div>
    `;
  }
}

function handlePlacedCardClick(posIndex) {
  const placed = placedSlots.find((s) => s.posIndex === posIndex);
  if (!placed) return;

  preloadCardImage(placed.card);

  if (!placed.isRevealed) {
    placed.isRevealed = true;
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

function revealAllCards() {
  const unrevealed = placedSlots.filter((s) => !s.isRevealed);
  if (unrevealed.length === 0) return;

  placedSlots.forEach((slot) => preloadCardImage(slot.card));
  unrevealed.forEach((slot, idx) => {
    setTimeout(() => {
      slot.isRevealed = true;
      playCardFlipSound();
      renderSpreadBoard();
      updateTableProgress();
    }, idx * 180);
  });

  if (activeSpread && activeSpread.card_count > 1) {
    setTimeout(() => {
      if (activeSpread && placedSlots.every((s) => s.isRevealed)) {
        openFullReadingModal();
      }
    }, unrevealed.length * 180 + 620);
  }
}

/**
 * =========================================================================
 * 4. AI ORACLE SECTION IN READING MODAL
 * =========================================================================
 */
function buildAiOraclePanelHTML() {
  const placeholder =
    (activeSpread && activeSpread.questionPlaceholder) ||
    'เล่าปัญหา ความกังวล หรือคำถามที่อยากให้ AI ช่วยเชื่อมโยงกับหน้าไพ่...';

  return `
    <div id="ai-oracle-section" class="ai-oracle-panel rounded-xl p-4 sm:p-5 space-y-3.5 text-left">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#4F2031]/20 pb-2.5">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-[#4F2031] text-[#F8DF94] text-xs flex items-center justify-center shrink-0">✦</span>
          <div>
            <h4 class="font-fahkwang text-xs sm:text-sm text-[#4F2031] font-medium">
              ตีความเฉพาะตัวด้วย AI (อ้างอิงคัมภีร์โคลว์การ์ด)
            </h4>
            <p class="font-pridi text-[11px] text-[#523020]">
              เชื่อมโยงความหมายไพ่ทั้ง ${activeSpread.card_count} ใบเข้ากับปัญหาหรือเรื่องราวของคุณโดยตรง
            </p>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-fahkwang bg-[#FFF8E3] text-[#4F2031] border border-[#8F5B6E]/50">
          ไม่เก็บข้อมูลส่วนตัว
        </span>
      </div>

      <div class="space-y-1.5">
        <label for="modal-ai-question" class="font-fahkwang text-xs text-[#2A160E]">
          เรื่องราวหรือคำถามของคุณ (แก้ไขเพิ่มเติมก่อนกดตีความได้):
        </label>
        <textarea id="modal-ai-question"
                  rows="2"
                  maxlength="500"
                  placeholder="${escapeHtml(placeholder)}"
                  class="w-full rounded-md bg-[#FFFDF5] border border-[#8A5414]/70 px-3 py-2 font-pridi text-xs sm:text-sm text-[#2A160E] placeholder-[#523020]/55 focus:outline-none focus:border-[#4F2031] focus:ring-1 focus:ring-[#4F2031]">${escapeHtml(userSecretQuestion)}</textarea>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="font-pridi text-[10px] sm:text-[11px] text-[#523020]">
          🔒 ข้อความจะถูกส่งชั่วคราวเมื่อกดปุ่มนี้เท่านั้น และไม่บันทึกลงฐานข้อมูล
        </p>
        <button id="btn-run-ai-oracle"
                onclick="triggerAiInterpretation()"
                class="btn-vintage-plum whitespace-nowrap px-4 py-2 rounded-md text-xs font-fahkwang ml-auto">
          ✦ ให้ AI ตีความให้สอดคล้องกับปัญหาของคุณ
        </button>
      </div>

      <div id="ai-oracle-output" class="hidden pt-2 border-t border-[#4F2031]/20"></div>
    </div>
  `;
}

async function triggerAiInterpretation() {
  if (!activeSpread || placedSlots.length < activeSpread.card_count) return;

  const qEl = document.getElementById('modal-ai-question');
  const btn = document.getElementById('btn-run-ai-oracle');
  const outputEl = document.getElementById('ai-oracle-output');
  if (!outputEl) return;

  const currentQuestion = qEl ? qEl.value.trim() : userSecretQuestion;
  userSecretQuestion = currentQuestion;

  if (btn) {
    btn.disabled = true;
    btn.textContent = '✦ กำลังร้อยเรียงคำพยากรณ์...';
  }

  outputEl.classList.remove('hidden');
  outputEl.innerHTML = `
    <div class="ai-loading-pulse py-4 text-center space-y-1.5">
      <p class="font-fahkwang text-xs sm:text-sm text-[#4F2031]">☽ กำลังอัญเชิญคัมภีร์โคลว์และเชื่อมโยงหน้าไพ่เข้ากับเรื่องราวของคุณ...</p>
      <p class="font-pridi text-[11px] text-[#523020]">โปรดรอสักครู่ (ประมาณ 2–5 วินาที)</p>
    </div>
  `;

  const result = await requestAiInterpretation({
    spread: activeSpread,
    question: currentQuestion,
    drawnCards: placedSlots
  });

  if (btn) {
    btn.disabled = false;
    btn.textContent = '↻ ตีความใหม่อีกครั้ง';
  }

  if (result.mode === 'quota' || result.mode === 'fallback') {
    outputEl.innerHTML = `
      <div class="bg-[#FCF4DC] border border-[#8F5B6E]/60 rounded-lg p-3.5 space-y-1">
        <p class="font-fahkwang text-xs text-[#4F2031]">☽ แจ้งเตือนจากห้องพยากรณ์ AI</p>
        <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(result.message)}</p>
      </div>
    `;
    return;
  }

  const demoBanner =
    result.mode === 'demo'
      ? `
      <div class="bg-[#F8DF94]/70 border border-[#8A5414]/60 rounded-md px-3 py-2 text-[11px] font-pridi text-[#523020]">
        ✦ <strong>โหมดตัวอย่าง (Local Preview):</strong> แสดงการร้อยเรียงจากคู่มือไพ่จริง เมื่อนำขึ้น Cloudflare Pages และตั้งค่า Gemini API Key (ฟรี) จะเปลี่ยนเป็นการตีความโดย AI จริงอัตโนมัติ
      </div>
    `
      : '';

  const connectionsHTML = Array.isArray(result.connections)
    ? result.connections
        .map(
          (item) => `
        <li class="bg-[#FFFDF5]/85 border border-[#8A5414]/35 rounded-md px-3 py-2 space-y-0.5">
          <div class="font-fahkwang text-xs text-[#4F2031]">
            ${item.positionIndex ? `${item.positionIndex}. ` : ''}${escapeHtml(item.positionTitle)} — <span class="text-[#2A160E]">${escapeHtml(item.cardName)}</span>
          </div>
          <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(item.insight)}</p>
        </li>
      `
        )
        .join('')
    : '';

  const adviceHTML = Array.isArray(result.advice)
    ? result.advice
        .map((line) => `<li class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(line)}</li>`)
        .join('')
    : '';

  outputEl.innerHTML = `
    <div class="space-y-4 pt-1">
      ${demoBanner}

      <div class="space-y-1">
        <h5 class="font-fahkwang text-xs uppercase tracking-wider text-[#4F2031]">✦ ภาพรวมคำตอบสำหรับเรื่องของคุณ</h5>
        <p class="font-pridi text-sm text-[#2A160E] leading-relaxed">${escapeHtml(result.overview)}</p>
      </div>

      ${
        connectionsHTML
          ? `
        <div class="space-y-2">
          <h5 class="font-fahkwang text-xs uppercase tracking-wider text-[#4F2031]">✦ ความเชื่อมโยงของหน้าไพ่กับสถานการณ์</h5>
          <ul class="space-y-2">${connectionsHTML}</ul>
        </div>
      `
          : ''
      }

      ${
        adviceHTML
          ? `
        <div class="bg-[#8F5B6E]/12 border-l-4 border-[#4F2031] rounded-r-md px-3.5 py-2.5 space-y-1">
          <h5 class="font-fahkwang text-xs text-[#4F2031]">☽ คำแนะนำและข้อควรระวังเฉพาะเรื่องนี้</h5>
          <ul class="space-y-1">${adviceHTML}</ul>
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
    <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 pt-2">
      <div class="w-40 sm:w-48 md:w-52 h-auto shrink-0 mx-auto sm:mx-0" data-card-front-slot="${card.id}">
        ${buildMinimalCardFrontHTML(card)}
      </div>

      <div class="flex-1 space-y-4 text-left">
        <div class="bg-[#F4DC9C]/80 border border-[#8A5414]/60 rounded-lg px-4 py-2.5">
          <span class="font-fahkwang text-xs text-[#4F2031]">ลำดับที่ ${posMeta.index} · ${posMeta.title}</span>
          <p class="font-pridi text-xs text-[#523020] mt-0.5">${posMeta.meaning}</p>
        </div>

        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-cinzel text-lg sm:text-xl text-[#2A160E]">${card.name}</span>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-fahkwang bg-[#8F5B6E]/25 text-[#2A160E] border border-[#8F5B6E]/65">${card.elementThai}</span>
          </div>
          <h3 class="font-charm text-2xl sm:text-3xl text-[#4F2031] mt-0.5">${card.thaiName}</h3>
        </div>

        <div class="flex flex-wrap gap-1.5">
          ${card.keywords.map((kw) => `<span class="px-2.5 py-0.5 rounded text-xs font-fahkwang bg-[#FCF4DC] border border-[#8A5414]/55 text-[#2A160E]">✦ ${kw}</span>`).join('')}
        </div>

        <div class="space-y-2 pt-1">
          <h4 class="font-fahkwang text-xs text-[#2A160E] uppercase tracking-wider">คำพยากรณ์หลัก (ตามคัมภีร์)</h4>
          <p class="font-pridi text-sm text-[#2A160E] leading-relaxed">${card.meaning}</p>
        </div>

        <div class="bg-[#8F5B6E]/15 border-l-4 border-[#4F2031] rounded-r-md px-4 py-3">
          <h4 class="font-fahkwang text-xs text-[#4F2031]">☽ ข้อควรระวังจากหน้าไพ่</h4>
          <p class="font-pridi text-xs sm:text-sm text-[#2A160E] mt-1 leading-relaxed">${card.warning}</p>
        </div>

        <div id="single-card-ai-box" class="ai-oracle-panel rounded-lg p-3.5 space-y-2 text-left">
          <div class="flex items-center justify-between gap-2">
            <span class="font-fahkwang text-xs text-[#4F2031]">✦ AI ตีความเชื่อมโยงกับเรื่องของคุณ</span>
          </div>
          <p class="ai-loading-pulse font-pridi text-xs text-[#523020]">
            ☽ กำลังร้อยเรียงคำทำนายเฉพาะตำแหน่งนี้ให้ตรงกับเรื่องของคุณ...
          </p>
        </div>
      </div>
    </div>
  `;

  const singleFooterActions = document.getElementById('reading-modal-footer-actions');
  if (singleFooterActions) {
    const allRevealedMulti =
      activeSpread &&
      activeSpread.card_count > 1 &&
      placedSlots.length >= activeSpread.card_count &&
      placedSlots.every((s) => s.isRevealed);

    singleFooterActions.innerHTML = allRevealedMulti
      ? `
        <button onclick="closeReadingModal()" class="btn-vintage-secondary px-4 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang">
          กลับสู่แท่นพยากรณ์
        </button>
        <button onclick="openFullReadingModal()" class="btn-vintage-plum px-5 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang">
          ✦ ดูบทสรุปคำทำนายครบทุกใบ + AI
        </button>
      `
      : `
        <button onclick="closeReadingModal()" class="btn-vintage-primary px-5 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang">
          กลับสู่แท่นพยากรณ์
        </button>
      `;
  }

  const modal = document.getElementById('reading-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  playSoftPaperRustle();

  loadSingleCardAiInsight(posIndex);
}

async function loadSingleCardAiInsight(posIndex) {
  if (!activeSpread || placedSlots.length < activeSpread.card_count) return;
  const box = document.getElementById('single-card-ai-box');
  if (!box) return;

  const result = await requestAiInterpretation({
    spread: activeSpread,
    question: userSecretQuestion,
    drawnCards: placedSlots
  });

  const currentBox = document.getElementById('single-card-ai-box');
  if (!currentBox) return;

  if (result.mode === 'quota' || result.mode === 'fallback') {
    currentBox.innerHTML = `
      <p class="font-fahkwang text-xs text-[#4F2031]">✦ AI ตีความเฉพาะเรื่อง</p>
      <p class="font-pridi text-xs text-[#523020] leading-relaxed">${escapeHtml(result.message)}</p>
    `;
    return;
  }

  const conn = Array.isArray(result.connections)
    ? result.connections.find((c) => Number(c.positionIndex) === Number(posIndex)) || result.connections[posIndex - 1]
    : null;

  const insightText = conn && conn.insight ? conn.insight : result.overview;
  const demoTag =
    result.mode === 'demo'
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-fahkwang bg-[#F8DF94]/80 text-[#523020] border border-[#8A5414]/45">ตัวอย่างพรีวิว</span>'
      : '';

  currentBox.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <span class="font-fahkwang text-xs text-[#4F2031]">✦ AI ตีความเชื่อมโยงกับเรื่องของคุณ</span>
      ${demoTag}
    </div>
    ${
      userSecretQuestion
        ? `<p class="font-pridi text-[11px] text-[#523020]/90 italic">คำถาม: “${escapeHtml(userSecretQuestion)}”</p>`
        : ''
    }
    <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${escapeHtml(insightText || '')}</p>
  `;
}

function openFullReadingModal() {
  if (!activeSpread || placedSlots.length < activeSpread.card_count) return;

  const sortedSlots = [...placedSlots].sort((a, b) => a.posIndex - b.posIndex);
  const body = document.getElementById('modal-reading-body');

  body.innerHTML = `
    <div class="space-y-6">
      <div class="text-center space-y-1 border-b border-[#8A5414]/45 pb-4">
        <span class="font-cinzel text-xs tracking-[0.18em] uppercase text-[#4F2031]">${activeSpread.engTitle}</span>
        <h3 class="font-charm text-2xl sm:text-4xl text-[#2A160E]">บทสรุปคำพยากรณ์: ${activeSpread.name}</h3>
      </div>

      ${buildAiOraclePanelHTML()}

      <div class="space-y-3">
        <div class="flex items-center gap-2 pt-1">
          <span class="text-[#8A5414] text-xs">✦</span>
          <h4 class="font-fahkwang text-xs sm:text-sm text-[#2A160E]">คำพยากรณ์ตามตำราโคลว์การ์ดต้นฉบับ (รายตำแหน่ง)</h4>
        </div>

        <div class="space-y-4">
          ${sortedSlots
            .map((slot) => {
              const posMeta = activeSpread.positions.find((p) => p.index === slot.posIndex);
              const card = slot.card;
              return `
              <div class="bg-[#FCF4DC]/85 border border-[#8A5414]/55 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                <div class="w-24 sm:w-28 h-auto shrink-0" data-card-front-slot="${card.id}">
                  ${buildMinimalCardFrontHTML(card)}
                </div>
                <div class="flex-1 space-y-1.5 text-left">
                  <div class="flex flex-wrap items-center justify-between gap-1">
                    <span class="font-fahkwang text-xs text-[#4F2031]">ลำดับที่ ${posMeta.index} · ${posMeta.title}</span>
                    <span class="font-cinzel text-xs text-[#2A160E]">${card.name} (${card.thaiName})</span>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    ${card.keywords.map((kw) => `<span class="px-2 py-0.5 rounded text-[10px] font-fahkwang bg-[#FFF8E3] border border-[#8A5414]/45 text-[#523020]">${kw}</span>`).join('')}
                  </div>
                  <p class="font-pridi text-xs sm:text-sm text-[#2A160E] leading-relaxed">${card.meaning}</p>
                  <p class="font-pridi text-xs text-[#5E2C1B]"><strong>ข้อควรระวัง:</strong> ${card.warning}</p>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;

  const fullFooterActions = document.getElementById('reading-modal-footer-actions');
  if (fullFooterActions) {
    fullFooterActions.innerHTML = `
      <button onclick="closeReadingModal()" class="btn-vintage-primary px-5 py-2 sm:py-1.5 rounded-md text-xs font-fahkwang">
        กลับสู่แท่นพยากรณ์
      </button>
    `;
  }

  const modal = document.getElementById('reading-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  playSoftPaperRustle();

  // ตีความด้วย AI อัตโนมัติทันทีที่เปิดหน้าสรุป (ใช้ผลแคชจากไพ่ใบแรกทันที ไม่ยิงซ้ำ)
  triggerAiInterpretation();
}

function closeReadingModal() {
  const modal = document.getElementById('reading-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function handleBackdropClick(event) {
  if (event.target.id === 'reading-modal') {
    closeReadingModal();
  }
}

function initStickyCompactHeader() {
  const headerEl = document.getElementById('main-header');
  if (!headerEl) return;

  const handleScroll = () => {
    if (window.scrollY > 40) headerEl.classList.add('is-scrolled');
    else headerEl.classList.remove('is-scrolled');
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
  pickCardFromDeck,
  drawRandomAvailableCard,
  closeDrawNoticeModal,
  handlePlacedCardClick,
  revealAllCards,
  openFullReadingModal,
  closeReadingModal,
  handleBackdropClick,
  triggerAiInterpretation,
  toggleBgm,
  prevBgmTrack,
  nextBgmTrack
});

window.addEventListener('DOMContentLoaded', () => {
  initStickyCompactHeader();
  initHeroCardShowcase();
  initSpreadNavigation();
  initStaticAssets();
  initAutoBgm();
  preloadAllBgmTracks();

  window.addEventListener('resize', () => {
    if (ritualPhase === 'draw' && activeSpread && placedSlots.length < activeSpread.card_count) {
      renderFannedDeckArc(false);
    }
  });
});
