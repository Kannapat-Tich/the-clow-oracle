/**
 * THE CLOW — ตัวเชื่อม AI Oracle (/api/interpret)
 *
 * - ส่งเฉพาะ spreadId, รายชื่อไพ่ตามตำแหน่ง และคำถามที่ผู้ใช้ยินยอมส่ง
 * - แคชผลลัพธ์ในหน่วยความจำต่อรอบการเปิดไพ่ เพื่อไม่ให้ยิง API ซ้ำโดยไม่จำเป็น
 * - มี Graceful Fallback หากโควต้า AI ฟรีของวันเต็ม เว็บจะไม่พังและยังอ่านตำราต้นฉบับได้ครบถ้วน
 */

const readingCache = new Map();
const inFlightRequests = new Map();

function buildCacheKey(spreadId, question, drawnCards) {
  const cardSig = drawnCards.map((d) => `${d.posIndex}:${d.card.id}`).join('|');
  return `${spreadId}::${question.trim()}::${cardSig}`;
}

/**
 * วิเคราะห์บริบทคำถามของผู้ใช้แบบเบาๆ สำหรับ Local Preview
 * เพื่อให้คำทำนายจำลองเชื่อมโยงกับเรื่องที่ผู้ใช้กรอกจริง
 */
function detectQuestionContext(question) {
  const q = (question || '').trim();
  if (!q) return { hasQuestion: false, topicLabel: 'สถานการณ์โดยรวมของคุณ', shortTopic: 'เรื่องที่อยู่ในใจ' };

  const rules = [
    { re: /รัก|แฟน|คุย|แอบชอบ|แต่ง|เลิก|คู่|ใจ|สัมพันธ์|หึง|คิดถึง/, label: 'เรื่องความรักและความสัมพันธ์ที่คุณถามไว้' },
    { re: /งาน|อาชีพ|โปรเจกต์|เจ้านาย|เพื่อนร่วมงาน|สมัคร|สัมภาษณ์|ลาออก|ย้ายงาน|ธุรกิจ/, label: 'เรื่องการงานและเส้นทางอาชีพที่คุณกังวลอยู่' },
    { re: /เรียน|สอบ|มหาลัย|คณะ|เกรด|ทุน|อ่านหนังสือ/, label: 'เรื่องการเรียนและการทดสอบที่คุณกำลังเผชิญ' },
    { re: /เงิน|หนี้|ลงทุน|ขาย|รายได้|โชค|การเงิน|ซื้อ|บ้าน|รถ/, label: 'เรื่องการเงินและความมั่นคงที่คุณถามถึง' },
    { re: /ครอบครัว|พ่อ|แม่|ลูก|ญาติ|บ้าน/, label: 'เรื่องครอบครัวและความสัมพันธ์ใกล้ชิด' },
    { re: /ตัดสินใจ|เลือก|ย้าย|เปลี่ยน|ดีไหม|ควรทำ/, label: 'การตัดสินใจครั้งสำคัญที่คุณกำลังชั่งใจ' }
  ];

  const matched = rules.find((r) => r.re.test(q));
  const snippet = q.length > 52 ? `${q.slice(0, 52)}...` : q;
  return {
    hasQuestion: true,
    raw: q,
    snippet,
    topicLabel: matched ? matched.label : `เรื่อง “${snippet}”`
  };
}

/**
 * สร้างคำทำนายจำลองจากคู่มือจริงเมื่อยังไม่ได้เชื่อม Backend (/api/interpret)
 * ใช้เฉพาะกรณีเปิดทดสอบไฟล์ HTML เปล่าในเครื่อง (Local Preview)
 */
function buildLocalGuidebookSynthesis(spread, question, drawnCards) {
  const sorted = [...drawnCards].sort((a, b) => a.posIndex - b.posIndex);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const ctx = detectQuestionContext(question);

  const overview = ctx.hasQuestion
    ? `จากคำถามของคุณเกี่ยวกับ “${ctx.snippet}” คัมภีร์โคลว์เปิดเรื่องด้วยไพ่ ${first.card.name} (${first.card.thaiName}) ธาตุ${first.card.elementThai} ซึ่งชี้ว่าแกนหลักของ${ctx.topicLabel}ในตอนนี้เกี่ยวข้องกับ “${first.card.keywords.join(' · ')}” ${
        sorted.length > 1
          ? `และเมื่อไล่เรียงพลังไพ่ทั้ง ${sorted.length} ตำแหน่งไปจนถึงไพ่บทสรุป ${last.card.name} (${last.card.thaiName}) จะเห็นว่าสถานการณ์นี้สามารถคลี่คลายไปในทิศทางที่ดีขึ้นได้ หากคุณรับมือตามจังหวะของไพ่แต่ละตำแหน่งอย่างมีสติ`
          : `ซึ่งเป็นหัวใจสำคัญที่คุณควรยึดเป็นแนวทางหลักเพื่อคลี่คลายเรื่องนี้ในวันนี้`
      }`
    : `จากพลังงานของหน้าไพ่ที่ปรากฏในผัง ${spread.name} หน้าไพ่เปิดฉากด้วย ${first.card.name} (${first.card.thaiName}) ซึ่งเน้นประเด็นเรื่อง “${first.card.keywords.join(' · ')}” ${
        sorted.length > 1
          ? `และเคลื่อนไปสู่จุดคลี่คลายที่ ${last.card.name} (${last.card.thaiName}) สะท้อนว่าสถานการณ์มีจังหวะเปลี่ยนผ่านที่ชัดเจนหากคุณค่อยๆ ประเมินอย่างมีสติ`
          : 'เป็นสารนำทางหลักที่คัมภีร์ต้องการให้คุณยึดถือในเวลานี้'
      }`;

  const connections = sorted.map((slot) => {
    const pos = spread.positions.find((p) => p.index === slot.posIndex);
    const posTitle = pos ? pos.title : `ตำแหน่งที่ ${slot.posIndex}`;
    const posMeaning = pos ? pos.meaning : '';
    const lead = ctx.hasQuestion
      ? `ในแง่ของ${ctx.topicLabel} ตำแหน่ง “${posTitle}” (${posMeaning}) ได้ไพ่ ${slot.card.thaiName} [${slot.card.keywords.slice(0, 2).join(', ')}]`
      : `ในตำแหน่ง “${posTitle}” (${posMeaning}) ไพ่ ${slot.card.thaiName} สะท้อนพลังด้าน ${slot.card.keywords.slice(0, 2).join(', ')}`;

    return {
      positionIndex: slot.posIndex,
      positionTitle: posTitle,
      cardName: `${slot.card.name} (${slot.card.thaiName})`,
      insight: `${lead} — ${slot.card.meaning}`
    };
  });

  const advice = sorted.slice(0, 3).map((slot) => {
    const pos = spread.positions.find((p) => p.index === slot.posIndex);
    const posLabel = pos ? pos.title : `ตำแหน่งที่ ${slot.posIndex}`;
    return ctx.hasQuestion
      ? `สำหรับเรื่อง “${ctx.snippet}” (${posLabel} · ${slot.card.thaiName}): ${slot.card.warning}`
      : `${posLabel} (${slot.card.thaiName}): ${slot.card.warning}`;
  });

  return {
    mode: 'demo',
    provider: 'Local Preview (Guidebook Synthesis)',
    overview,
    connections,
    advice,
    closing: ctx.hasQuestion
      ? `ขอให้พลังแห่งคัมภีร์โคลว์เป็นแสงนำทางให้คุณก้าวผ่านเรื่อง “${ctx.snippet}” ไปได้อย่างมั่นคงและอ่อนโยน`
      : 'จงรับฟังเสียงหัวใจของตนเองควบคู่กับคำเตือนจากหน้าไพ่ พลังแห่งโคลว์เป็นเพียงกระจกสะท้อนทางเลือก ส่วนผู้กำหนดก้าวต่อไปคือคุณเอง'
  };
}

export async function requestAiInterpretation({ spread, question, drawnCards }) {
  const cleanQuestion = (question || '').trim().slice(0, 500);
  const cacheKey = buildCacheKey(spread.spread_id, cleanQuestion, drawnCards);

  if (readingCache.has(cacheKey)) {
    return readingCache.get(cacheKey);
  }
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const payload = {
    spreadId: spread.spread_id,
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
        const demoResult = buildLocalGuidebookSynthesis(spread, cleanQuestion, drawnCards);
        readingCache.set(cacheKey, demoResult);
        return demoResult;
      }

      const data = await res.json();

      if (res.status === 429) {
        return {
          mode: 'quota',
          message:
            data.message ||
            'พลังเวทตีความอัตโนมัติกำลังพักฟื้นชั่วคราวเนื่องจากมีผู้ใช้งานจำนวนมาก คุณยังสามารถอ่านคำทำนายจากตำราโคลว์การ์ดต้นฉบับด้านล่างได้ครบถ้วนครับ'
        };
      }

      if (!res.ok || !data.reading) {
        if (data.code === 'NO_API_KEY') {
          const demoResult = buildLocalGuidebookSynthesis(spread, cleanQuestion, drawnCards);
          readingCache.set(cacheKey, demoResult);
          return demoResult;
        }
        return {
          mode: 'fallback',
          message:
            data.message ||
            'ไม่สามารถเชื่อมต่อห้องพยากรณ์ AI ได้ในขณะนี้ กรุณาอ่านคำทำนายจากคัมภีร์ต้นฉบับด้านล่างแทนครับ'
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
      const demoResult = buildLocalGuidebookSynthesis(spread, cleanQuestion, drawnCards);
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
