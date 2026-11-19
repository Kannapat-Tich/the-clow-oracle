/**
 * THE CLOW — ตัวเชื่อม AI Oracle (/api/interpret)
 *
 * - ส่งเฉพาะ spreadId, รายชื่อไพ่ตามตำแหน่ง และคำถามที่ผู้ใช้ยินยอมส่ง
 * - แคชผลลัพธ์ในหน่วยความจำต่อรอบการเปิดไพ่ เพื่อไม่ให้ยิง API ซ้ำโดยไม่จำเป็น
 * - มี Graceful Fallback หากโควต้า AI ฟรีของวันเต็ม เว็บจะไม่พังและยังอ่านตำราต้นฉบับได้ครบถ้วน
 */

import { getCurrentLang, getSpreadName, getPosTitle, getPosMeaning } from './i18n.js';

const readingCache = new Map();
const inFlightRequests = new Map();

function buildCacheKey(spreadId, question, drawnCards, lang = 'th') {
  const cardSig = drawnCards.map((d) => `${d.posIndex}:${d.card.id}`).join('|');
  return `${lang}::${spreadId}::${question.trim()}::${cardSig}`;
}

/**
 * วิเคราะห์บริบทคำถามของผู้ใช้แบบเบาๆ สำหรับ Local Preview
 * เพื่อให้คำทำนายจำลองเชื่อมโยงกับเรื่องที่ผู้ใช้กรอกจริง
 */
function detectQuestionContext(question) {
  const q = (question || '').trim();
  if (!q) {
    return {
      hasQuestion: false,
      topicLabel: 'สถานการณ์ของคุณในตอนนี้',
      focusSubject: 'เรื่องราวที่อยู่ในใจคุณตอนนี้',
      otherPartyLabel: 'อีกฝ่ายหรือผู้ที่เกี่ยวข้อง'
    };
  }

  const rules = [
    {
      re: /แอบชอบ|จีบ|คนคุย|สมหวัง|คิดยังไง|ชอบเรา|ทัก/,
      topicLabel: 'ความรู้สึกและโอกาสพัฒนาความสัมพันธ์กับคนที่คุณนึกถึง',
      focusSubject: 'ความสัมพันธ์กับคนที่คุณกำลังให้ความสนใจ',
      otherPartyLabel: 'คนที่คุณกำลังนึกถึงอยู่'
    },
    {
      re: /เลิก|ทะเลาะ|ห่าง|ง้อ|คืนดี|เก่า|เปลี่ยนไป|นอกใจ|เงียบ/,
      topicLabel: 'ความสัมพันธ์ที่กำลังมีระยะห่างหรือรอความชัดเจน',
      focusSubject: 'การคลี่คลายความไม่เข้าใจและทิศทางความสัมพันธ์',
      otherPartyLabel: 'อีกฝ่ายในความสัมพันธ์นี้'
    },
    {
      re: /รัก|แฟน|แต่ง|คู่|ใจ|สัมพันธ์|หึง|คิดถึง/,
      topicLabel: 'เรื่องความรักและความสัมพันธ์ที่คุณตั้งจิตถามไว้',
      focusSubject: 'ความผูกพันและความเข้าใจระหว่างคุณสองคน',
      otherPartyLabel: 'คนรักหรือคนที่คุณนึกถึง'
    },
    {
      re: /ลาออก|ย้ายงาน|เปลี่ยนงาน|สมัคร|สัมภาษณ์|งานใหม่/,
      topicLabel: 'การเปลี่ยนแปลงหรือก้าวใหม่ในเส้นทางงาน',
      focusSubject: 'การตัดสินใจเรื่องงานใหม่และจังหวะการเปลี่ยนแปลง',
      otherPartyLabel: 'ผู้คัดเลือก หัวหน้า หรือทีมงานใหม่'
    },
    {
      re: /งาน|อาชีพ|โปรเจกต์|เจ้านาย|เพื่อนร่วมงาน|ธุรกิจ|ค้าขาย/,
      topicLabel: 'เรื่องการงานและเส้นทางอาชีพที่คุณตั้งจิตถามไว้',
      focusSubject: 'ความก้าวหน้าและความราบรื่นในการทำงาน',
      otherPartyLabel: 'ผู้ใหญ่ เพื่อนร่วมงาน หรือลูกค้าที่เกี่ยวข้อง'
    },
    {
      re: /เรียน|สอบ|มหาลัย|คณะ|เกรด|ทุน|อ่านหนังสือ/,
      topicLabel: 'เรื่องการเรียนและการทดสอบที่คุณตั้งจิตถามไว้',
      focusSubject: 'ความพร้อมและผลลัพธ์ด้านการเรียนการสอบ',
      otherPartyLabel: 'ผู้สอน เพื่อน หรือสภาพแวดล้อมการเรียน'
    },
    {
      re: /เงิน|หนี้|ลงทุน|ขาย|รายได้|โชค|การเงิน|ซื้อ|บ้าน|รถ/,
      topicLabel: 'เรื่องการเงินและความมั่นคงที่คุณตั้งจิตถามไว้',
      focusSubject: 'สภาพคล่องและการวางแผนทางการเงิน',
      otherPartyLabel: 'คู่ค้าหรือผู้ที่มีส่วนเกี่ยวข้องทางการเงิน'
    },
    {
      re: /ครอบครัว|พ่อ|แม่|ลูก|ญาติ|บ้าน/,
      topicLabel: 'เรื่องครอบครัวและความสัมพันธ์ใกล้ชิดที่คุณตั้งจิตถามไว้',
      focusSubject: 'ความอบอุ่นและความเข้าใจกันภายในครอบครัว',
      otherPartyLabel: 'คนในครอบครัวที่เกี่ยวข้อง'
    },
    {
      re: /ตัดสินใจ|เลือก|ย้าย|เปลี่ยน|ดีไหม|ควรทำ/,
      topicLabel: 'การตัดสินใจสำคัญที่คุณกำลังชั่งใจอยู่',
      focusSubject: 'ทางเลือกที่เหมาะสมที่สุดสำหรับคุณในเวลานี้',
      otherPartyLabel: 'ผู้คนและปัจจัยรอบข้างที่ส่งผลต่อการตัดสินใจ'
    }
  ];

  const matched = rules.find((r) => r.re.test(q));
  if (matched) {
    return {
      hasQuestion: true,
      topicLabel: matched.topicLabel,
      focusSubject: matched.focusSubject,
      otherPartyLabel: matched.otherPartyLabel
    };
  }
  return {
    hasQuestion: true,
    topicLabel: 'เรื่องราวที่คุณตั้งจิตถามไว้',
    focusSubject: 'สถานการณ์ที่คุณกำลังเผชิญและอยากหาทางออก',
    otherPartyLabel: 'ผู้ที่เกี่ยวข้องในเรื่องนี้'
  };
}

function buildPositionFramedReading(pos, card, ctx) {
  const posIndex = pos ? pos.index : 1;
  const posTitle = pos ? pos.title : `ตำแหน่งที่ ${posIndex}`;
  const meaningText = String(card.meaning || '').replace(/,/g, '').replace(/\s{2,}/g, ' ').trim();
  const warningText = String(card.warning || '').replace(/,/g, '').replace(/\s{2,}/g, ' ').trim();
  const kwList = card.keywords.slice(0, 2);
  const kwPair = kwList.length === 2 && !kwList[0].includes('และ') ? `${kwList[0]}และ${kwList[1]}` : kwList.join(' ');
  const subject = ctx.focusSubject;
  const other = ctx.otherPartyLabel;

  if (posTitle.includes('อดีต') || posTitle.includes('รากฐาน')) {
    return `จุดเริ่มต้นของ${subject}มีรากฐานมาจากช่วงที่ผ่านมาซึ่งหล่อหลอมด้วยพลังของ${kwPair} เหตุการณ์ก่อนหน้านี้ส่งผลต่อปัจจุบันโดยตรงว่า ${meaningText}${warningText ? ` บทเรียนสำคัญจากอดีตที่ควรเก็บไว้เตือนใจคือ ${warningText}` : ''}`;
  }
  if (posTitle.includes('ความรู้สึกภายใน')) {
    return `ลึกๆ ภายในใจของคุณต่อ${subject}ตอนนี้เต็มไปด้วยความปรารถนาและความรู้สึกเรื่อง${kwPair} ใจของคุณกำลังสื่อออกมาว่า ${meaningText}${warningText ? ` สิ่งที่ควรดูแลความรู้สึกตนเองเป็นพิเศษคือ ${warningText}` : ''}`;
  }
  if (posTitle.includes('อีกฝ่าย')) {
    return `หากมองจากฝั่งของ${other} ท่าทีและพลังงานที่เขามีต่อ${subject}สะท้อนเรื่อง${kwPair}อย่างชัดเจน ซึ่งบ่งบอกว่า ${meaningText}${warningText ? ` จุดที่ควรสังเกตในปฏิกิริยาของอีกฝ่ายคือ ${warningText}` : ''}`;
  }
  if (posTitle.includes('สนับสนุน') || posTitle.includes('ซ่อนอยู่')) {
    return `เบื้องหลัง${subject}ยังมีแรงสนับสนุนจาก${other}หรือโอกาสที่ซ่อนอยู่ผ่านพลังของ${kwPair} สิ่งนี้กำลังช่วยประคองคุณโดยชี้ว่า ${meaningText}${warningText ? ` ควรใช้โอกาสนี้ด้วยความรอบคอบเพราะ ${warningText}` : ''}`;
  }
  if (posTitle.includes('อุปสรรค') || posTitle.includes('ระมัดระวัง') || posTitle.includes('บททดสอบ')) {
    return `บททดสอบสำคัญที่กำลังขวางหรือท้าทาย${subject}อยู่คือประเด็นเรื่อง${kwPair}${warningText ? ` โดยเฉพาะจุดที่ต้องระวังอย่างยิ่งว่า ${warningText}` : ''} สถานการณ์นี้กำลังทดสอบให้คุณเห็นว่า ${meaningText}`;
  }
  if (posTitle.includes('ตัดสินใจ')) {
    return `สำหรับก้าวต่อไปของ${subject} การตัดสินใจที่เหมาะสมที่สุดควรมองผ่านมุมของ${kwPair} ทางออกที่จะช่วยพลิกสถานการณ์ให้ดีขึ้นคือ ${meaningText}${warningText ? ` โดยต้องระวังไม่เผลอทำสิ่งนี้คือ ${warningText}` : ''}`;
  }
  if (posTitle.includes('บทสรุป') || posTitle.includes('ผลลัพธ์') || posTitle.includes('คำแนะนำ')) {
    return `ทิศทางปลายทางของ${subject}มีแนวโน้มคลี่คลายไปตามพลังของ${kwPair} บทสรุปและคำแนะนำสำหรับคุณคือ ${meaningText}${warningText ? ` และหากต้องการให้ผลลัพธ์มั่นคงยิ่งขึ้นควรใส่ใจว่า ${warningText}` : ''}`;
  }
  if (posTitle.includes('ปัจจุบัน')) {
    return `ภาพจริงของ${subject}ในจังหวะปัจจุบันกำลังเคลื่อนไหวอยู่บนพลังของ${kwPair} สภาพแวดล้อมตอนนี้สะท้อนให้เห็นว่า ${meaningText}${warningText ? ` ระหว่างนี้ควรระมัดระวังเรื่อง ${warningText}` : ''}`;
  }

  return `หัวใจสำคัญของ${subject}ในเวลานี้ขับเคลื่อนด้วยพลังงานของ${kwPair} แก่นแท้ของสถานการณ์กำลังบอกคุณว่า ${meaningText}${warningText ? ` ขณะเดียวกันควรใส่ใจเรื่องที่ว่า ${warningText}` : ''}`;
}

function buildEnglishSynthesis(spread, question, drawnCards) {
  const sorted = [...drawnCards].sort((a, b) => a.posIndex - b.posIndex);
  const q = (question || '').trim();
  const hasQ = Boolean(q);
  const isLove = /love|crush|partner|ex|heart|relationship|รัก|แฟน|แอบชอบ|คุย|สัมพันธ์/i.test(q);
  const isWork = /work|job|career|boss|business|งาน|อาชีพ|ลาออก|ย้ายงาน|สมัคร/i.test(q);
  const subject = !hasQ
    ? 'your current path'
    : isLove
      ? 'your romantic connection'
      : isWork
        ? 'your career path'
        : 'the situation on your mind';

  const connections = sorted.map((slot) => {
    const pos = spread.positions.find((p) => p.index === slot.posIndex);
    const posTitle = getPosTitle(spread.spread_id, pos) || `Position ${slot.posIndex}`;
    const posMeaning = getPosMeaning(spread.spread_id, pos) || '';
    const cardName = slot.card.name;
    const lower = posTitle.toLowerCase();

    let insight = '';
    if (lower.includes('past')) {
      insight = `For ${subject}, ${cardName} shows how past events shaped where you stand now (${posMeaning.toLowerCase()}). Carry forward the lesson without repeating old hesitation.`;
    } else if (lower.includes('inner')) {
      insight = `Inside your heart regarding ${subject}, ${cardName} reflects quiet hopes and unspoken feelings (${posMeaning.toLowerCase()}). Honoring your true emotion brings clarity.`;
    } else if (lower.includes('other')) {
      insight = `From the other person's side in ${subject}, ${cardName} highlights their current energy and attitude (${posMeaning.toLowerCase()}). Observe actions gently before jumping to conclusions.`;
    } else if (lower.includes('support')) {
      insight = `Behind the scenes of ${subject}, ${cardName} points to quiet support and timing working in your favor (${posMeaning.toLowerCase()}). Stay open to help when it appears.`;
    } else if (lower.includes('obstacle') || lower.includes('caution')) {
      insight = `The key challenge around ${subject} right now centers on ${cardName} (${posMeaning.toLowerCase()}). Pause before reacting impulsively so small misunderstandings do not grow.`;
    } else if (lower.includes('decision')) {
      insight = `At this turning point in ${subject}, ${cardName} encourages steady, intentional action (${posMeaning.toLowerCase()}). Choose clarity over rushing.`;
    } else if (lower.includes('outcome') || lower.includes('advice')) {
      insight = `Looking ahead for ${subject}, ${cardName} signals steady growth and clearer direction (${posMeaning.toLowerCase()}). Stay grounded and consistent as things unfold.`;
    } else {
      insight = `At the heart of ${subject}, ${cardName} brings focus to what truly matters right now (${posMeaning.toLowerCase()}). Approach the moment with calm awareness.`;
    }

    return {
      positionIndex: slot.posIndex,
      positionTitle: posTitle,
      cardName: `${cardName} (${slot.card.thaiName})`,
      insight,
      detailInsight: insight
    };
  });

  const overview = connections.map((c, idx) => `Card ${idx + 1}: ${c.insight}`).join(' ');
  const advice = [
    `Stay mindful of impatience or holding back honest communication around ${subject}, and give yourself space to act with calm clarity.`
  ];

  return {
    mode: 'demo',
    provider: 'Local Preview (English Synthesis)',
    overview,
    connections,
    advice,
    closing: 'May the Clow Cards illuminate your next step with clarity and calm.'
  };
}

function buildPositionConciseReading(pos, card, ctx) {
  const posIndex = pos ? pos.index : 1;
  const posTitle = pos ? pos.title : `ตำแหน่งที่ ${posIndex}`;
  const meaningText = String(card.meaning || '').replace(/,/g, '').replace(/\s{2,}/g, ' ').trim();
  const firstSentence = meaningText.split(/\s+(?=หาก|ช่วงนี้|ลอง|แม้|แต่|ทางแก้)/)[0].trim();
  const subject = ctx.focusSubject;
  const other = ctx.otherPartyLabel;

  if (posTitle.includes('อดีต') || posTitle.includes('รากฐาน')) {
    return `รากฐานจากอดีตของ${subject}ส่งผลมาถึงปัจจุบันว่า ${firstSentence}`;
  }
  if (posTitle.includes('ความรู้สึกภายใน')) {
    return `ความรู้สึกภายในใจต่อ${subject}สะท้อนว่า ${firstSentence}`;
  }
  if (posTitle.includes('อีกฝ่าย')) {
    return `มุมมองและท่าทีของ${other}ต่อ${subject}บ่งบอกว่า ${firstSentence}`;
  }
  if (posTitle.includes('สนับสนุน') || posTitle.includes('ซ่อนอยู่')) {
    return `แรงสนับสนุนที่ซ่อนอยู่เบื้องหลัง${subject}ชี้ว่า ${firstSentence}`;
  }
  if (posTitle.includes('อุปสรรค') || posTitle.includes('ระมัดระวัง') || posTitle.includes('บททดสอบ')) {
    return `บททดสอบสำคัญของ${subject}ในจุดนี้คือ ${firstSentence}`;
  }
  if (posTitle.includes('ตัดสินใจ')) {
    return `แนวทางตัดสินใจสำหรับ${subject}ชี้แนะว่า ${firstSentence}`;
  }
  if (posTitle.includes('บทสรุป') || posTitle.includes('ผลลัพธ์') || posTitle.includes('คำแนะนำ')) {
    return `บทสรุปและแนวโน้มของ${subject}บอกไว้ว่า ${firstSentence}`;
  }
  if (posTitle.includes('ปัจจุบัน')) {
    return `สถานการณ์ปัจจุบันของ${subject}กำลังแสดงให้เห็นว่า ${firstSentence}`;
  }
  return `หัวใจของ${subject}ชี้ให้เห็นว่า ${firstSentence}`;
}

function buildLocalGuidebookSynthesis(spread, question, drawnCards, lang = getCurrentLang()) {
  if (lang === 'en') {
    return buildEnglishSynthesis(spread, question, drawnCards);
  }
  const sorted = [...drawnCards].sort((a, b) => a.posIndex - b.posIndex);
  const first = sorted[0];
  const ctx = detectQuestionContext(question);

  const sequentialStory = sorted
    .map((slot, idx) => {
      const meaningText = String(slot.card.meaning || '').replace(/,/g, '').trim();
      return `ใบที่ ${idx + 1} บอกว่า${meaningText}`;
    })
    .join(' ');

  const overview =
    sorted.length > 1
      ? ctx.hasQuestion
        ? `สำหรับ${ctx.topicLabel} หน้าไพ่ทั้ง ${sorted.length} ใบเรียงร้อยเรื่องราวตามลำดับดังนี้ ${sequentialStory}`
        : `ภาพรวมคำทำนายทั้ง ${sorted.length} ใบเรียงร้อยเรื่องราวตามลำดับดังนี้ ${sequentialStory}`
      : ctx.hasQuestion
        ? `สำหรับ${ctx.topicLabel} หน้าไพ่ใบนี้บอกว่า${String(first.card.meaning || '').replace(/,/g, '').trim()}`
        : `หน้าไพ่ใบนี้บอกว่า${String(first.card.meaning || '').replace(/,/g, '').trim()}`;

  const connections = sorted.map((slot) => {
    const pos = spread.positions.find((p) => p.index === slot.posIndex);
    const posTitle = pos ? pos.title : `ตำแหน่งที่ ${slot.posIndex}`;

    const insight = buildPositionConciseReading(pos, slot.card, ctx)
      .replace(/,/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const detailInsight = buildPositionFramedReading(pos, slot.card, ctx)
      .replace(/,/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return {
      positionIndex: slot.posIndex,
      positionTitle: posTitle,
      cardName: `${slot.card.name} (${slot.card.thaiName})`,
      insight,
      detailInsight
    };
  });

  const selectedWarnings = sorted
    .map((slot) => String(slot.card.warning || '').replace(/,/g, '').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 3);

  const combinedWarnings = selectedWarnings.join(' ');
  const advice = combinedWarnings ? [combinedWarnings] : [];

  return {
    mode: 'demo',
    provider: 'Local Preview (Guidebook Synthesis)',
    overview,
    connections,
    advice,
    closing: ctx.hasQuestion
      ? 'ขอให้พลังแห่งคัมภีร์โคลว์เป็นแสงนำทางให้คุณก้าวผ่านเรื่องนี้ไปได้อย่างมั่นคงและสบายใจ'
      : 'จงรับฟังเสียงหัวใจของตนเองควบคู่กับคำเตือนจากหน้าไพ่ แล้วก้าวเดินต่อไปอย่างมั่นคง'
  };
}

export { buildLocalGuidebookSynthesis };

export async function requestAiInterpretation({ spread, question, drawnCards, lang = getCurrentLang() }) {
  const cleanQuestion = (question || '').trim().slice(0, 500);
  const cacheKey = buildCacheKey(spread.spread_id, cleanQuestion, drawnCards, lang);

  if (readingCache.has(cacheKey)) {
    return readingCache.get(cacheKey);
  }
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const payload = {
    spreadId: spread.spread_id,
    lang,
    question: cleanQuestion,
    cards: drawnCards
      .slice()
      .sort((a, b) => a.posIndex - b.posIndex)
      .map((slot) => ({
        posIndex: slot.posIndex,
        cardId: slot.card.id
      }))
  };

  const promise = (async () => {
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const demoResult = buildLocalGuidebookSynthesis(spread, cleanQuestion, drawnCards, lang);
        readingCache.set(cacheKey, demoResult);
        return demoResult;
      }

      const data = await res.json();

      if (res.status === 429) {
        try {
          sessionStorage.setItem('clow_ai_cooldown_until', String(Date.now() + 10 * 60 * 1000));
        } catch (_) {}
        const fallbackReading = buildLocalGuidebookSynthesis(spread, cleanQuestion, drawnCards, lang);
        return {
          ...fallbackReading,
          mode: 'fallback_synthesis',
          notice:
            data.message ||
            'โควต้า AI เต็มชั่วคราว — ระบบจึงร้อยเรียงคำทำนายจากคัมภีร์โคลว์การ์ดต้นฉบับให้แทนอัตโนมัติค่ะ'
        };
      }

      if (!res.ok || !data.reading) {
        const fallbackReading = buildLocalGuidebookSynthesis(spread, cleanQuestion, drawnCards, lang);
        if (data.code === 'NO_API_KEY') {
          readingCache.set(cacheKey, fallbackReading);
          return fallbackReading;
        }
        return {
          ...fallbackReading,
          mode: 'fallback_synthesis',
          notice:
            data.message ||
            'AI ขัดข้องชั่วคราว — ระบบจึงร้อยเรียงคำทำนายจากคัมภีร์โคลว์การ์ดต้นฉบับให้แทนอัตโนมัติค่ะ'
        };
      }

      const result = {
        mode: 'live',
        provider: data.provider || 'Gemini AI',
        ...data.reading
      };
      readingCache.set(cacheKey, result);
      return result;
    } catch (_) {
      const demoResult = buildLocalGuidebookSynthesis(spread, cleanQuestion, drawnCards, lang);
      readingCache.set(cacheKey, demoResult);
      return demoResult;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

export function clearAiReadingCache() {
  readingCache.clear();
  inFlightRequests.clear();
}
