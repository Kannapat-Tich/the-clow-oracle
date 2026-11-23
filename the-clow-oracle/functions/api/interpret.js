/**
 * THE CLOW — Cloudflare Pages Function (/api/interpret)
 * ฟรี 100,000 requests/วัน บน Cloudflare Pages
 *
 * คุณสมบัติ:
 * 1. อ้างอิงความหมายไพ่จากคัมภีร์ต้นฉบับฝั่งเซิร์ฟเวอร์ (public/data/cards.js & spreads.js)
 * 2. เรียก Google Gemini Free Tier (gemini-2.5-flash -> fallback gemini-2.5-flash-lite)
 *    และสลับไป Groq Free Tier อัตโนมัติหากตั้งค่า GROQ_API_KEY สำรองไว้
 * 3. มี Rate Limit ต่อ IP แบบเบาๆ (5 ครั้ง / 10 นาที) เพื่อกันสแปมและถนอมโควต้าฟรีตอนคนเข้าเยอะ
 * 4. ไม่บันทึกคำถามหรือข้อมูลส่วนตัวลงฐานข้อมูลใดๆ
 */

import { CARDS_DATA } from '../../public/data/cards.js';
import { SPREADS_DATA } from '../../public/data/spreads.js';

const CARD_BY_ID = new Map(CARDS_DATA.map((c) => [c.id, c]));
const SPREAD_BY_ID = new Map(SPREADS_DATA.map((s) => [s.spread_id, s]));

// In-memory edge rate limit ต่อ isolate (ช่วยลดสแปมฟรีโดยไม่ต้องเสียค่า KV)
const ipHits = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQ = 6;

function isRateLimited(ip) {
  const now = Date.now();
  if (ipHits.size > 500) {
    for (const [key, val] of ipHits.entries()) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) {
        ipHits.delete(key);
      }
    }
  }
  const record = ipHits.get(ip);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipHits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  record.count += 1;
  return record.count > RATE_LIMIT_MAX_REQ;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function buildOraclePrompt({ spread, question, resolvedCards, lang = 'th' }) {
  const cardsText = resolvedCards
    .map(
      ({ pos, card }) =>
        `ตำแหน่งที่ ${pos.index}: ${pos.title} (${pos.meaning})\n` +
        `- ไพ่ที่ได้: ${card.name} (${card.thaiName}) [${card.elementThai}]\n` +
        `- คีย์เวิร์ด: ${card.keywords.join(', ')}\n` +
        `- ความหมายตามคู่มือ: ${card.meaning}\n` +
        `- ข้อควรระวังตามคู่มือ: ${card.warning}`
    )
    .join('\n\n');

  if (lang === 'en') {
    const qBlockEn = question
      ? `User's question/context:\n"""${question}"""`
      : 'The user did not type a question (kept it in mind). Interpret the card spread cohesively.';
    return (
      `You are the warm, thoughtful keeper of "THE CLOW" Clow Card Oracle.\n` +
      `Rules:\n` +
      `1. Stay faithful to the guidebook card meanings and warnings below.\n` +
      `2. Directly weave the user's question/context into every section (overview, per-position insight, advice).\n` +
      `3. Respond ONLY with valid JSON matching this exact schema in natural, clear English:\n` +
      `{\n` +
      `  "overview": "Concise sequential summary of all drawn cards (3-5 sentences)",\n` +
      `  "connections": [\n` +
      `    { "positionIndex": 1, "positionTitle": "Position Title", "cardName": "CARD NAME", "insight": "Direct 2-3 sentence reading tailored to this position and user's context" }\n` +
      `  ],\n` +
      `  "advice": ["1-2 concise warning sentences summarizing the key cautions across the cards"],\n` +
      `  "closing": "1 warm encouraging closing sentence"\n` +
      `}\n\n` +
      `Spread: ${spread.engTitle}\n${qBlockEn}\n\nGuidebook Card Data:\n${cardsText}`
    );
  }

  const userQuestionBlock = question
    ? `ปัญหา/คำถามที่ผู้ใช้เล่ามา:\n"""${question}"""`
    : 'ผู้ใช้ไม่ได้ระบุคำถามเป็นข้อความ (อธิษฐานในใจ) ให้ตีความเชื่อมโยงภาพรวมของหน้าไพ่ให้สอดคล้องกันอย่างลึกซึ้ง';

  let spreadGuide = '';
  if (spread.spread_id === 'love_cross') {
    spreadGuide =
      'โครงสร้างผังทำนายความรัก 7 ใบ: ตำแหน่งที่ 1 คือลักษณะนิสัยและตัวตนของอีกฝ่าย ตำแหน่งที่ 2→3→4 คือเส้นเวลาความสัมพันธ์จากอดีตสู่ปัจจุบันและอนาคต ตำแหน่งที่ 5 คืออุปสรรคหรือบททดสอบที่ต้องก้าวข้าม ตำแหน่งที่ 6 คือผลลัพธ์ของความรัก และตำแหน่งที่ 7 คือคำแนะนำเชิงปฏิบัติในการก้าวข้ามอุปสรรค ต้องระบุประธานให้ชัดเจนว่ากำลังกล่าวถึงอีกฝ่ายหรือความสัมพันธ์ระหว่างคุณสองคน\n';
  } else if (spread.spread_id === 'general_six') {
    spreadGuide =
      'โครงสร้างผังทำนายเรื่องทั่วไป 10 ใบ: ตำแหน่งที่ 1 คือหัวใจของเรื่อง 2 คือสาเหตุ 3 คือปัญหาในอดีตที่เกี่ยวข้อง 4 คือสถานการณ์แวดล้อม 5 คือทางออกของปัญหา 6 คือกุญแจสำคัญในการแก้ปัญหา 7 คืออุปสรรคระหว่างทาง 8 คืออนาคตของเรื่องนี้ 9 คือผลลัพธ์สุดท้าย และ 10 คือมุมมองรอบข้างและระยะยาว ต้องเชื่อมโยงให้เป็นเรื่องราวต่อเนื่องและตอบตรงประเด็น\n';
  }

  return (
    `คุณคือ "บรรณาธิการและผู้ดูแลคัมภีร์พยากรณ์ไพ่โคลว์การ์ด (THE CLOW)" ที่ถ่ายทอดภาษาไทยได้ละมุนหู สุขุม อ่อนโยน และซื่อสัตย์ต่อคู่มือไพ่โคลว์การ์ดต้นฉบับ\n` +
    `กติกาสำคัญ:\n` +
    `1. ยึดความหมายหลักและข้อควรระวังจากคู่มือที่ให้ไว้ด้านล่างเป็นแกนหลัก ห้ามแต่งความหมายไพ่ขัดแย้งกับคู่มือ\n` +
    `2. ต้องตอบให้เชื่อมโยงกับ "ปัญหา/คำถามที่ผู้ใช้เล่ามา" อย่างเป็นธรรมชาติ โดยรู้จักชั่งน้ำหนักความเกี่ยวข้องของไพ่แต่ละใบ: ใบที่ความหมายตรงกับประเด็นปัญหาให้เจาะลึกผูกกับบริบทจริงของผู้ใช้เต็มที่ ส่วนใบที่สื่อพลังเสริมหรือมุมมองกว้างๆ ให้เชื่อมโยงอย่างนุ่มนวลโดยไม่ฝืนยัดเยียด หากผู้ใช้เล่าเรื่องยาวหรือถามซ้อนหลายประเด็น ให้จับแก่นคำถามหลักทั้งหมดออกมาตอบให้ครบถ้วน\n` +
    `3. ใน "overview" ต้องเล่าเรื่องตามลำดับของไพ่ทีละใบอย่างกระชับและเข้าใจง่าย ว่าไพ่แต่ละใบบอกอะไรกับผู้ถามตั้งแต่ใบแรกจนถึงใบสุดท้าย โดยไม่ต้องเน้นชื่อไพ่หรือศัพท์ตำแหน่งที่ทำให้ผู้อ่านสับสน\n` +
    `4. ใช้ภาษาไทยสละสลวย ละมุนหู เป็นกลางและเป็นธรรมชาติ **ห้ามลงท้ายด้วยคำว่า "ครับ" หรือ "ค่ะ"** ในข้อความคำทำนายทุกส่วน **ห้ามใช้เครื่องหมายคอมม่า (,) ในประโยคภาษาไทย** และไม่ฟันธงเรื่องร้ายแรงหรือทำนายสุขภาพ/การแพทย์/กฎหมาย\n` +
    `5. ตอบกลับมาเป็น JSON เท่านั้น ตามโครงสร้างนี้เป๊ะๆ ห้ามมีข้อความอื่นนอก JSON:\n` +
    `{\n` +
    `  "overview": "เล่าสรุปตามลำดับของไพ่ทีละใบอย่างกระชับว่าไพ่แต่ละใบบอกอะไรกับปัญหาของผู้ใช้โดยตรง (3-5 ประโยค)",\n` +
    `  "connections": [\n` +
    `    {\n` +
    `      "positionIndex": 1,\n` +
    `      "positionTitle": "ชื่อตำแหน่ง",\n` +
    `      "cardName": "ชื่อไพ่ (ชื่อไทย)",\n` +
    `      "insight": "อธิบายตรงๆ ว่าไพ่ใบนี้บอกอะไรกับผู้ถามและสถานการณ์ในตำแหน่งนี้ (2-3 ประโยคกระชับ ไม่ต้องย้ำชื่อไพ่ ห้ามใช้คอมม่า และห้ามลงท้ายด้วยครับหรือค่ะ)"\n` +
    `    }\n` +
    `  ],\n` +
    `  "advice": ["สรุปคำเตือนหรือคำแนะนำที่สำคัญที่สุดให้สั้นและกระชับ เพียง 1-2 ประโยคสั้นๆ (ไม่ต้องใส่คำนำหน้าว่า ไพ่เหล่านี้ต้องการเตือนคุณว่า ห้ามใช้คอมม่า และห้ามลงท้ายด้วยครับหรือค่ะ)"],\n` +
    `  "closing": "ข้อความให้กำลังใจสั้นๆ 1 ประโยคสไตล์คัมภีร์โคลว์"\n` +
    `}\n\n` +
    `ผังการเปิดไพ่: ${spread.name} (${spread.engTitle})\n` +
    `${spreadGuide}` +
    `${userQuestionBlock}\n\n` +
    `ข้อมูลไพ่จากคู่มือต้นฉบับ:\n${cardsText}`
  );
}

function safeParseJson(rawText) {
  if (!rawText) return null;
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.overview === 'string') return parsed;
  } catch (_) {}
  return null;
}

async function callGemini(apiKey, model, prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const generationConfig = {
    temperature: 0.75,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json'
  };
  if (model === 'gemini-2.5-flash') {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(22000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig
    })
  });

  if (res.status === 429) {
    return { quotaExceeded: true };
  }
  if (!res.ok) {
    return { error: `Gemini HTTP ${res.status}` };
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const reading = safeParseJson(text);
  if (!reading) return { error: 'Invalid JSON from Gemini' };
  return { reading, provider: `Gemini (${model})` };
}

async function callGroq(apiKey, prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (res.status === 429) return { quotaExceeded: true };
  if (!res.ok) return { error: `Groq HTTP ${res.status}` };

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const reading = safeParseJson(text);
  if (!reading) return { error: 'Invalid JSON from Groq' };
  return { reading, provider: 'Groq (Llama 3.3 70B)' };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(clientIp)) {
    return jsonResponse(
      {
        code: 'RATE_LIMITED',
        message:
          'คุณใช้สิทธิ์ตีความด้วย AI ครบตามโควต้าช่วงเวลานี้แล้ว โปรดรอสักครู่ (ประมาณ 10 นาที) หรืออ่านคำทำนายจากตำราต้นฉบับด้านล่างได้ทันทีครับ'
      },
      429
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({ code: 'BAD_REQUEST', message: 'รูปแบบคำขอไม่ถูกต้อง' }, 400);
  }

  const spread = SPREAD_BY_ID.get(body?.spreadId);
  if (!spread) {
    return jsonResponse({ code: 'INVALID_SPREAD', message: 'ไม่พบผังไพ่ที่ระบุ' }, 400);
  }

  const rawCards = Array.isArray(body?.cards) ? body.cards : [];
  if (rawCards.length === 0 || rawCards.length > spread.card_count) {
    return jsonResponse({ code: 'INVALID_CARDS', message: 'จำนวนไพ่ไม่ถูกต้อง' }, 400);
  }

  const resolvedCards = [];
  for (const item of rawCards) {
    const card = CARD_BY_ID.get(item?.cardId);
    const pos = spread.positions.find((p) => p.index === Number(item?.posIndex));
    if (!card || !pos) {
      return jsonResponse({ code: 'UNKNOWN_CARD', message: 'ข้อมูลไพ่ไม่ตรงกับคัมภีร์' }, 400);
    }
    resolvedCards.push({ pos, card });
  }

  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, 500) : '';
  const lang = body?.lang === 'en' ? 'en' : 'th';
  const geminiKey = env?.GEMINI_API_KEY;
  const groqKey = env?.GROQ_API_KEY;

  if (!geminiKey && !groqKey) {
    return jsonResponse(
      { code: 'NO_API_KEY', message: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บน Cloudflare Pages' },
      503
    );
  }

  const prompt = buildOraclePrompt({ spread, question, resolvedCards, lang });
  let sawQuota = false;

  if (geminiKey) {
    const primary = await callGemini(geminiKey, 'gemini-2.5-flash', prompt);
    if (primary.reading) return jsonResponse(primary, 200);
    if (primary.quotaExceeded) sawQuota = true;

    const lite = await callGemini(geminiKey, 'gemini-2.5-flash-lite', prompt);
    if (lite.reading) return jsonResponse(lite, 200);
    if (lite.quotaExceeded) sawQuota = true;
  }

  if (groqKey) {
    const backup = await callGroq(groqKey, prompt);
    if (backup.reading) return jsonResponse(backup, 200);
    if (backup.quotaExceeded) sawQuota = true;
  }

  if (sawQuota) {
    return jsonResponse(
      {
        code: 'QUOTA_EXCEEDED',
        message:
          'พลังเวทของ AI ฟรีในชั่วโมงนี้มีผู้ใช้งานหนาแน่นเกินโควต้า คุณยังสามารถอ่านคำทำนายจากตำราโคลว์การ์ดต้นฉบับด้านล่างได้ครบถ้วนครับ'
      },
      429
    );
  }

  return jsonResponse(
    {
      code: 'AI_UNAVAILABLE',
      message: 'ห้องพยากรณ์ AI ไม่พร้อมใช้งานชั่วคราว กรุณาอ่านคำทำนายจากตำราต้นฉบับด้านล่างแทนครับ'
    },
    502
  );
}
