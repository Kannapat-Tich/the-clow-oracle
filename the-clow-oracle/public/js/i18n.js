/**
 * THE CLOW — ระบบสลับภาษา (Thai / English)
 * ครอบคลุมทุกหน้าจอ ผังไพ่ ขั้นตอนพิธีกรรม แท่นวางไพ่ และป็อปอัปคำทำนาย
 */

const LANG_STORAGE_KEY = 'clow_ui_lang';

const SPREAD_EN = {
  daily_single: {
    name: 'Daily Reading',
    purpose: 'Draw 1 card to receive your guiding message for today.',
    questionPlaceholder: 'Optional: share what is on your mind today (work, study, love, or decisions)...',
    positions: {
      1: { title: 'Daily Guidance', meaning: 'Core energy and direction to hold onto today' }
    }
  },
  love_cross: {
    name: 'Romance & Heart Cross',
    purpose: 'A 5-card cross revealing inner feelings, mutual perspectives, obstacles, and relationship direction.',
    questionPlaceholder: 'Optional: describe your relationship situation or feelings you wish to ask about...',
    positions: {
      1: { title: 'Heart of the Situation', meaning: 'The core truth of the relationship right now' },
      2: { title: 'Inner Feelings', meaning: 'What you deeply desire or keep hidden inside' },
      3: { title: 'The Other Perspective', meaning: 'Attitude and energy from the person on your mind' },
      4: { title: 'Tests & Obstacles', meaning: 'Challenges to watch out for or heal together' },
      5: { title: 'Outcome & Advice', meaning: 'Near-future direction for the relationship' }
    }
  },
  general_six: {
    name: 'General & Future Destiny',
    purpose: 'A 6-card spread exploring past roots, present stance, hidden support, cautions, decisions, and final outcome.',
    questionPlaceholder: 'Optional: share a situation about work, study, finances, or an important decision...',
    positions: {
      1: { title: 'Past Foundation', meaning: 'Past events shaping your present situation' },
      2: { title: 'Present Situation', meaning: 'Where you stand and what surrounds you now' },
      3: { title: 'Hidden Support', meaning: 'Unseen allies or quiet opportunities helping you' },
      4: { title: 'Points of Caution', meaning: 'Obstacles or carelessness to avoid' },
      5: { title: 'Key Decision', meaning: 'The turning-point action that improves things' },
      6: { title: 'Final Outcome', meaning: 'Where things lead if you follow the guidance' }
    }
  }
};

const DICT = {
  th: {
    navHome: 'หน้าหลัก',
    heroTitle: 'เปิดตำราพยากรณ์ไพ่โคลว์การ์ด',
    heroSub: 'สำรวมจิตให้นิ่งดั่งเปลวเทียน นึกถึงคำถามที่ปรารถนาคำตอบ แล้วเลือกผังวางไพ่ตามคัมภีร์ทั้ง 52 ใบ',
    btnShuffleNew: '↻ สับไพ่ใหม่',
    boardTitle: 'แท่นวางไพ่พยากรณ์ (เปิดตามลำดับคู่มือ)',
    stepperQuestion: 'ฝากคำถาม (ข้ามได้)',
    stepperShuffle: 'สับไพ่',
    stepperShuffleAlt: 'สับสำรับไพ่',
    stepperCut: 'ตัดกองไพ่',
    stepperDraw: 'เลือกไพ่',
    questionTitle: 'ตั้งจิตและบอกเล่าเรื่องราว (ข้ามได้)',
    questionSub: 'การเรียบเรียงเรื่องราวหรือคำถามที่อยู่ในใจให้ชัดเจน จะช่วยให้คำทำนายเชื่อมโยงกับสิ่งที่คุณอยากรู้ได้ตรงจุดมากขึ้น',
    questionLabel: '✦ ฝากคำถามหรือเล่าเรื่องราวที่ต้องการให้ไพ่ชี้แนะ <span class="text-[#8A5414]">(ไม่บังคับ · ข้ามได้)</span>',
    privacyTitle: 'การคุ้มครองข้อมูลส่วนบุคคลและความลับของคุณ',
    privacyBody: 'ข้อความของคุณอยู่ในอุปกรณ์ของคุณเท่านั้น หากหลังเปิดไพ่คุณเลือกกดปุ่ม <strong>"ให้ AI ช่วยตีความ"</strong> ระบบจะส่งเฉพาะคำถามและชื่อไพ่ไปประมวลผลแบบชั่วคราว <strong>ไม่มีการบันทึกลงฐานข้อมูลและไม่เก็บประวัติส่วนตัว</strong>',
    aiNoteDefault: '✦ ระบบมี 2 รูปแบบ: <strong>AI วิเคราะห์เรื่องราวของคุณโดยตรง</strong> และ <strong>คำทำนายจากตำราโคลว์</strong> (หากโควตา AI ช่วงนั้นเต็ม ระบบจะสลับใช้ตำราโคลว์ให้อัตโนมัติ)',
    btnSkipQuestion: 'ข้ามขั้นตอนนี้ (อธิษฐานในใจ) →',
    btnSubmitQuestion: '✦ บันทึกคำถามลงจิต · ไปสับไพ่',
    shuffleTitle: 'ตั้งจิตและสับสำรับไพ่',
    shuffleSub: 'การสับไพ่คือการรวบรวมสมาธิและฝากคำถามลงสู่สำรับ แตะที่กองไพ่ซ้ำๆ จนกว่าจะรู้สึกพร้อม',
    btnShuffleDeck: '↻ สับสำรับไพ่',
    btnProceedCut: '✦ พอใจแล้ว · ไปตัดกองไพ่',
    btnProceedDraw: '✦ พอใจแล้ว · ไปเลือกไพ่',
    cutTitle: 'ตัดแบ่งครึ่งกองไพ่',
    cutSub: 'การตัดไพ่คือการปิดรับคำถามและรวมพลังสมาธิ แตะที่กองไพ่เพื่อแบ่งครึ่งสำรับและสลับวางซ้อนกันก่อนเปิดไพ่',
    btnCutDeck: '✦ ตัดแบ่งครึ่งกองไพ่',
    drawTitle: 'เลือกไพ่จากสำรับ',
    drawHintDefault: 'ใช้ความรู้สึกแวบแรก แตะเลือกใบที่สะดุดตาที่สุดจากสำรับ 52 ใบ',
    drawHintHover: 'แตะไพ่ครั้งแรกเพื่อยกขึ้น แล้วแตะซ้ำอีกครั้งเพื่อยืนยันเลือก',
    drawHintConfirm: '✦ แตะไพ่ใบเดิมอีกครั้งเพื่อยืนยันการเลือก',
    btnQuickDraw: '✦ ให้โชคชะตาเลือกให้ 1 ใบ',
    btnConfirmArmed: '✦ คลิกเพื่อเลือก',
    boardHintChoose: 'เลือกไพ่จากกองด้านบนเพื่อวางลงตำแหน่ง',
    boardHintDone: 'เปิดเผยไพ่ครบทุกตำแหน่งแล้ว',
    boardGuideDefault: 'เชื่อในความรู้สึกแวบแรกแล้วแตะเลือกไพ่ใบที่สะดุดตาที่สุดโดยไม่ต้องลังเล',
    slotWaiting: 'รอวางไพ่',
    slotEmpty: 'ตำแหน่งว่าง',
    slotWaitAll: 'รอเลือกให้ครบ',
    slotFaceDown: 'คว่ำหน้า',
    btnRevealAll: '✦ เปิดไพ่ทั้งหมดและดูบทสรุป',
    summaryCtaTitle: '✦ เปิดอ่านไพ่ครบทุกตำแหน่งแล้ว',
    summaryCtaSub: 'ชมบทสรุปคำทำนายรวมทุกใบ',
    btnFullSummary: '✦ อ่านบทสรุปคำทำนายรวม',
    drawNoticeTitle: 'คลี่ไพ่ครบทั้ง 52 ใบแล้ว',
    drawNoticeBody: 'โปรดสำรวมจิตและเลือกไพ่คว่ำใบที่ท่านรู้สึก<strong>ถูกชะตา</strong>หรือสะดุดตาที่สุดในความรู้สึกแวบแรก',
    drawNoticeWarnTitle: '⚠ เลือกแล้วไม่สามารถเปลี่ยนใบใหม่ได้',
    drawNoticeWarnBody: 'เมื่อแตะเลือกไพ่แล้ว หากต้องการเปลี่ยนจะต้องกดเริ่มสับไพ่ใหม่ตั้งแต่ต้น',
    btnConfirmDrawNotice: '✦ เข้าใจแล้ว · เริ่มเลือกไพ่',
    btnCloseModal: 'ปิดหน้าต่าง ✕',
    singleCardReadingHeader: '✦ คำทำนายตามตำแหน่งนี้',
    singleCardWarningHeader: '☽ ไพ่ต้องการเตือนคุณว่า',
    btnViewSummarySmall: 'ดูบทสรุปคำทำนาย',
    summaryHeader: 'บทสรุปคำพยากรณ์',
    summaryOverviewHeader: '✦ ภาพรวมคำทำนาย',
    summaryWarningHeader: '☽ ไพ่เหล่านี้ต้องการเตือนคุณว่า',
    btnShareSummary: '✦ แชร์ / บันทึกคำทำนาย',
    modeNoteLive: '✦ เรียบเรียงคำทำนายเฉพาะเรื่องราวของคุณด้วย AI',
    modeNoteDemo: '✦ สรุปคำทำนายจากตำราโคลว์ (โหมดสำรองเมื่อใช้งานออฟไลน์หรือโควตา AI เต็มชั่วคราว)',
    bgmLabel: 'เพลง: ',
    bgmOn: 'เปิด',
    bgmOff: 'ปิด'
  },
  en: {
    navHome: 'Home',
    heroTitle: 'Open the Ancient Clow Card Grimoire',
    heroSub: 'Quiet your mind like a steady candle flame, focus on your question, and choose a 52-card spread.',
    btnShuffleNew: '↻ Reshuffle',
    boardTitle: 'Oracle Spread Board (Reveal in Order)',
    stepperQuestion: 'Question (Optional)',
    stepperShuffle: 'Shuffle',
    stepperShuffleAlt: 'Shuffle Deck',
    stepperCut: 'Cut Deck',
    stepperDraw: 'Choose Cards',
    questionTitle: 'Focus Your Mind & Share Context (Optional)',
    questionSub: 'Putting your thoughts or question into words helps tailor the interpretation more closely to your situation.',
    questionLabel: '✦ Share your question or situation <span class="text-[#8A5414]">(Optional · Skippable)</span>',
    privacyTitle: 'Your Privacy & Confidentiality',
    privacyBody: 'Your text stays on your device. When you view the summary, only your question and drawn card names are processed temporarily — <strong>never saved to any database or personal history</strong>.',
    aiNoteDefault: '✦ Two reading modes: <strong>Personalized AI interpretation</strong> and <strong>Clow Guidebook synthesis</strong> (automatically switches to the guidebook if AI quota is temporarily full).',
    btnSkipQuestion: 'Skip (Keep in Mind) →',
    btnSubmitQuestion: '✦ Focus Question · Shuffle',
    shuffleTitle: 'Focus & Shuffle the Deck',
    shuffleSub: 'Tap the deck repeatedly while holding your intention until you feel ready to proceed.',
    btnShuffleDeck: '↻ Shuffle Deck',
    btnProceedCut: '✦ Ready · Cut the Deck',
    btnProceedDraw: '✦ Ready · Choose Cards',
    cutTitle: 'Cut the Deck in Half',
    cutSub: 'Tap the deck to split it into two halves and restack them with focused intention before drawing.',
    btnCutDeck: '✦ Cut the Deck',
    drawTitle: 'Choose Your Cards',
    drawHintDefault: 'Trust your first instinct and select the card that catches your eye from the 52-card spread.',
    drawHintHover: 'Tap once to lift a card, then tap it again to confirm your choice.',
    drawHintConfirm: '✦ Tap the same card again to confirm selection',
    btnQuickDraw: '✦ Let Fate Pick 1 Card',
    btnConfirmArmed: '✦ Click to Confirm',
    boardHintChoose: 'Choose cards above to place them onto the board',
    boardHintDone: 'All positions have been revealed',
    boardGuideDefault: 'Trust your intuition and select the card that draws your attention.',
    slotWaiting: 'Next Slot',
    slotEmpty: 'Empty Slot',
    slotWaitAll: 'Draw all first',
    slotFaceDown: 'Face Down',
    btnRevealAll: '✦ Reveal All & View Summary',
    summaryCtaTitle: '✦ All cards have been revealed',
    summaryCtaSub: 'View your complete reading summary',
    btnFullSummary: '✦ View Full Reading Summary',
    drawNoticeTitle: 'All 52 Cards Are Spread',
    drawNoticeBody: 'Quiet your mind and follow your intuition to select the face-down card that calls to you.',
    drawNoticeWarnTitle: '⚠ Cards cannot be changed once selected',
    drawNoticeWarnBody: 'If you wish to pick different cards, you will need to click Reshuffle to start over.',
    btnConfirmDrawNotice: '✦ Understood · Start Choosing',
    btnCloseModal: 'Close ✕',
    singleCardReadingHeader: '✦ Position Interpretation',
    singleCardWarningHeader: '☽ Card Caution',
    btnViewSummarySmall: 'View Summary',
    summaryHeader: 'Oracle Reading Summary',
    summaryOverviewHeader: '✦ Reading Overview',
    summaryWarningHeader: '☽ These cards caution you',
    btnShareSummary: '✦ Share / Save Summary',
    modeNoteLive: '✦ Personalized interpretation crafted for your story with AI',
    modeNoteDemo: '✦ Clow Guidebook synthesis (offline preview or temporary AI quota fallback)',
    bgmLabel: 'Music: ',
    bgmOn: 'On',
    bgmOff: 'Off'
  }
};

export function getCurrentLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === 'en' ? 'en' : 'th';
  } catch (_) {
    return 'th';
  }
}

export function t(key) {
  const lang = getCurrentLang();
  return (DICT[lang] && DICT[lang][key]) || DICT.th[key] || key;
}

export function getSpreadName(spread) {
  if (!spread) return '';
  if (getCurrentLang() === 'en' && SPREAD_EN[spread.spread_id]) {
    return SPREAD_EN[spread.spread_id].name;
  }
  return spread.name;
}

export function getSpreadPurpose(spread) {
  if (!spread) return '';
  if (getCurrentLang() === 'en' && SPREAD_EN[spread.spread_id]) {
    return SPREAD_EN[spread.spread_id].purpose;
  }
  return spread.purpose;
}

export function getSpreadPlaceholder(spread) {
  if (!spread) return '';
  if (getCurrentLang() === 'en' && SPREAD_EN[spread.spread_id]) {
    return SPREAD_EN[spread.spread_id].questionPlaceholder;
  }
  return spread.questionPlaceholder;
}

export function getPosTitle(spreadId, pos) {
  if (!pos) return '';
  if (getCurrentLang() === 'en' && SPREAD_EN[spreadId]?.positions?.[pos.index]) {
    return SPREAD_EN[spreadId].positions[pos.index].title;
  }
  return pos.title;
}

export function getPosMeaning(spreadId, pos) {
  if (!pos) return '';
  if (getCurrentLang() === 'en' && SPREAD_EN[spreadId]?.positions?.[pos.index]) {
    return SPREAD_EN[spreadId].positions[pos.index].meaning;
  }
  return pos.meaning;
}

export function applyLanguage(lang) {
  const safeLang = lang === 'en' ? 'en' : 'th';
  try {
    localStorage.setItem(LANG_STORAGE_KEY, safeLang);
  } catch (_) {}

  document.documentElement.lang = safeLang;

  const langBtn = document.getElementById('btn-lang-toggle');
  if (langBtn) {
    langBtn.textContent = safeLang === 'en' ? 'EN / ไทย' : 'ไทย / EN';
    langBtn.title = safeLang === 'en' ? 'Switch to Thai' : 'Switch to English';
  }

  const mapText = [
    ['#btn-home', 'navHome'],
    ['#screen-select h1', 'heroTitle'],
    ['#screen-select header p', 'heroSub'],
    ['#btn-shuffle', 'btnShuffleNew'],
    ['#board-area > div:first-child span.font-fahkwang', 'boardTitle'],
    ['#ritual-question-stage button[onclick="skipQuestionStep()"]', 'btnSkipQuestion'],
    ['#ritual-question-stage button[onclick="submitQuestionStep()"]', 'btnSubmitQuestion'],
    ['#btn-shuffle-action', 'btnShuffleDeck'],
    ['#btn-trigger-cut', 'btnCutDeck'],
    ['#btn-quick-draw', 'btnQuickDraw'],
    ['#btn-confirm-armed-card', 'btnConfirmArmed'],
    ['#board-reveal-all-footer button', 'btnRevealAll'],
    ['#board-summary-cta > div p:first-child', 'summaryCtaTitle'],
    ['#board-summary-cta > div p:last-child', 'summaryCtaSub'],
    ['#board-summary-cta button', 'btnFullSummary'],
    ['#draw-notice-title', 'drawNoticeTitle'],
    ['#btn-confirm-draw-notice', 'btnConfirmDrawNotice'],
    ['#reading-modal button[onclick="closeReadingModal()"]', 'btnCloseModal'],
    ['#btn-share-summary', 'btnShareSummary']
  ];

  mapText.forEach(([sel, key]) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = t(key);
  });

  const mapHtml = [
    ['#ritual-question-stage label[for="user-question-input"]', 'questionLabel'],
    ['#draw-notice-modal > div > p', 'drawNoticeBody']
  ];
  mapHtml.forEach(([sel, key]) => {
    const el = document.querySelector(sel);
    if (el) el.innerHTML = t(key);
  });
}

export function toggleLanguage() {
  const next = getCurrentLang() === 'th' ? 'en' : 'th';
  applyLanguage(next);
  return next;
}
