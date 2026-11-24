/**
 * THE CLOW — ระบบสลับภาษา (Thai / English)
 * ครอบคลุมทุกหน้าจอ ผังไพ่ ขั้นตอนพิธีกรรม แท่นวางไพ่ และป็อปอัปคำทำนาย
 * English tone: warm, graceful, and clear (accessible A2–B1+ everyday English)
 */

const LANG_STORAGE_KEY = 'clow_ui_lang';

const SPREAD_EN = {
  daily_single: {
    name: 'Daily Reading',
    topicTags: ['Today’s Outlook', 'Daily Rhythm', 'Gentle Caution'],
    purpose: 'Draw one card to receive a gentle guiding message for your day (best enjoyed in the morning to set a calm, clear tone).',
    questionPlaceholder: 'Optional: share what is on your mind today (work, study, love, or a small decision)...',
    positions: {
      1: { title: 'Message for Today', meaning: 'The main energy and direction to keep close today' }
    }
  },
  love_cross: {
    name: 'Romance Reading',
    topicTags: ['Crush', 'Dating', 'Partner · Couple'],
    purpose: 'A 7-card spread showing their true nature, your past, present, future, obstacle, outcome, and advice.',
    ritualNoticeTitle: 'Set Your Intention Before Reading',
    ritualNoticeBody: 'Close your eyes for a quiet moment and <span class="text-[#9F1239]">picture the face or name of the person you love or like</span> as you shuffle, cut, and choose your cards.',
    ritualNoticeTip: 'Wearing something pink or keeping pink flowers nearby is said to brighten the gentle energy of love.',
    questionPlaceholder: 'Optional: tell us about your feelings, your crush, or the relationship you wish to ask about...',
    positions: {
      1: { title: 'Their True Nature', meaning: 'The personality and heart of the person you like or love' },
      2: { title: 'Your Shared Past', meaning: 'The moments and feelings that shaped you two before now' },
      3: { title: 'The Present Moment', meaning: 'Where your connection stands right now' },
      4: { title: 'Near Future', meaning: 'How your story together is likely to unfold next' },
      5: { title: 'Obstacle to Overcome', meaning: 'The challenge to gently work through so you grow closer' },
      6: { title: 'Romantic Outcome', meaning: 'Where this love story is heading' },
      7: { title: 'Advice for Love', meaning: 'Warm, practical guidance to help your bond bloom' }
    }
  },
  general_six: {
    name: 'General Reading',
    topicTags: ['Work', 'Study', 'Finances', 'Decisions'],
    purpose: 'A 10-card spread looking closely at the heart of your matter, its cause, past, surroundings, solution, key, obstacle, future, and result.',
    questionPlaceholder: 'Optional: share a question about work, study, money, or an important choice on your mind...',
    positions: {
      1: { title: 'Heart of the Matter', meaning: 'The core theme of the situation you are asking about' },
      2: { title: 'Root Cause', meaning: 'What quietly led to this situation' },
      3: { title: 'Past Influence', meaning: 'Earlier moments still connected to this matter' },
      4: { title: 'Around You Now', meaning: 'The people and environment surrounding you' },
      5: { title: 'Path to a Solution', meaning: 'A clear way forward to ease the situation' },
      6: { title: 'Key Turning Point', meaning: 'The key idea or habit that unlocks the answer' },
      7: { title: 'Obstacle Ahead', meaning: 'What to watch out for along the way' },
      8: { title: 'Future Direction', meaning: 'How things are likely to move next' },
      9: { title: 'Final Outcome', meaning: 'The destination this path leads toward' },
      10: { title: 'Others’ View & Long Term', meaning: 'How people see this and what it means in the long run' }
    }
  },
  compatibility_52: {
    name: 'Compatibility Reading',
    topicTags: ['Friends', 'Crush · Partner', 'Coworkers', 'Family'],
    purpose: 'Uses all 52 cards to pair matching suits placed side by side, measuring how well two people click—plus cards for cause and advice.',
    ritualNoticeTitle: 'Set Your Intention for Compatibility',
    ritualNoticeBody: 'Take a calm breath and <span class="text-[#9F1239]">picture the faces or names of the two people</span> (you and someone else, or any two people) as you shuffle and cut the deck.',
    ritualNoticeTip: 'All 52 cards will open and automatically pair matching suits placed side by side. The fewer cards left, the stronger the harmony.',
    questionPlaceholder: 'Optional: share who you are checking compatibility for (a friend, partner, crush, or coworker)...',
    positions: {
      1: { title: 'Leftmost Card · Cause or Friction', meaning: 'What may create distance or misunderstanding between you two' },
      2: { title: 'Rightmost Card · Gentle Advice', meaning: 'A thoughtful way to build smoother understanding together' }
    }
  }
};

const DICT = {
  th: {
    pageTitle: 'The Clow Cardcaptor Sakura — ทำนายไพ่ซากุระ',
    headerSubtitle: '— คัมภีร์พยากรณ์ไพ่ (52 ใบ)',
    navHome: 'หน้าหลัก',
    heroTitle: 'เปิดตำราพยากรณ์ไพ่โคลว์การ์ด',
    heroSub: 'สำรวมจิตให้นิ่งดั่งเปลวเทียน นึกถึงคำถามที่ปรารถนาคำตอบ แล้วเลือกผังวางไพ่ตามคัมภีร์ทั้ง 52 ใบ',
    btnShuffleNew: '↻ สับไพ่ใหม่',
    boardTitle: 'แท่นวางไพ่โคลว์การ์ด (เปิดตามลำดับ)',
    stepperQuestion: 'ฝากคำถาม (ข้ามได้)',
    stepperShuffle: 'สับไพ่',
    stepperShuffleAlt: 'สับสำรับไพ่',
    stepperCut: 'ตัดกองไพ่',
    stepperDraw: 'เลือกไพ่',
    questionTitle: 'ตั้งจิตและบอกเล่าเรื่องราว (ข้ามได้)',
    questionSub: 'การเรียบเรียงเรื่องราวหรือคำถามที่อยู่ในใจให้ชัดเจน จะช่วยให้คำทำนายเชื่อมโยงกับสิ่งที่คุณอยากรู้ได้ตรงจุดมากขึ้น',
    questionLabel: '✦ ฝากคำถามหรือเล่าเรื่องราวที่ต้องการให้ไพ่ชี้แนะ <span class="text-[#8A5414]">(ไม่บังคับ · ข้ามได้)</span>',
    privacyTitle: 'การคุ้มครองข้อมูลส่วนบุคคลและความลับของคุณ',
    privacyBody: 'ข้อความที่คุณฝากไว้จะถูกส่งไปประมวลผลคู่กับชื่อไพ่แบบชั่วคราวเฉพาะรอบการเปิดไพ่นี้เท่านั้น <strong>ไม่มีการบันทึกลงฐานข้อมูลและไม่เก็บประวัติส่วนตัว</strong>',
    fairnessNotice: '✦ <strong class="font-fahkwang text-[#4F2031]">การสับและเลือกไพ่เป็นอิสระจากคำถาม:</strong> ไพ่ทั้ง 52 ใบมีโอกาสถูกหยิบเท่ากันทุกใบอย่างเป็นธรรม คำถามที่คุณฝากไว้จะใช้เพื่อช่วยตีความให้ตรงเรื่องของคุณหลังจากเปิดไพ่แล้วเท่านั้น',
    aiNoteDefault: '✦ ระบบมี 2 รูปแบบ: <strong>AI วิเคราะห์เรื่องราวของคุณโดยตรง</strong> และ <strong>คำทำนายจากตำราโคลว์</strong> (หากโควตา AI ช่วงนั้นเต็ม ระบบจะสลับใช้ตำราโคลว์ให้อัตโนมัติ)',
    btnSkipQuestion: 'ข้าม (อธิษฐานในใจ) →',
    btnSubmitQuestion: '✦ สับไพ่ทันที',
    shuffleTitle: 'ตั้งจิตและสับสำรับไพ่',
    shuffleSub: 'การสับไพ่คือการรวบรวมสมาธิและฝากคำถามลงสู่สำรับ แตะที่กองไพ่ซ้ำๆ จนกว่าจะรู้สึกพร้อม',
    btnShuffleDeck: '↻ สับไพ่',
    btnProceedCut: '✦ ไปตัดกองไพ่ →',
    btnProceedDraw: '✦ ไปเลือกไพ่ →',
    cutTitle: 'ตัดแบ่งครึ่งกองไพ่',
    cutSub: 'การตัดไพ่คือการปิดรับคำถามและรวมพลังสมาธิ แตะที่กองไพ่เพื่อแบ่งครึ่งสำรับและสลับวางซ้อนกันก่อนเปิดไพ่',
    cutBottomLabel: 'กองครึ่งล่าง',
    cutTargetLabel: 'จุดวาง<br>กองตัด',
    btnCutDeck: '✂ ตัดกองไพ่',
    drawTitle: 'เลือกไพ่จากสำรับ',
    drawHintDefault: 'ใช้ความรู้สึกแวบแรก แตะเลือกใบที่สะดุดตาที่สุดจากสำรับ 52 ใบ',
    drawHintHover: 'แตะไพ่ครั้งแรกเพื่อยกขึ้น แล้วแตะซ้ำอีกครั้งเพื่อยืนยันเลือก',
    drawHintConfirm: '✦ แตะไพ่ใบเดิมอีกครั้งเพื่อยืนยันการเลือก',
    btnQuickDraw: '✦ ให้ชะตาเลือก 1 ใบ',
    btnQuickDrawAll: '✦ ให้ชะตาเลือกทั้งหมด',
    btnConfirmArmed: '✦ เลือกใบนี้',
    restingDeckTitle: 'สำรับไพ่ที่เหลือ',
    restingDeckSub: 'อัญเชิญไพ่ครบตามผังแล้ว แตะที่หลังไพ่บนแท่นเพื่อเปิดคำทำนาย',
    boardHintChoose: 'เลือกไพ่จากกองด้านบนเพื่อวางลงตำแหน่ง',
    boardHintDone: 'เปิดเผยไพ่ครบทุกตำแหน่งแล้ว',
    boardGuideDefault: 'เชื่อในความรู้สึกแวบแรกแล้วแตะเลือกไพ่ใบที่สะดุดตาที่สุดโดยไม่ต้องลังเล',
    slotWaiting: 'รอวางไพ่',
    slotEmpty: 'ตำแหน่งว่าง',
    slotWaitAll: 'รอเลือกให้ครบ',
    slotFaceDown: 'คว่ำหน้า',
    btnRevealAll: '✦ เปิดทั้งหมดและดูสรุป',
    summaryCtaTitle: '✦ เปิดอ่านไพ่เรียบร้อยแล้ว',
    summaryCtaSub: 'ชมบทสรุปคำทำนาย หรือเลือกการทำนายรูปแบบอื่น',
    btnFullSummary: '✦ ดูบทสรุป',
    btnOtherSpreads: 'การทำนายอื่น',
    consentTitle: 'ขอความยินยอมการจัดเก็บสถิติและการใช้งาน',
    consentBody: 'เว็บไซต์นี้มีการเก็บข้อมูลสถิติการใช้งานแบบ<strong>ไม่ระบุตัวตน</strong> เพื่อนำไปพัฒนาประสบการณ์การใช้งานให้ดียิ่งขึ้น',
    consentBox: '<strong>ไม่มีการเก็บข้อมูลส่วนบุคคล และจะไม่เก็บความลับ คำถาม หรือปัญหาที่ผู้ใช้ฝากไว้โดยเด็ดขาด</strong>',
    btnAcceptConsent: '✦ ยินยอมและเริ่มต้น',
    btnConfirmRitualFocus: '✦ เริ่มทำนาย',
    drawNoticeTitle: 'คลี่ไพ่ครบทั้ง 52 ใบแล้ว',
    drawNoticeBody: 'โปรดสำรวมจิตและเลือกไพ่คว่ำใบที่ท่านรู้สึก<strong>ถูกชะตา</strong>หรือสะดุดตาที่สุดในความรู้สึกแวบแรก',
    drawNoticeWarnTitle: '⚠ เลือกแล้วไม่สามารถเปลี่ยนใบใหม่ได้',
    drawNoticeWarnBody: 'เมื่อแตะเลือกไพ่แล้ว หากต้องการเปลี่ยนจะต้องกดเริ่มสับไพ่ใหม่ตั้งแต่ต้น',
    btnConfirmDrawNotice: '✦ เริ่มเลือกไพ่',
    btnCloseModal: 'ปิด ✕',
    singleCardReadingHeader: '✦ คำทำนายตามตำแหน่งนี้',
    singleCardWarningHeader: '☽ สารนำทางจากไพ่',
    btnPrevCard: '← ใบก่อนหน้า',
    btnNextCard: 'ใบถัดไป →',
    btnViewSummarySmall: 'ดูบทสรุป',
    summaryHeader: 'บทสรุปคำพยากรณ์',
    summaryOverviewHeader: '✦ คำตอบภาพรวมสำหรับคำถามของคุณ',
    summaryWarningHeader: '☽ สารนำทางจากไพ่',
    btnShareSummary: '✦ แชร์ / บันทึก',
    btnShareStory: 'แชร์',
    btnShareFull: 'บันทึกฉบับเต็ม',
    shareModalTitle: 'แชร์ & บันทึกภาพคำทำนาย',
    shareTabStory: '✦ IG Story (9:16)',
    shareTabFull: '✦ ฉบับเต็ม (ไว้อ่านเอง)',
    shareToggleHighlight: 'แสดงคำทำนายสั้นบนภาพ',
    sharePrivacyNote: '✦ ไม่แสดงคำถามส่วนตัวของคุณบนภาพ',
    shareBtnNative: '✦ แชร์ภาพ',
    shareBtnDownload: '↓ บันทึก PNG',
    shareRendering: 'กำลังรังสรรค์ภาพคำทำนาย...',
    shareSavedFeedback: '✓ บันทึกภาพแล้ว',
    shareSharedFeedback: '✓ แชร์เรียบร้อยแล้ว',
    modeNoteLive: '✦ เรียบเรียงคำทำนายเฉพาะเรื่องราวของคุณด้วย AI',
    modeNoteDemo: '✦ สรุปคำทำนายจากตำราโคลว์ (โหมดสำรองเมื่อใช้งานออฟไลน์หรือโควตา AI เต็มชั่วคราว)',
    bgmLabel: 'เพลง: ',
    bgmOn: 'เปิด',
    bgmOff: 'ปิด',
    footerFanmade: '✦ โปรเจกต์ Fanmade อ้างอิงคำทำนายจากคู่มือไพ่โคลว์การ์ดต้นฉบับ (มีระบบ AI ช่วยสรุปบทความเฉพาะบุคคล)',
    footerFeedback: 'ส่งข้อเสนอแนะ',
    loadingSummaryTitle: '☽ กำลังร้อยเรียงบทสรุปคำทำนาย...',
    loadingSummarySub: 'โปรดรอสักครู่',
    scrollUp: '↑ เลื่อนขึ้น',
    scrollDown: '↓ เลื่อนลง'
  },
  en: {
    pageTitle: 'The Clow — Cardcaptor Sakura Fortune Reading',
    headerSubtitle: '— The 52-Card Fortune Grimoire',
    navHome: 'Home',
    heroTitle: 'Open the Clow Card Grimoire',
    heroSub: 'Calm your heart like a steady candle flame, hold your question gently in mind, and choose a 52-card spread.',
    btnShuffleNew: '↻ Reshuffle',
    boardTitle: 'Clow Card Spread Board (Open in Order)',
    stepperQuestion: 'Question (Opt.)',
    stepperShuffle: 'Shuffle',
    stepperShuffleAlt: 'Shuffle',
    stepperCut: 'Cut',
    stepperDraw: 'Draw',
    questionTitle: 'What’s on Your Mind? (Optional)',
    questionSub: 'Sharing your question in a few words helps the cards speak more closely to your situation.',
    questionLabel: '✦ Your question or story <span class="text-[#8A5414]">(Optional)</span>',
    privacyTitle: 'Your Privacy Comes First',
    privacyBody: 'Your question is only used for this reading and is <strong>never saved to any database or personal history</strong>.',
    fairnessNotice: '✦ <strong class="font-fahkwang text-[#4F2031]">Fair & Independent Draw:</strong> All 52 cards have an equal chance of being drawn. Your question only shapes the message after your cards are picked.',
    aiNoteDefault: '✦ Two reading modes: <strong>Personalized AI insight</strong> and <strong>Clow Oracle reading</strong> (switches smoothly if AI quota is busy).',
    btnSkipQuestion: 'Skip (Keep in Mind) →',
    btnSubmitQuestion: '✦ Shuffle Now',
    shuffleTitle: 'Focus & Shuffle',
    shuffleSub: 'Tap the deck as you hold your question in mind, until you feel ready.',
    btnShuffleDeck: '↻ Shuffle',
    btnProceedCut: '✦ Cut Deck →',
    btnProceedDraw: '✦ Draw Cards →',
    cutTitle: 'Cut the Deck',
    cutSub: 'Tap the deck to split it in half and restack it before you draw.',
    cutBottomLabel: 'Bottom Half',
    cutTargetLabel: 'Place<br>Cut Here',
    btnCutDeck: '✂ Cut Deck',
    drawTitle: 'Choose Your Cards',
    drawHintDefault: 'Trust your first instinct and tap the card that quietly catches your eye.',
    drawHintHover: 'Tap a card once to lift it, then tap again to confirm.',
    drawHintConfirm: '✦ Tap the same card again to confirm',
    btnQuickDraw: '✦ Let Fate Pick 1',
    btnQuickDrawAll: '✦ Let Fate Pick All',
    btnConfirmArmed: '✦ Pick This Card',
    restingDeckTitle: 'Remaining Deck',
    restingDeckSub: 'All cards are set. Tap each face-down card on the board to reveal its message.',
    boardHintChoose: 'Choose a card above to place it on the board',
    boardHintDone: 'All cards have been revealed',
    boardGuideDefault: 'Trust your first instinct and choose the card that draws your eye.',
    slotWaiting: 'Next Card',
    slotEmpty: 'Empty Slot',
    slotWaitAll: 'Draw all first',
    slotFaceDown: 'Face Down',
    btnRevealAll: '✦ Reveal All & Summary',
    summaryCtaTitle: '✦ Your reading is complete',
    summaryCtaSub: 'Read your full summary or explore another spread',
    btnFullSummary: '✦ View Summary',
    btnOtherSpreads: 'Other Spreads',
    consentTitle: 'Anonymous Usage & Privacy Notice',
    consentBody: 'This site collects simple, <strong>anonymous</strong> usage stats to help us keep improving the experience.',
    consentBox: '<strong>We never collect personal data, and your private questions or stories are never stored.</strong>',
    btnAcceptConsent: '✦ Agree & Enter',
    btnConfirmRitualFocus: '✦ Begin',
    drawNoticeTitle: 'All 52 Cards Ready',
    drawNoticeBody: 'Take a calm breath and pick the face-down card that <strong>speaks to you first</strong>.',
    drawNoticeWarnTitle: '⚠ Every pick is final',
    drawNoticeWarnBody: 'To draw different cards, just tap Reshuffle to start fresh.',
    btnConfirmDrawNotice: '✦ Choose Cards',
    btnCloseModal: 'Close ✕',
    singleCardReadingHeader: '✦ Message for This Position',
    singleCardWarningHeader: '☽ Guiding Message from the Card',
    btnPrevCard: '← Previous',
    btnNextCard: 'Next →',
    btnViewSummarySmall: 'View Summary',
    summaryHeader: 'Your Reading Summary',
    summaryOverviewHeader: '✦ Overall Answer for Your Question',
    summaryWarningHeader: '☽ Guiding Message from the Cards',
    btnShareSummary: '✦ Share / Save',
    btnShareStory: 'Share',
    btnShareFull: 'Save Full',
    shareModalTitle: 'Share & Save Reading',
    shareTabStory: '✦ IG Story (9:16)',
    shareTabFull: '✦ Full Reading',
    shareToggleHighlight: 'Show short highlight on image',
    sharePrivacyNote: '✦ Your private question is never shown on the image',
    shareBtnNative: '✦ Share Image',
    shareBtnDownload: '↓ Save PNG',
    shareRendering: 'Crafting your reading image...',
    shareSavedFeedback: '✓ Image Saved',
    shareSharedFeedback: '✓ Shared!',
    modeNoteLive: '✦ Personalized reading woven for your question with AI',
    modeNoteDemo: '✦ Clow Oracle reading (offline preview or temporary AI fallback)',
    bgmLabel: 'Music: ',
    bgmOn: 'On',
    bgmOff: 'Off',
    footerFanmade: '✦ Fanmade project inspired by the original Clow Card Fortune Book (with AI personalized summaries)',
    footerFeedback: 'Send Feedback',
    loadingSummaryTitle: '☽ Weaving your reading summary...',
    loadingSummarySub: 'Please wait a moment',
    scrollUp: '↑ Scroll Up',
    scrollDown: '↓ Scroll Down'
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

export function getSpreadTopicTags(spread) {
  if (!spread) return [];
  if (getCurrentLang() === 'en' && Array.isArray(SPREAD_EN[spread.spread_id]?.topicTags)) {
    return SPREAD_EN[spread.spread_id].topicTags;
  }
  return Array.isArray(spread.topicTags) ? spread.topicTags : [];
}

export function getSpreadRitualNotice(spread) {
  if (!spread) return { title: '', body: '', tip: '' };
  if (getCurrentLang() === 'en' && SPREAD_EN[spread.spread_id]) {
    const en = SPREAD_EN[spread.spread_id];
    return {
      title: en.ritualNoticeTitle || '',
      body: en.ritualNoticeBody || '',
      tip: en.ritualNoticeTip || ''
    };
  }
  return {
    title: spread.ritualNoticeTitle || '',
    body: spread.ritualNoticeBody || '',
    tip: spread.ritualNoticeTip || ''
  };
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
  document.title = t('pageTitle');

  const langBtn = document.getElementById('btn-lang-toggle');
  if (langBtn) {
    langBtn.innerHTML =
      safeLang === 'en'
        ? '<span class="font-bold text-[#2A160E]">EN</span><span class="opacity-45 mx-0.5">/</span><span class="opacity-55">TH</span>'
        : '<span class="opacity-55">EN</span><span class="opacity-45 mx-0.5">/</span><span class="font-bold text-[#2A160E]">TH</span>';
    langBtn.title = safeLang === 'en' ? 'Switch to Thai' : 'Switch to English';
  }

  const mapText = [
    ['#header-subtitle-text', 'headerSubtitle'],
    ['#screen-select h1', 'heroTitle'],
    ['#hero-subtitle-text', 'heroSub'],
    ['#btn-shuffle', 'btnShuffleNew'],
    ['#board-area > div:first-child span.font-fahkwang', 'boardTitle'],
    ['#privacy-title', 'privacyTitle'],
    ['#ritual-question-stage button[onclick="skipQuestionStep()"]', 'btnSkipQuestion'],
    ['#ritual-question-stage button[onclick="submitQuestionStep()"]', 'btnSubmitQuestion'],
    ['#btn-shuffle-action', 'btnShuffleDeck'],
    ['#cut-bottom-label', 'cutBottomLabel'],
    ['#btn-trigger-cut', 'btnCutDeck'],
    ['#btn-quick-draw', 'btnQuickDraw'],
    ['#btn-quick-draw-all', 'btnQuickDrawAll'],
    ['#btn-confirm-armed-card', 'btnConfirmArmed'],
    ['#resting-deck-title', 'restingDeckTitle'],
    ['#resting-deck-sub', 'restingDeckSub'],
    ['#board-reveal-all-footer button', 'btnRevealAll'],
    ['#board-summary-cta-title', 'summaryCtaTitle'],
    ['#board-summary-cta-sub', 'summaryCtaSub'],
    ['#btn-board-summary', 'btnFullSummary'],
    ['#btn-board-share-story-label', 'btnShareStory'],
    ['#btn-board-other-spreads', 'btnOtherSpreads'],
    ['#share-modal-title', 'shareModalTitle'],
    ['#btn-close-share-modal', 'btnCloseModal'],
    ['#share-tab-story', 'shareTabStory'],
    ['#share-tab-full', 'shareTabFull'],
    ['#share-toggle-highlight-label', 'shareToggleHighlight'],
    ['#share-privacy-note', 'sharePrivacyNote'],
    ['#btn-share-native', 'shareBtnNative'],
    ['#btn-share-download', 'shareBtnDownload'],
    ['#share-preview-loading-text', 'shareRendering'],
    ['#analytics-consent-title', 'consentTitle'],
    ['#btn-accept-consent', 'btnAcceptConsent'],
    ['#btn-confirm-ritual-focus', 'btnConfirmRitualFocus'],
    ['#draw-notice-title', 'drawNoticeTitle'],
    ['#draw-notice-warn-title', 'drawNoticeWarnTitle'],
    ['#draw-notice-warn-body', 'drawNoticeWarnBody'],
    ['#btn-confirm-draw-notice', 'btnConfirmDrawNotice'],
    ['#reading-modal button[onclick="closeReadingModal()"]', 'btnCloseModal'],
    ['#modal-scroll-up-btn', 'scrollUp'],
    ['#modal-scroll-down-btn', 'scrollDown'],
    ['#btn-share-summary', 'btnShareSummary'],
    ['#footer-fanmade-note', 'footerFanmade'],
    ['#footer-feedback-label', 'footerFeedback']
  ];

  mapText.forEach(([sel, key]) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = t(key);
  });

  const mapHtml = [
    ['#ritual-question-stage label[for="user-question-input"]', 'questionLabel'],
    ['#privacy-body', 'privacyBody'],
    ['#fairness-notice', 'fairnessNotice'],
    ['#cut-target-label', 'cutTargetLabel'],
    ['#analytics-consent-body', 'consentBody'],
    ['#analytics-consent-box', 'consentBox'],
    ['#draw-notice-modal > div > p', 'drawNoticeBody']
  ];
  mapHtml.forEach(([sel, key]) => {
    const el = document.querySelector(sel);
    if (el) el.innerHTML = t(key);
  });

  const attrMap = [
    ['#btn-home', safeLang === 'en' ? 'Home' : 'หน้าหลัก', true],
    ['#btn-bgm-toggle', safeLang === 'en' ? 'Toggle background music' : 'เปิดหรือปิดเสียงเพลงบรรเลง', false],
    ['button[onclick="prevBgmTrack()"]', safeLang === 'en' ? 'Previous track' : 'เพลงก่อนหน้า', true],
    ['button[onclick="nextBgmTrack()"]', safeLang === 'en' ? 'Next track' : 'เพลงถัดไป', true],
    ['button[onclick="dismissRitualFocusModal()"]', safeLang === 'en' ? 'Close and go back' : 'ปิดและกลับไปหน้าเดิม', true],
    ['#interactive-deck-touchzone', safeLang === 'en' ? 'Tap to shuffle the deck' : 'แตะเพื่อสับสำรับไพ่', false],
    ['#cut-deck-touchzone', safeLang === 'en' ? 'Tap to cut the deck' : 'แตะเพื่อตัดแบ่งครึ่งกองไพ่', false],
    ['button[onclick="adjustSpreadZoom(-0.15)"]', safeLang === 'en' ? 'Zoom out' : 'ซูมออก', true],
    ['button[onclick="resetSpreadZoom()"]', safeLang === 'en' ? 'Reset board zoom' : 'รีเซ็ตขนาดแท่นไพ่', false],
    ['button[onclick="adjustSpreadZoom(0.15)"]', safeLang === 'en' ? 'Zoom in' : 'ซูมเข้า', true]
  ];
  attrMap.forEach(([sel, label, setAria]) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.setAttribute('title', label);
    if (setAria) el.setAttribute('aria-label', label);
  });
}

export function toggleLanguage() {
  const next = getCurrentLang() === 'en' ? 'th' : 'en';
  applyLanguage(next);
  return next;
}
