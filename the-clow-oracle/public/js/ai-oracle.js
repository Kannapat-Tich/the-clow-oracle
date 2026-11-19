/**
 * THE CLOW — ตัวเชื่อม AI Oracle (/api/interpret)
 *
 * - ส่งเฉพาะ spreadId, รายชื่อไพ่ตามตำแหน่ง และคำถามที่ผู้ใช้ยินยอมส่ง
 * - แคชผลลัพธ์ในหน่วยความจำต่อรอบการเปิดไพ่ เพื่อไม่ให้ยิง API ซ้ำโดยไม่จำเป็น
 * - มี Graceful Fallback หากโควต้า AI ฟรีของวันเต็ม เว็บจะไม่พังและยังอ่านตำราต้นฉบับได้ครบถ้วน
 */

const readingCache = new Map();

function buildCacheKey(spreadId, question, drawnCards) {
  const cardSig = drawnCards.map((d) => `${d.posIndex}:${d.card.id}`).join('|');
  return `${spreadId}::${question.trim()}::${cardSig}`;
}

/**
 * สร้างคำทำนายจำลองจากคู่มือจริงเมื่อยังไม่ได้เชื่อม Backend (/api/interpret)
 * ใช้เฉพาะกรณีเปิดทดสอบไฟล์ HTML เปล่าในเครื่อง (Local Preview)
 */
function buildLocalGuidebookSynthesis(spread, question, drawnCards) {
  const sorted = [...drawnCards].sort((a, b) => a.posIndex - b.posIndex);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const qNote = question.trim()
    ? `สำหรับเรื่อง “${question.trim()}” ที่คุณฝากไว้ `
    : 'จากพลังงานของหน้าไพ่ที่ปรากฏในผังนี้ ';

  return {
    mode: 'demo',
    provider: 'Local Preview (Guidebook Synthesis)',
    overview: `${qNote}หน้าไพ่เปิดฉากด้วย ${first.card.name} (${first.card.thaiName}) ซึ่งเน้นประเด็นเรื่อง “${first.card.keywords.join(', ')}” ${
      sorted.length > 1
        ? `และเคลื่อนไปสู่จุดคลี่คลายที่ ${last.card.name} (${last.card.thaiName}) สะท้อนว่าสถานการณ์มีจังหวะเปลี่ยนผ่านที่ชัดเจนหากคุณค่อยๆ ประเมินอย่างมีสติ`
        : 'เป็นสารนำทางหลักที่คัมภีร์ต้องการให้คุณยึดถือในเวลานี้'
    }`,
    connections: sorted.map((slot) => {
      const pos = spread.positions.find((p) => p.index === slot.posIndex);
      return {
        positionIndex: slot.posIndex,
        positionTitle: pos ? pos.title : `ตำแหน่งที่ ${slot.posIndex}`,
        cardName: `${slot.card.name} (${slot.card.thaiName})`,
        insight: `${slot.card.meaning}`
      };
    }),
    advice: sorted
      .slice(0, 3)
      .map((slot) => `• ${slot.card.thaiName}: ${slot.card.warning}`),
    closing:
      'จงรับฟังเสียงหัวใจของตนเองควบคู่กับคำเตือนจากหน้าไพ่ พลังแห่งโคลว์เป็นเพียงกระจกสะท้อนทางเลือก ส่วนผู้กำหนดก้าวต่อไปคือคุณเอง'
  };
}

export async function requestAiInterpretation({ spread, question, drawnCards }) {
  const cleanQuestion = (question || '').trim().slice(0, 500);
  const cacheKey = buildCacheKey(spread.spread_id, cleanQuestion, drawnCards);

  if (readingCache.has(cacheKey)) {
    return readingCache.get(cacheKey);
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

  try {
    const res = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // กรณีรันแบบ Static ล้วนๆ ยังไม่ได้เชื่อม Cloudflare Pages Function
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
  }
}

export function clearAiReadingCache() {
  readingCache.clear();
}
