/**
 * THE CLOW — ระบบสร้างภาพแชร์ IG Story (1080×1920) และภาพสรุปฉบับเต็ม (1344×auto)
 * ออกแบบให้เหมือนแคปหน้าจอจากเว็บไซต์จริง 100%:
 * - ใช้ฟอนต์เดียวกับหน้าเว็บเป๊ะ (Trirong 300/400/500 + Cinzel 600/700)
 * - ไพ่ไม่มีเส้นขอบดำ (borderless) คงความงามของหน้าไพ่แท้พร้อมเงาละมุน
 * - IG Story แสดงผังไพ่จริง + คำทำนายครบทุกใบอย่างสมดุล
 * - ภาพฉบับเต็มสัดส่วนเท่าหน้าต่างบทสรุปจริงบนเว็บไซต์ (logical 672px × 2x DPR)
 * - ลายน้ำตามเฮดเดอร์ (CARDCAPTOR SAKURA · CLOW CARDS) + ชื่อโดเมนแบบไดนามิก
 * - ไม่แสดงคำถามลับของผู้ใช้บนภาพ
 */

import { getCardFrontUrl, getMagicCircleUrl } from '../data/assets.config.js';
import { getCurrentLang, getSpreadName, getPosTitle } from './i18n.js?v=20261124z6';

const DPR = 2;
const FULL_DPR = 3;   // 3x Retina sharpness — zoom-proof Samsung scroll-capture quality!
const STORY_LW = 540; // ×2 = 1080
const STORY_LH = 960; // ×2 = 1920

function getDynamicFullLogicalWidth() {
  try {
    const w = window.innerWidth || 360;
    const h = window.innerHeight || 780;
    const shortSide = Math.min(w, h);
    // มือถือ: บังคับยึดความกว้างแนวตั้งเสมอ (320–380px)
    if (shortSide < 640) {
      return Math.max(320, Math.min(380, shortSide));
    }
    // แท็บเล็ต / เดสก์ท็อป: ใช้ความกว้างมือถือมาตรฐานที่กระชับพอดีฟอนต์ (360px × 3x = 1080px)
    return 360;
  } catch (_) {
    return 360;
  }
}

const COLORS = {
  sunlitCream: '#F3E2B3',
  cardSurface: '#FBF1D4',
  boxFill: 'rgba(252, 244, 220, 0.86)',
  boxStroke: 'rgba(138, 84, 20, 0.42)',
  ink: '#2A160E',
  sepia: '#523020',
  plum: '#4F2031',
  gold: '#8A5414',
  brass: '#9E661A',
  goldStar: '#B47B1E',
  goldStarMuted: 'rgba(138, 84, 20, 0.22)',
  plumTint: 'rgba(143, 91, 110, 0.12)',
  pillFill: 'rgba(248, 223, 148, 0.88)'
};

const FONT_TRIRONG = '"Trirong", Georgia, serif';
const FONT_CINZEL = '"Cinzel", "Cormorant Garamond", Georgia, serif';

const imageCache = new Map();

function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (imageCache.has(url)) return imageCache.get(url);

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}

async function ensureWebsiteFontsLoaded() {
  if (!document.fonts) return;
  const specs = [
    '300 16px Trirong',
    '400 16px Trirong',
    '500 20px Trirong',
    '600 16px Cinzel',
    '700 20px Cinzel'
  ];
  try {
    await Promise.all(specs.map((f) => document.fonts.load(f).catch(() => {})));
    await document.fonts.ready;
  } catch (_) {}
}

export function getDynamicDomainLabel() {
  try {
    const host = (window.location && window.location.host ? window.location.host : '').trim();
    if (!host) return 'the-clow-oracle.pages.dev';
    return host.replace(/^www\./i, '');
  } catch (_) {
    return 'the-clow-oracle.pages.dev';
  }
}

function formatReadingDate(isEn) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  try {
    if (isEn) {
      const datePart = now.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      return `${datePart} · ${hh}:${mm}`;
    }
    const datePart = now.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return `${datePart} · ${hh}:${mm} น.`;
  } catch (_) {
    return `${now.toISOString().slice(0, 10)} · ${hh}:${mm}`;
  }
}

function cleanText(text, isEn) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return isEn ? s : s.replace(/,/g, '');
}

function segmentTokens(text, isEn) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (!isEn && typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      const seg = new Intl.Segmenter('th', { granularity: 'word' });
      const out = [];
      for (const part of seg.segment(clean)) out.push(part.segment);
      return out;
    } catch (_) {}
  }
  return clean.split(/(\s+)/).filter((t) => t.length > 0);
}

function wrapText(ctx, text, maxWidth, isEn, maxLines = 0) {
  const clean = String(text || '').replace(/\r/g, '').trim();
  if (!clean) return [];
  const paragraphs = clean.split('\n');
  const lines = [];

  for (const para of paragraphs) {
    const tokens = segmentTokens(para, isEn);
    if (!tokens.length) continue;
    let cur = '';
    for (const tok of tokens) {
      const cand = cur ? cur + tok : tok.trimStart();
      if (ctx.measureText(cand).width <= maxWidth) {
        cur = cand;
      } else {
        if (cur.trim()) {
          lines.push(cur.trim());
          cur = tok.trimStart();
        } else {
          let chunk = '';
          for (const ch of tok) {
            if (ctx.measureText(chunk + ch).width <= maxWidth) chunk += ch;
            else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          cur = chunk;
        }
      }
    }
    if (cur.trim()) lines.push(cur.trim());
  }

  if (maxLines > 0 && lines.length > maxLines) {
    const sliced = lines.slice(0, maxLines);
    let last = sliced[maxLines - 1].replace(/[\s.…]+$/, '');
    while (last.length > 3 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    sliced[maxLines - 1] = `${last}…`;
    return sliced;
  }
  return lines;
}

function rrect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/**
 * วาดโลโก้ดาวโคลว์ 1:1 ตาม SVG จริงบนเฮดเดอร์เว็บไซต์ (viewBox 0 0 64 64)
 * ครบทั้งดาว 6 แฉกไล่สีทอง เส้นเจียระไน 3 เส้น และจุดศูนย์กลางสีทองอ่อน
 */
function drawClowStarEmblem(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);

  // Outer medallion circle matching header span (bg-[#FBF1D4] border-[#4A1F12])
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#FBF1D4';
  ctx.fill();
  ctx.lineWidth = Math.max(0.9, r * 0.08);
  ctx.strokeStyle = '#4A1F12';
  ctx.stroke();

  // Inner SVG coordinate space (64x64 with p-1 padding -> ~0.82 inner diameter)
  const scale = (r * 1.68) / 64;
  ctx.scale(scale, scale);
  ctx.translate(-32, -32);

  const pts = [
    [32, 6], [40.3, 17.7], [54.5, 19], [48.5, 32],
    [54.5, 45], [40.3, 46.3], [32, 58], [23.7, 46.3],
    [9.5, 45], [15.5, 32], [9.5, 19], [23.7, 17.7]
  ];

  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();

  const grad = ctx.createLinearGradient(6, 6, 58, 58);
  grad.addColorStop(0, '#FFF2A6');
  grad.addColorStop(0.5, '#F2C138');
  grad.addColorStop(1, '#C97E18');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#4A1F12';
  ctx.stroke();

  // 3 delicate facet lines matching website SVG
  ctx.save();
  ctx.strokeStyle = '#4A1F12';
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(32, 6); ctx.lineTo(32, 58);
  ctx.moveTo(9.5, 19); ctx.lineTo(54.5, 45);
  ctx.moveTo(54.5, 19); ctx.lineTo(9.5, 45);
  ctx.stroke();
  ctx.restore();

  // Center jewel circle
  ctx.beginPath();
  ctx.arc(32, 32, 4.2, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF2A6';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#4A1F12';
  ctx.stroke();

  ctx.restore();
}

/**
 * วาดพื้นหลังกระดาษคัมภีร์เหมือนหน้าเว็บไซต์จริง (radial gradient + magic circle + vintage frame)
 */
function drawGrimoireCanvasBackdrop(ctx, lw, lh, magicCircleImg, framePadX = 16, frameTop = 16, frameBottom = 16) {
  // Base sunlit cream radial gradient matching grimoire.css body
  const bg = ctx.createRadialGradient(lw / 2, 0, 20, lw / 2, lh * 0.45, Math.max(lw, lh) * 0.95);
  bg.addColorStop(0, '#FFF9E2');
  bg.addColorStop(0.48, '#F3E2B3');
  bg.addColorStop(1, '#DEC07C');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, lw, lh);

  // Soft edge vignette matching body box-shadow
  const vig = ctx.createRadialGradient(lw / 2, lh / 2, lw * 0.35, lw / 2, lh / 2, Math.max(lw, lh) * 0.72);
  vig.addColorStop(0, 'rgba(79, 32, 49, 0)');
  vig.addColorStop(1, 'rgba(79, 32, 49, 0.10)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, lw, lh);

  // Subtle vintage card surface panel (.vintage-frame)
  const fx = framePadX;
  const fy = frameTop;
  const fw = lw - framePadX * 2;
  const fh = lh - frameTop - frameBottom;

  ctx.save();
  ctx.shadowColor = 'rgba(42, 22, 14, 0.18)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  rrect(ctx, fx, fy, fw, fh, 14);
  ctx.fillStyle = 'rgba(251, 241, 212, 0.92)';
  ctx.fill();
  ctx.restore();

  // Full oversized Clow Magic Circle dead-center of the entire image (matching website backdrop)
  if (magicCircleImg) {
    ctx.save();
    rrect(ctx, fx, fy, fw, fh, 14);
    ctx.clip();
    ctx.globalAlpha = 0.13;
    const cSize = Math.max(fw * 1.18, Math.min(fh * 0.72, fw * 1.38));
    const cx = lw / 2 - cSize / 2;
    const cy = lh / 2 - cSize / 2;
    ctx.drawImage(magicCircleImg, cx, cy, cSize, cSize);
    ctx.restore();
  }

  // Double antique brass frame matching .vintage-frame
  ctx.save();
  rrect(ctx, fx, fy, fw, fh, 14);
  ctx.strokeStyle = 'rgba(158, 102, 26, 0.65)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  rrect(ctx, fx + 4.5, fy + 4.5, fw - 9, fh - 9, 11);
  ctx.strokeStyle = 'rgba(79, 32, 49, 0.24)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Delicate corner flourishes
  ctx.fillStyle = 'rgba(138, 84, 20, 0.72)';
  ctx.font = '12px Georgia, serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('❧', fx + 10, fy + 14);
  ctx.fillText('❧', fx + 10, fy + fh - 13);
  ctx.textAlign = 'right';
  ctx.fillText('☙', fx + fw - 10, fy + 14);
  ctx.fillText('☙', fx + fw - 10, fy + fh - 13);
  ctx.restore();

  return { fx, fy, fw, fh };
}

function ellipticalRRect(ctx, x, y, w, h, rx, ry) {
  const cx = Math.min(rx, w / 2);
  const cy = Math.min(ry, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + cx, y);
  ctx.lineTo(x + w - cx, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + cy);
  ctx.lineTo(x + w, y + h - cy);
  ctx.quadraticCurveTo(x + w, y + h, x + w - cx, y + h);
  ctx.lineTo(x + cx, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - cy);
  ctx.lineTo(x, y + cy);
  ctx.quadraticCurveTo(x, y, x + cx, y);
  ctx.closePath();
}

/**
 * วาดไพ่โคลว์ด้วยสัดส่วนจริงของรูปต้นฉบับ (naturalWidth/naturalHeight)
 * และโค้งมุม 7.5%/3.5% เหมือนหน้าปกเว็บเป๊ะ — ไม่กินขอบบน-ล่าง และไม่เห็นขอบขาวตรงมุม
 */
function drawBorderlessCard(ctx, img, x, y, w, h, options = {}) {
  const { badgeNum = null } = options;

  // Preserve exact natural aspect ratio of the Clow Card image (never distort or crop top/bottom)
  let drawW = w;
  let drawH = h;
  if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
    const natRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = w / h;
    if (natRatio > boxRatio) {
      drawW = w;
      drawH = w / natRatio;
    } else {
      drawH = h;
      drawW = h * natRatio;
    }
  }
  const drawX = x + (w - drawW) / 2;
  const drawY = y + (h - drawH) / 2;

  // Match homepage CSS rounded-[7.5%/3.5%] exactly so white scan corners vanish without cropping card borders
  const rx = drawW * 0.082;
  const ry = drawH * 0.038;

  ctx.save();
  // Clean, whisper-light elevation (no heavy blurry drop shadow)
  ctx.shadowColor = 'rgba(42, 22, 14, 0.16)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1.5;

  ellipticalRRect(ctx, drawX, drawY, drawW, drawH, rx, ry);
  ctx.fillStyle = '#F3E2B3';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.save();
  ellipticalRRect(ctx, drawX, drawY, drawW, drawH, rx, ry);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  } else {
    ctx.fillStyle = '#4F2031';
    ctx.fillRect(drawX, drawY, drawW, drawH);
  }
  ctx.restore();

  // Optional tiny clean position badge (warm cream & gold, no harsh dark ring)
  if (badgeNum !== null && badgeNum !== undefined) {
    const br = Math.max(6.5, Math.min(8.5, drawW * 0.14));
    const bx = drawX + drawW / 2;
    const by = drawY + drawH + 1;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = '#FCF4DC';
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = 'rgba(138, 84, 20, 0.65)';
    ctx.stroke();

    ctx.fillStyle = COLORS.plum;
    ctx.font = `600 ${Math.round(br * 1.15)}px ${FONT_CINZEL}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(badgeNum), bx, by + 0.5);
  }

  ctx.restore();
}

/**
 * เฮดเดอร์สไตล์หน้าเว็บจริง (CARDCAPTOR SAKURA / CLOW CARDS + ชื่อผัง + วันที่)
 */
function drawSiteHeaderLockup(ctx, cx, topY, spreadTitle, dateStr, compact = false) {
  ctx.save();
  ctx.textBaseline = 'middle';

  const emblemR = compact ? 13 : 15;
  const subFontSize = compact ? 9.5 : 10.5;
  const titleFontSize = compact ? 18.5 : 21;

  // Measure title width to center emblem + brand block harmoniously
  ctx.font = `700 ${titleFontSize}px ${FONT_CINZEL}`;
  const titleW = ctx.measureText('CLOW CARDS').width;
  ctx.font = `600 ${subFontSize}px ${FONT_CINZEL}`;
  const subW = ctx.measureText('CARDCAPTOR SAKURA').width;
  const textW = Math.max(titleW, subW);
  const gap = 10;
  const totalBlockW = emblemR * 2 + gap + textW;
  const blockStartX = cx - totalBlockW / 2;

  drawClowStarEmblem(ctx, blockStartX + emblemR, topY + 17, emblemR);

  const textX = blockStartX + emblemR * 2 + gap;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(109, 59, 22, 0.90)';
  ctx.font = `600 ${subFontSize}px ${FONT_CINZEL}`;
  ctx.fillText('CARDCAPTOR SAKURA', textX, topY + 8);

  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 ${titleFontSize}px ${FONT_CINZEL}`;
  ctx.fillText('CLOW CARDS', textX, topY + 25);

  // Subtle horizontal divider
  ctx.strokeStyle = 'rgba(138, 84, 20, 0.36)';
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(cx - 140, topY + 42);
  ctx.lineTo(cx + 140, topY + 42);
  ctx.stroke();

  // Spread name & date-time
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.plum;
  ctx.font = `500 ${compact ? 15.5 : 18}px ${FONT_TRIRONG}`;
  ctx.fillText(spreadTitle, cx, topY + 59);

  ctx.fillStyle = COLORS.gold;
  ctx.font = `400 ${compact ? 10.5 : 11}px ${FONT_TRIRONG}`;
  ctx.fillText(dateStr, cx, topY + 76);

  ctx.restore();
  return topY + 90;
}

function drawFooterWatermark(ctx, cx, y) {
  const domain = getDynamicDomainLabel();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.strokeStyle = 'rgba(138, 84, 20, 0.30)';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(cx - 135, y - 15);
  ctx.lineTo(cx + 135, y - 15);
  ctx.stroke();

  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 10.5px ${FONT_CINZEL}`;
  ctx.fillText('✦  CARDCAPTOR SAKURA · CLOW CARDS  ✦', cx, y);

  ctx.fillStyle = COLORS.plum;
  ctx.font = `600 11px ${FONT_CINZEL}`;
  ctx.fillText(domain, cx, y + 15);

  ctx.restore();
}

/**
 * =========================================================================
 * RENDER 1: IG STORY (540×960 logical @ 2x DPR = 1080×1920 PNG)
 * แสดงผังไพ่จริงแบบไร้ขอบดำ + คำทำนายครบทุกใบอย่างสมดุล
 * =========================================================================
 */
export async function renderIgStoryCanvas(payload) {
  const { spread, placedSlots = [], readingResult = null, compatibilityData = null } = payload;

  // เฉพาะผังความเข้ากันได้: ใช้ฟอร์แมตเดียวกับภาพบันทึกฉบับเต็มเลย เพื่อความคมชัดและครบถ้วนเป็นมาตรฐานเดียวกัน
  if (spread && spread.spread_id === 'compatibility_52') {
    return renderFullSummaryCanvas(payload);
  }

  await ensureWebsiteFontsLoaded();

  const isEn = getCurrentLang() === 'en';
  const spreadId = spread.spread_id;
  const spreadTitle = getSpreadName(spread);
  const dateStr = formatReadingDate(isEn);

  const canvas = document.createElement('canvas');
  canvas.width = STORY_LW * DPR;
  canvas.height = STORY_LH * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const magicCircleImg = await loadImage(getMagicCircleUrl());
  const cardImgMap = new Map();

  if (spreadId === 'compatibility_52' && compatibilityData) {
    const list = [compatibilityData.leftCard, compatibilityData.rightCard].filter(Boolean);
    await Promise.all(list.map(async (c) => cardImgMap.set(c.id, await loadImage(getCardFrontUrl(c.driveKey)))));
  } else {
    await Promise.all(
      placedSlots.map(async (slot) => cardImgMap.set(slot.card.id, await loadImage(getCardFrontUrl(slot.card.driveKey))))
    );
  }

  // Safe Zones: Top 54px (108px real), Bottom 64px (128px real)
  const frame = drawGrimoireCanvasBackdrop(ctx, STORY_LW, STORY_LH, magicCircleImg, 18, 52, 62);
  const contentTop = drawSiteHeaderLockup(ctx, STORY_LW / 2, frame.fy + 16, spreadTitle, dateStr, true);
  const footerY = frame.fy + frame.fh - 26;
  const contentBottom = footerY - 22;
  const innerX = frame.fx + 18;
  const innerW = frame.fw - 36;

  // -----------------------------------------------------------------------
  // 1. DAILY READING (1 Card — Exact Website Popup Colors & 2-Box Style + Hero Card)
  // -----------------------------------------------------------------------
  if (spreadId === 'daily_single') {
    const slot = placedSlots[0];
    const card = slot ? slot.card : null;
    const img = card ? cardImgMap.get(card.id) : null;

    const conn = Array.isArray(readingResult?.connections) ? readingResult.connections[0] : null;
    const insight = cleanText((conn && conn.insight) || readingResult?.overview || '', isEn);
    const rawAdvice = Array.isArray(readingResult?.advice)
      ? readingResult.advice.join(' ')
      : String(readingResult?.advice || '');
    const advice = cleanText(isEn ? rawAdvice : rawAdvice.replace(/^ไพ่เหล่านี้ต้องการเตือนคุณว่า\s*/, ''), isEn);
    const closing = cleanText(readingResult?.closing || '', isEn);

    const tx = innerX + 14;
    const tw = innerW - 28;
    ctx.font = `300 13px ${FONT_TRIRONG}`;
    const insightLines = insight ? wrapText(ctx, insight, tw, isEn, 5) : [];
    const adviceLines = advice ? wrapText(ctx, advice, tw - 4, isEn, 3) : [];
    ctx.font = `500 13px ${FONT_TRIRONG}`;
    const closingLines = closing ? wrapText(ctx, `“${closing}”`, innerW - 20, isEn, 2) : [];

    const box1H = insightLines.length ? 34 + insightLines.length * 19.5 + 10 : 0;
    const box2H = adviceLines.length ? 32 + adviceLines.length * 19 + 10 : 0;
    const closingH = closingLines.length ? closingLines.length * 18.5 + 8 : 0;
    const totalTextH =
      box1H +
      (box1H && box2H ? 10 : 0) +
      box2H +
      (closingH ? 10 + closingH : 0);

    const availCardH = contentBottom - contentTop - (totalTextH ? totalTextH + 34 : 26);
    const cardH = Math.min(400, Math.max(275, availCardH));
    const cardW = Math.round(cardH * (10 / 22));
    const cardX = Math.round((STORY_LW - cardW) / 2);
    const cardY = Math.round(contentTop + Math.max(4, (availCardH - cardH) / 2));

    drawBorderlessCard(ctx, img, cardX, cardY, cardW, cardH);

    if (card) {
      ctx.save();
      ctx.fillStyle = COLORS.ink;
      ctx.font = `700 16.5px ${FONT_CINZEL}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.name, STORY_LW / 2, cardY + cardH + 17);
      ctx.restore();
    }

    let curY = contentBottom - totalTextH;

    // Box 1: Cream card reading box matching #reading-modal (bg-[#FCF4DC]/80 border-[#8A5414]/45)
    if (box1H > 0) {
      ctx.save();
      rrect(ctx, innerX, curY, innerW, box1H, 9);
      ctx.fillStyle = COLORS.boxFill;
      ctx.fill();
      ctx.strokeStyle = COLORS.boxStroke;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.plum;
      ctx.font = `400 12px ${FONT_TRIRONG}`;
      ctx.fillText(isEn ? '✦ Message for Today' : '✦ สารหลักประจำวัน', tx, curY + 18);

      ctx.fillStyle = COLORS.ink;
      ctx.font = `300 13px ${FONT_TRIRONG}`;
      insightLines.forEach((ln, idx) => {
        ctx.fillText(ln, tx, curY + 38 + idx * 19.5);
      });
      ctx.restore();
      curY += box1H + 10;
    }

    // Box 2: Mauve-tinted Guiding Message box matching #reading-modal (bg-[#8F5B6E]/12 border-l-4 border-[#4F2031])
    if (box2H > 0) {
      ctx.save();
      rrect(ctx, innerX, curY, innerW, box2H, 8);
      ctx.fillStyle = COLORS.plumTint;
      ctx.fill();

      rrect(ctx, innerX, curY, 4, box2H, 2);
      ctx.fillStyle = COLORS.plum;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.plum;
      ctx.font = `400 11.5px ${FONT_TRIRONG}`;
      ctx.fillText(isEn ? '☽ Guiding Message from the Card' : '☽ สารนำทางจากไพ่', innerX + 14, curY + 17);

      ctx.fillStyle = COLORS.ink;
      ctx.font = `300 12.5px ${FONT_TRIRONG}`;
      adviceLines.forEach((ln, idx) => {
        ctx.fillText(ln, innerX + 14, curY + 36 + idx * 19);
      });
      ctx.restore();
      curY += box2H + 10;
    }

    if (closingH > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.plum;
      ctx.font = `500 13px ${FONT_TRIRONG}`;
      closingLines.forEach((ln, idx) => {
        ctx.fillText(ln, STORY_LW / 2, curY + 10 + idx * 18.5);
      });
      ctx.restore();
    }
  }

  // -----------------------------------------------------------------------
  // 2. ROMANCE READING (7 Cards — Large Clear 7-Card Layout + Guiding Message Box)
  // -----------------------------------------------------------------------
  else if (spreadId === 'love_cross') {
    const rawAdvice = Array.isArray(readingResult?.advice)
      ? readingResult.advice.map((l) => String(l || '').trim()).filter(Boolean).join(' ')
      : String(readingResult?.advice || '').trim();
    const adviceText = cleanText(
      isEn ? rawAdvice : rawAdvice.replace(/^ไพ่เหล่านี้ต้องการเตือนคุณว่า\s*/, ''),
      isEn
    ) || cleanText(readingResult?.closing || '', isEn);

    const guideBoxH = adviceText ? 116 : 0;
    const spreadAvailH = contentBottom - contentTop - (guideBoxH ? guideBoxH + 14 : 0);
    const spreadAvailW = frame.fw - 20;

    const layoutCoords = [
      { pos: 1, col: 2, row: 0 },
      { pos: 4, col: 0, row: 1 },
      { pos: 6, col: 2, row: 1 },
      { pos: 3, col: 4, row: 1 },
      { pos: 2, col: 1, row: 2 },
      { pos: 5, col: 3, row: 2 },
      { pos: 7, col: 6, row: 2 }
    ];

    const gapX = 10;
    const gapY = 14;
    const maxCardW = Math.floor((spreadAvailW - gapX * 3) / 4);
    const maxCardH = Math.floor((spreadAvailH - gapY * 2 - 12) / 3);
    const cardW = Math.min(maxCardW, Math.floor(maxCardH * (10 / 22)));
    const cardH = Math.round(cardW * 2.18);

    const colUnit = (cardW + gapX) / 2;
    const totalW = 6 * colUnit + cardW;
    const totalH = 3 * cardH + 2 * gapY;
    const startX = Math.round((STORY_LW - totalW) / 2);
    const startY = Math.round(contentTop + (spreadAvailH - totalH) / 2);

    layoutCoords.forEach(({ pos, col, row }) => {
      const slot = placedSlots.find((s) => Number(s.posIndex) === pos);
      const img = slot ? cardImgMap.get(slot.card.id) : null;
      const x = Math.round(startX + col * colUnit);
      const y = Math.round(startY + row * (cardH + gapY));
      drawBorderlessCard(ctx, img, x, y, cardW, cardH, { badgeNum: pos });
    });

    if (adviceText) {
      const boxY = contentBottom - guideBoxH;
      ctx.save();
      rrect(ctx, innerX, boxY, innerW, guideBoxH, 10);
      ctx.fillStyle = COLORS.boxFill;
      ctx.fill();
      ctx.strokeStyle = COLORS.boxStroke;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      rrect(ctx, innerX, boxY, 4, guideBoxH, 2);
      ctx.fillStyle = COLORS.plum;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.plum;
      ctx.font = `400 12px ${FONT_TRIRONG}`;
      ctx.fillText(isEn ? '☽ Guiding Message from the Cards' : '☽ สารนำทางจากไพ่', innerX + 15, boxY + 21);

      ctx.fillStyle = COLORS.ink;
      ctx.font = `300 12.5px ${FONT_TRIRONG}`;
      const lines = wrapText(ctx, adviceText, innerW - 30, isEn, 4);
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, innerX + 15, boxY + 43 + idx * 19.5);
      });
      ctx.restore();
    }
  }

  // -----------------------------------------------------------------------
  // 3. GENERAL READING (10 Cards — Large Clear 6-Col Layout + Guiding Message Box)
  // -----------------------------------------------------------------------
  else if (spreadId === 'general_six') {
    const rawAdvice = Array.isArray(readingResult?.advice)
      ? readingResult.advice.map((l) => String(l || '').trim()).filter(Boolean).join(' ')
      : String(readingResult?.advice || '').trim();
    const adviceText = cleanText(
      isEn ? rawAdvice : rawAdvice.replace(/^ไพ่เหล่านี้ต้องการเตือนคุณว่า\s*/, ''),
      isEn
    ) || cleanText(readingResult?.closing || '', isEn);

    const guideBoxH = adviceText ? 116 : 0;
    const spreadAvailH = contentBottom - contentTop - (guideBoxH ? guideBoxH + 14 : 0);
    const spreadAvailW = frame.fw - 18;

    const gapX = 6;
    const gapY = 13;
    const maxCardW = Math.floor((spreadAvailW - gapX * 5) / 6);
    const maxCardH = Math.floor((spreadAvailH - gapY * 2 - 12) / 3);
    const cardW = Math.min(maxCardW, Math.floor(maxCardH * (10 / 22)));
    const cardH = Math.round(cardW * 2.18);

    const totalW = 6 * cardW + 5 * gapX;
    const totalH = 3 * cardH + 2 * gapY;
    const startX = Math.round((STORY_LW - totalW) / 2);
    const startY = Math.round(contentTop + (spreadAvailH - totalH) / 2);

    const cols = [
      { col: 0, items: [{ pos: 7, yOff: (totalH - cardH) / 2 }] },
      { col: 1, items: [{ pos: 3, yOff: (totalH - (2 * cardH + gapY)) / 2 }, { pos: 5, yOff: (totalH - (2 * cardH + gapY)) / 2 + cardH + gapY }] },
      { col: 2, items: [{ pos: 1, yOff: 0 }, { pos: 9, yOff: cardH + gapY }, { pos: 2, yOff: 2 * (cardH + gapY) }] },
      { col: 3, items: [{ pos: 4, yOff: (totalH - (2 * cardH + gapY)) / 2 }, { pos: 6, yOff: (totalH - (2 * cardH + gapY)) / 2 + cardH + gapY }] },
      { col: 4, items: [{ pos: 8, yOff: (totalH - cardH) / 2 }] },
      { col: 5, items: [{ pos: 10, yOff: totalH - cardH }] }
    ];

    cols.forEach(({ col, items }) => {
      const x = Math.round(startX + col * (cardW + gapX));
      items.forEach(({ pos, yOff }) => {
        const slot = placedSlots.find((s) => Number(s.posIndex) === pos);
        const img = slot ? cardImgMap.get(slot.card.id) : null;
        drawBorderlessCard(ctx, img, x, Math.round(startY + yOff), cardW, cardH, { badgeNum: pos });
      });
    });

    if (adviceText) {
      const boxY = contentBottom - guideBoxH;
      ctx.save();
      rrect(ctx, innerX, boxY, innerW, guideBoxH, 10);
      ctx.fillStyle = COLORS.boxFill;
      ctx.fill();
      ctx.strokeStyle = COLORS.boxStroke;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      rrect(ctx, innerX, boxY, 4, guideBoxH, 2);
      ctx.fillStyle = COLORS.plum;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.plum;
      ctx.font = `400 12px ${FONT_TRIRONG}`;
      ctx.fillText(isEn ? '☽ Guiding Message from the Cards' : '☽ สารนำทางจากไพ่', innerX + 15, boxY + 21);

      ctx.fillStyle = COLORS.ink;
      ctx.font = `300 12.5px ${FONT_TRIRONG}`;
      const lines = wrapText(ctx, adviceText, innerW - 30, isEn, 4);
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, innerX + 15, boxY + 43 + idx * 19.5);
      });
      ctx.restore();
    }
  }

  // -----------------------------------------------------------------------
  // 4. COMPATIBILITY READING (52 Cards)
  // -----------------------------------------------------------------------
  else if (spreadId === 'compatibility_52' && compatibilityData) {
    const { remain, tier, leftCard, rightCard, leftCauseText, rightAdviceText } = compatibilityData;

    const scoreBoxY = contentTop + 8;
    const scoreBoxH = 148;
    ctx.save();
    rrect(ctx, innerX, scoreBoxY, innerW, scoreBoxH, 12);
    ctx.fillStyle = COLORS.boxFill;
    ctx.fill();
    ctx.strokeStyle = COLORS.boxStroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    const starsCount = tier.stars || 3;
    const starSpacing = 30;
    const starStartX = STORY_LW / 2 - starSpacing * 2;
    ctx.font = `700 24px ${FONT_CINZEL}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < starsCount ? COLORS.goldStar : COLORS.goldStarMuted;
      ctx.fillText('✦', starStartX + i * starSpacing, scoreBoxY + 26);
    }

    ctx.fillStyle = COLORS.plum;
    ctx.font = `500 17px ${FONT_TRIRONG}`;
    ctx.fillText(tier.title, STORY_LW / 2, scoreBoxY + 56);

    const pillText = isEn ? `${remain} / 52 Cards Left` : `เหลือไพ่ ${remain} / 52 ใบ`;
    ctx.font = `400 11px ${FONT_TRIRONG}`;
    const pillW = Math.max(122, ctx.measureText(pillText).width + 24);
    rrect(ctx, STORY_LW / 2 - pillW / 2, scoreBoxY + 72, pillW, 22, 11);
    ctx.fillStyle = COLORS.pillFill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(138, 84, 20, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(pillText, STORY_LW / 2, scoreBoxY + 83);

    if (tier.desc) {
      ctx.fillStyle = COLORS.sepia;
      ctx.font = `300 11.5px ${FONT_TRIRONG}`;
      const descLines = wrapText(ctx, cleanText(tier.desc, isEn), innerW - 32, isEn, 2);
      descLines.forEach((ln, idx) => {
        ctx.fillText(ln, STORY_LW / 2, scoreBoxY + 111 + idx * 17);
      });
    }
    ctx.restore();

    // Two key cards side by side
    const areaTop = scoreBoxY + scoreBoxH + 16;
    const areaH = contentBottom - areaTop;

    if (leftCard) {
      const pairCount = rightCard && rightCard.id !== leftCard.id ? 2 : 1;
      const colGap = 14;
      const colW = pairCount === 2 ? (innerW - colGap) / 2 : innerW * 0.72;
      const startX = pairCount === 2 ? innerX : (STORY_LW - colW) / 2;

      const items =
        pairCount === 2
          ? [
              { card: leftCard, label: isEn ? '✦ Cause or Friction' : '✦ สาเหตุหรืออุปสรรค', text: cleanText(leftCauseText, isEn) },
              { card: rightCard, label: isEn ? '✦ Gentle Advice' : '✦ คำแนะนำการปรับตัว', text: cleanText(rightAdviceText, isEn) }
            ]
          : [{ card: leftCard, label: isEn ? '✦ Key Card' : '✦ ไพ่สำคัญ', text: cleanText(leftCauseText || rightAdviceText, isEn) }];

      const cardH = Math.min(256, areaH - 180);
      const cardW = Math.round(cardH * (10 / 22));

      items.forEach((item, idx) => {
        const bx = startX + idx * (colW + colGap);
        const cx = bx + colW / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = idx === 0 ? COLORS.plum : COLORS.gold;
        ctx.font = `400 12px ${FONT_TRIRONG}`;
        ctx.fillText(item.label, cx, areaTop + 10);

        const cy = areaTop + 24;
        drawBorderlessCard(ctx, cardImgMap.get(item.card.id), Math.round(cx - cardW / 2), cy, cardW, cardH, { radius: 6 });

        ctx.fillStyle = COLORS.ink;
        ctx.font = `700 11.5px ${FONT_CINZEL}`;
        ctx.fillText(item.card.name, cx, cy + cardH + 16);

        const txtBoxY = cy + cardH + 28;
        const txtBoxH = contentBottom - txtBoxY;
        rrect(ctx, bx, txtBoxY, colW, txtBoxH, 9);
        ctx.fillStyle = COLORS.boxFill;
        ctx.fill();
        ctx.strokeStyle = COLORS.boxStroke;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = COLORS.ink;
        ctx.font = `300 11px ${FONT_TRIRONG}`;
        const maxLn = Math.max(3, Math.floor((txtBoxH - 16) / 16.5));
        const lines = wrapText(ctx, item.text, colW - 18, isEn, maxLn);
        lines.forEach((ln, li) => {
          ctx.fillText(ln, bx + 9, txtBoxY + 16 + li * 16.5);
        });
        ctx.restore();
      });
    }
  }

  drawFooterWatermark(ctx, STORY_LW / 2, footerY);
  return canvas;
}

/**
 * =========================================================================
 * RENDER 2: FULL SUMMARY (672px logical @ 2x DPR = 1344×auto PNG)
 * สัดส่วนและฟอนต์เหมือนแคปหน้าจอจาก #reading-modal ของหน้าเว็บจริง 100%
 * =========================================================================
 */
export async function renderFullSummaryCanvas(payload) {
  const { spread, placedSlots = [], readingResult = null, compatibilityData = null } = payload;

  await ensureWebsiteFontsLoaded();

  const isEn = getCurrentLang() === 'en';
  const spreadId = spread.spread_id;
  const spreadTitle = getSpreadName(spread);
  const dateStr = formatReadingDate(isEn);

  const magicCircleImg = await loadImage(getMagicCircleUrl());
  const cardImgMap = new Map();

  if (spreadId === 'compatibility_52' && compatibilityData) {
    const list = [compatibilityData.leftCard, compatibilityData.rightCard].filter(Boolean);
    await Promise.all(list.map(async (c) => cardImgMap.set(c.id, await loadImage(getCardFrontUrl(c.driveKey)))));
  } else {
    await Promise.all(
      placedSlots.map(async (slot) => cardImgMap.set(slot.card.id, await loadImage(getCardFrontUrl(slot.card.driveKey))))
    );
  }

  // Logical measurement canvas matching user's portrait mobile width (3x DPR = zoom-proof)
  const FULL_LW = getDynamicFullLogicalWidth();
  const mCanvas = document.createElement('canvas');
  mCanvas.width = FULL_LW;
  mCanvas.height = 60;
  const mctx = mCanvas.getContext('2d');

  const framePad = 10;
  const innerPadX = framePad + 12;
  const boxW = FULL_LW - innerPadX * 2;
  const thumbW = 54; // sleek compact mobile proportion matching text block height
  const thumbH = Math.round(thumbW * 2.18); // ~118px
  const textXOff = thumbW + 10;
  const textMaxW = boxW - textXOff - 18;
  const bodySize = 12.5;
  const bodyLineH = 19.5;

  const blocks = [];
  let cursorY = 120;

  if (spreadId === 'compatibility_52' && compatibilityData) {
    const { remain, tier, leftCard, rightCard, leftCauseText, rightAdviceText } = compatibilityData;

    mctx.font = `300 ${bodySize}px ${FONT_TRIRONG}`;
    const descLines = wrapText(mctx, cleanText(tier.desc, isEn), boxW - 32, isEn);
    const tierH = 102 + descLines.length * bodyLineH + 14;
    blocks.push({ type: 'compat_tier', y: cursorY, h: tierH, tier, remain, descLines });
    cursorY += tierH + 10;

    const pairs = [];
    if (leftCard) {
      pairs.push({
        label: isEn ? '✦ Cause or Friction' : '✦ สาเหตุหรืออุปสรรค',
        card: leftCard,
        text: cleanText(leftCauseText, isEn)
      });
    }
    if (rightCard && (!leftCard || rightCard.id !== leftCard.id)) {
      pairs.push({
        label: isEn ? '✦ Gentle Advice' : '✦ คำแนะนำการปรับตัว',
        card: rightCard,
        text: cleanText(rightAdviceText, isEn)
      });
    }

    for (const item of pairs) {
      mctx.font = `300 ${bodySize}px ${FONT_TRIRONG}`;
      const lines = wrapText(mctx, item.text, textMaxW, isEn);
      const textBlockH = 38 + lines.length * bodyLineH;
      const h = Math.max(thumbH + 20, textBlockH + 22);
      blocks.push({ type: 'card_row', y: cursorY, h, posLabel: item.label, cardName: item.card.name, posTitle: '', card: item.card, lines });
      cursorY += h + 9;
    }
  } else {
    const sorted = [...placedSlots].sort((a, b) => a.posIndex - b.posIndex);
    const connections = Array.isArray(readingResult?.connections) ? readingResult.connections : [];

    for (let i = 0; i < sorted.length; i++) {
      const slot = sorted[i];
      const posMeta = spread.positions.find((p) => Number(p.index) === Number(slot.posIndex));
      const posTitle = posMeta ? getPosTitle(spreadId, posMeta) : '';
      const conn =
        connections.find((c) => Number(c.positionIndex) === Number(slot.posIndex)) || connections[i] || null;
      const insight = cleanText((conn && conn.insight) || (i === 0 ? readingResult?.overview : '') || '', isEn);

      mctx.font = `300 ${bodySize}px ${FONT_TRIRONG}`;
      const lines = wrapText(mctx, insight, textMaxW, isEn);
      const posLabel =
        spreadId === 'daily_single'
          ? `✦ ${posTitle || (isEn ? 'Message for Today' : 'สารหลักประจำวัน')}`
          : isEn
            ? `✦ No. ${slot.posIndex}`
            : `✦ ลำดับที่ ${slot.posIndex}`;
      const subTitle = spreadId === 'daily_single' ? '' : posTitle;
      const headerH = subTitle ? 36 : 20;
      const h = Math.max(thumbH + 18, headerH + lines.length * bodyLineH + 18);

      blocks.push({
        type: 'card_row',
        y: cursorY,
        h,
        posLabel,
        cardName: slot.card.name,
        posTitle: subTitle,
        card: slot.card,
        lines
      });
      cursorY += h + 9;
    }

    // Guiding Message box matching website
    const rawAdvice = Array.isArray(readingResult?.advice)
      ? readingResult.advice.map((l) => String(l || '').trim()).filter(Boolean).join(' ')
      : String(readingResult?.advice || '').trim();
    const advice = cleanText(isEn ? rawAdvice : rawAdvice.replace(/^ไพ่เหล่านี้ต้องการเตือนคุณว่า\s*/, ''), isEn);
    if (advice) {
      mctx.font = `300 ${bodySize}px ${FONT_TRIRONG}`;
      const lines = wrapText(mctx, advice, boxW - 28, isEn);
      const h = 34 + lines.length * bodyLineH + 12;
      blocks.push({
        type: 'advice',
        y: cursorY,
        h,
        title: isEn ? '☽ Guiding Message from the Cards' : '☽ สารนำทางจากไพ่',
        lines
      });
      cursorY += h + 10;
    }

    const closing = cleanText(readingResult?.closing || '', isEn);
    if (closing) {
      mctx.font = `500 13.5px ${FONT_TRIRONG}`;
      const lines = wrapText(mctx, `“${closing}”`, boxW - 20, isEn);
      const h = lines.length * 20 + 8;
      blocks.push({ type: 'closing', y: cursorY, h, lines });
      cursorY += h + 8;
    }
  }

  const totalLH = cursorY + 62;
  const canvas = document.createElement('canvas');
  canvas.width = FULL_LW * FULL_DPR;
  canvas.height = totalLH * FULL_DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(FULL_DPR, FULL_DPR);

  const frame = drawGrimoireCanvasBackdrop(ctx, FULL_LW, totalLH, magicCircleImg, framePad, framePad, framePad);
  drawSiteHeaderLockup(ctx, FULL_LW / 2, frame.fy + 12, spreadTitle, dateStr, true);

  for (const b of blocks) {
    if (b.type === 'compat_tier') {
      ctx.save();
      rrect(ctx, innerPadX, b.y, boxW, b.h, 10);
      ctx.fillStyle = COLORS.boxFill;
      ctx.fill();
      ctx.strokeStyle = COLORS.boxStroke;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      const starsCount = b.tier.stars || 3;
      const starSpacing = 26;
      const starStartX = FULL_LW / 2 - starSpacing * 2;
      ctx.font = `700 22px ${FONT_CINZEL}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < starsCount ? COLORS.goldStar : COLORS.goldStarMuted;
        ctx.fillText('✦', starStartX + i * starSpacing, b.y + 23);
      }

      ctx.fillStyle = COLORS.plum;
      ctx.font = `500 16px ${FONT_TRIRONG}`;
      ctx.fillText(b.tier.title, FULL_LW / 2, b.y + 50);

      ctx.fillStyle = COLORS.gold;
      ctx.font = `400 11px ${FONT_TRIRONG}`;
      const rangeLine = isEn
        ? `Remaining cards: ${b.remain} (${b.tier.range})`
        : `เหลือไพ่ทั้งหมด ${b.remain} ใบ (ช่วง ${b.tier.range})`;
      ctx.fillText(rangeLine, FULL_LW / 2, b.y + 71);

      ctx.fillStyle = COLORS.sepia;
      ctx.font = `300 ${bodySize}px ${FONT_TRIRONG}`;
      b.descLines.forEach((ln, idx) => {
        ctx.fillText(ln, FULL_LW / 2, b.y + 96 + idx * bodyLineH);
      });
      ctx.restore();
    } else if (b.type === 'card_row') {
      ctx.save();
      rrect(ctx, innerPadX, b.y, boxW, b.h, 9);
      ctx.fillStyle = COLORS.boxFill;
      ctx.fill();
      ctx.strokeStyle = COLORS.boxStroke;
      ctx.lineWidth = 0.85;
      ctx.stroke();

      const imgX = innerPadX + 10;
      const imgY = Math.round(b.y + (b.h - thumbH) / 2);
      drawBorderlessCard(ctx, cardImgMap.get(b.card.id), imgX, imgY, thumbW, thumbH, { radius: 4.5 });

      const tx = innerPadX + 10 + textXOff;
      const textTotalH = (b.posTitle ? 34 : 18) + b.lines.length * bodyLineH;
      let ty = Math.round(b.y + Math.max(16, (b.h - textTotalH) / 2 + 6));

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // Row 1: Position No. (gold Trirong) + Card Name (bold Cinzel)
      ctx.fillStyle = COLORS.gold;
      ctx.font = `400 11px ${FONT_TRIRONG}`;
      ctx.fillText(b.posLabel, tx, ty);
      const labelW = ctx.measureText(b.posLabel).width;

      ctx.fillStyle = COLORS.ink;
      ctx.font = `700 11px ${FONT_CINZEL}`;
      ctx.fillText(b.cardName, tx + labelW + 5, ty);
      ty += 16;

      if (b.posTitle) {
        ctx.fillStyle = COLORS.plum;
        ctx.font = `400 11.5px ${FONT_TRIRONG}`;
        ctx.fillText(b.posTitle, tx, ty);
        ty += 19;
      } else {
        ty += 5;
      }

      ctx.fillStyle = COLORS.ink;
      ctx.font = `300 ${bodySize}px ${FONT_TRIRONG}`;
      b.lines.forEach((ln) => {
        ctx.fillText(ln, tx, ty);
        ty += bodyLineH;
      });
      ctx.restore();
    } else if (b.type === 'advice') {
      ctx.save();
      rrect(ctx, innerPadX, b.y, boxW, b.h, 8);
      ctx.fillStyle = COLORS.plumTint;
      ctx.fill();

      rrect(ctx, innerPadX, b.y, 3.5, b.h, 2);
      ctx.fillStyle = COLORS.plum;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.plum;
      ctx.font = `400 11.5px ${FONT_TRIRONG}`;
      ctx.fillText(b.title, innerPadX + 13, b.y + 17);

      ctx.fillStyle = COLORS.ink;
      ctx.font = `300 ${bodySize}px ${FONT_TRIRONG}`;
      b.lines.forEach((ln, idx) => {
        ctx.fillText(ln, innerPadX + 13, b.y + 36 + idx * bodyLineH);
      });
      ctx.restore();
    } else if (b.type === 'closing') {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.plum;
      ctx.font = `500 13.5px ${FONT_TRIRONG}`;
      b.lines.forEach((ln, idx) => {
        ctx.fillText(ln, FULL_LW / 2, b.y + 10 + idx * 20);
      });
      ctx.restore();
    }
  }

  drawFooterWatermark(ctx, FULL_LW / 2, totalLH - 36);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
