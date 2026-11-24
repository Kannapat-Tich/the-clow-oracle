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
import { DAILY_READINGS } from '../../public/data/daily-readings.js';
import { DAILY_READINGS_EN } from '../../public/data/en/daily-readings.js';
import { ROMANCE_READINGS_DETAIL } from '../../public/data/romance-readings-detail.js';
import { GENERAL_READINGS_DETAIL } from '../../public/data/general-readings-detail.js';

const CARD_BY_ID = new Map(CARDS_DATA.map((c) => [c.id, c]));
const SPREAD_BY_ID = new Map(SPREADS_DATA.map((s) => [s.spread_id, s]));

// In-memory edge rate limit ต่อ isolate (ช่วยลดสแปมฟรีโดยไม่ต้องเสียค่า KV)
const ipHits = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQ = 12;

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

function getCuratedPositionReading(spreadId, card, posIndex, lang = 'th') {
  if (spreadId === 'daily_single') {
    const entry = lang === 'en' ? DAILY_READINGS_EN[card.id] : DAILY_READINGS[card.id];
    if (entry) {
      return {
        reading: entry.overview || card.meaning,
        advice: entry.advice || card.warning
      };
    }
  } else if (spreadId === 'love_cross') {
    const posText = ROMANCE_READINGS_DETAIL[card.id]?.[posIndex];
    if (posText) {
      return { reading: posText, advice: card.warning };
    }
  } else if (spreadId === 'general_six') {
    const posText = GENERAL_READINGS_DETAIL[card.id]?.[posIndex];
    if (posText) {
      return { reading: posText, advice: card.warning };
    }
  }
  return { reading: card.meaning, advice: card.warning };
}

function buildOraclePrompt({ spread, question, resolvedCards, lang = 'th' }) {
  const cardsText = resolvedCards
    .map(({ pos, card }) => {
      const curated = getCuratedPositionReading(spread.spread_id, card, pos.index, lang);
      return (
        `ตำแหน่งที่ ${pos.index}: ${pos.title} (${pos.meaning})\n` +
        `- ไพ่ที่ได้: ${card.name} (${card.thaiName}) [${card.elementThai}]\n` +
        `- คำทำนายต้นฉบับประจำตำแหน่งนี้ (ผ่านการเกลาตามคัมภีร์แล้ว): ${curated.reading}\n` +
        `- ข้อควรระวังตามคู่มือ: ${curated.advice}`
      );
    })
    .join('\n\n');

  if (lang === 'en') {
    const qBlockEn = question
      ? `=== USER'S QUESTION / REAL-LIFE CONTEXT ===\n"""${question}"""`
      : 'The user did not type a question (kept it in mind). Interpret the card spread cohesively.';
    return (
      `You are the warm, graceful keeper and skilled literary translator of "THE CLOW" Clow Card Oracle.\n` +
      `Language & Tone Rules:\n` +
      `1. Write in clear, accessible everyday English (CEFR A2–B1+ level) that still feels warm, comforting, and gracefully poetic. Avoid archaic words, stiff academic jargon, or overly difficult vocabulary.\n` +
      `2. Use the curated position-specific reading below as your faithful core meaning for each card.\n` +
      `3. First identify the user's real goal, worry, or decision from their question, then directly weave those concrete details into the overview, every relevant position insight, and advice.\n` +
      `4. Respond ONLY with valid JSON matching this exact schema:\n` +
      `{\n` +
      `  "connections": [\n` +
      `    { "positionIndex": 1, "positionTitle": "Position Title in English", "cardName": "CARD NAME", "insight": "Adapt the curated position reading directly to the user's specific situation (2-3 concise, warm sentences)" }\n` +
      `  ],\n` +
      `  "advice": ["1-2 concise, practical caution/guidance sentences tailored to the user's question"],\n` +
      `  "closing": "1 warm, encouraging closing sentence in graceful everyday English"\n` +
      `}\n\n` +
      `Spread: ${spread.engTitle}\n${qBlockEn}\n\nCurated Position Readings:\n${cardsText}`
    );
  }

  const userQuestionBlock = question
    ? `=== คำถาม/สถานการณ์จริงที่ผู้ใช้เล่ามา ===\n"""${question}"""`
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
    `1. ยึด "คำทำนายต้นฉบับประจำตำแหน่งนี้" ที่ให้ไว้ด้านล่างเป็นแกนความหมายหลักของไพ่แต่ละใบ ห้ามแต่งความหมายขัดแย้งกับต้นฉบับ และคงความละมุนสละสลวยในโทนเดียวกัน\n` +
    `2. หน้าที่หลักของคุณคือ "นำคำทำนายต้นฉบับประจำตำแหน่งมาผูกและต่อยอดให้ตรงกับคำถาม/สถานการณ์จริงที่ผู้ใช้เล่ามา" ให้แกะประเด็นสำคัญจากคำถามก่อนว่าผู้ใช้กำลังเผชิญเรื่องอะไร มีเป้าหมายหรือความกังวลเรื่องไหน หรือกำลังชั่งใจทางเลือกใด แล้วเอ่ยถึงบริบทจริงนั้นอย่างเป็นธรรมชาติและเฉพาะเจาะจงในทุกตำแหน่งที่เกี่ยวข้อง ห้ามคัดลอกต้นฉบับแบบกว้างๆ โดยไม่พูดถึงเรื่องที่ผู้ใช้ถาม\n` +
    `3. ชั่งน้ำหนักความเกี่ยวข้องอย่างเป็นธรรมชาติ: ตำแหน่งหลักที่ตรงกับปัญหาให้เจาะลึกผูกกับเรื่องที่ผู้ใช้ถามอย่างชัดเจน ส่วนตำแหน่งที่เป็นมุมมองกว้างหรือบรรยากาศแวดล้อมให้เชื่อมโยงอย่างนุ่มนวลไม่ฝืนยัดเยียด หากผู้ใช้ถามหลายประเด็นให้ตอบให้ครบถ้วน\n` +
    `4. ใช้ภาษาไทยสละสลวย ละมุนหู เป็นกลางและเป็นธรรมชาติ **ห้ามลงท้ายด้วยคำว่า "ครับ" หรือ "ค่ะ"** ในข้อความคำทำนายทุกส่วน **ห้ามใช้เครื่องหมายคอมม่า (,) ในประโยคภาษาไทย** และไม่ฟันธงเรื่องร้ายแรงหรือทำนายสุขภาพ/การแพทย์/กฎหมาย\n` +
    `5. ตอบกลับมาเป็น JSON เท่านั้น ตามโครงสร้างนี้เป๊ะๆ ห้ามมีข้อความอื่นนอก JSON:\n` +
    `{\n` +
    `  "connections": [\n` +
    `    {\n` +
    `      "positionIndex": 1,\n` +
    `      "positionTitle": "ชื่อตำแหน่ง",\n` +
    `      "cardName": "ชื่อไพ่ (ชื่อไทย)",\n` +
    `      "insight": "นำคำทำนายต้นฉบับประจำตำแหน่งนี้มาเรียบเรียงและผูกเข้ากับปัญหาหรือคำถามจริงของผู้ใช้โดยตรง (2-3 ประโยคกระชับ ไม่ต้องย้ำชื่อไพ่ ห้ามใช้คอมม่า และห้ามลงท้ายด้วยครับหรือค่ะ)"\n` +
    `    }\n` +
    `  ],\n` +
    `  "advice": ["สรุปข้อควรระวังและคำแนะนำที่สำคัญที่สุดให้ตรงกับคำถามของผู้ใช้ เพียง 1-2 ประโยคสั้นๆ (ไม่ต้องใส่คำนำหน้าว่า ไพ่เหล่านี้ต้องการเตือนคุณว่า ห้ามใช้คอมม่า และห้ามลงท้ายด้วยครับหรือค่ะ)"],\n` +
    `  "closing": "ข้อความให้กำลังใจสั้นๆ 1 ประโยคสไตล์คัมภีร์โคลว์"\n` +
    `}\n\n` +
    `ผังการเปิดไพ่: ${spread.name} (${spread.engTitle})\n` +
    `${spreadGuide}` +
    `${userQuestionBlock}\n\n` +
    `ฐานข้อมูลคำทำนายต้นฉบับประจำตำแหน่ง:\n${cardsText}`
  );
}

function safeParseJson(rawText) {
  if (!rawText) return null;
  let cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && (Array.isArray(parsed.connections) || typeof parsed.overview === 'string')) {
      return parsed;
    }
  } catch (_) {}
  return null;
}

let cachedDiscoveredModels = null;
let cachedDiscoveredAt = 0;
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000;

async function discoverActiveFlashModels(apiKey) {
  const now = Date.now();
  if (cachedDiscoveredModels && now - cachedDiscoveredAt < MODEL_CACHE_TTL_MS) {
    return cachedDiscoveredModels;
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    const usable = models
      .filter(
        (m) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          typeof m.name === 'string' &&
          /gemini/i.test(m.name) &&
          !/embedding|imagen|veo|tts|audio|live|aqa/i.test(m.name)
      )
      .map((m) => m.name.replace(/^models\//, ''));

    // จัดลำดับความสำคัญ: ให้ Flash-Lite รุ่นใหม่สุดมาก่อน (ตอบเร็ว 1-2 วินาที ไม่ติด 503/Timeout) ตามด้วย Flash รุ่นใหม่สุด
    usable.sort((a, b) => {
      const score = (id) => {
        let s = 0;
        if (/flash/i.test(id)) s += 100;
        if (/lite/i.test(id)) s += 40;
        if (/latest/i.test(id)) s += 15;
        if (/exp|preview/i.test(id)) s -= 5;
        const ver = id.match(/gemini-(\d+(?:\.\d+)?)/i);
        if (ver) s += parseFloat(ver[1]) * 10;
        return s;
      };
      return score(b) - score(a);
    });

    const top = usable.slice(0, 4);
    if (top.length > 0) {
      cachedDiscoveredModels = top;
      cachedDiscoveredAt = now;
    }
    return top;
  } catch (_) {
    return [];
  }
}

async function callGemini(apiKey, model, prompt, useThinkingZero = true) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const generationConfig = {
    temperature: 0.75,
    maxOutputTokens: 6144,
    responseMimeType: 'application/json'
  };
  if (useThinkingZero) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      })
    });

    if (res.status === 400 && useThinkingZero) {
      return callGemini(apiKey, model, prompt, false);
    }
    if (res.status === 429) {
      return { quotaExceeded: true, error: `${model}: HTTP 429` };
    }
    if (!res.ok) {
      return { error: `${model}: HTTP ${res.status}` };
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('\n').trim();
    const reading = safeParseJson(text);
    if (!reading) return { error: `${model}: Invalid JSON` };
    return { reading, provider: `Gemini (${model})` };
  } catch (err) {
    return { error: `${model}: ${err?.name || 'FetchError'}` };
  }
}

async function callGroq(apiKey, prompt) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
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

    if (res.status === 429) return { quotaExceeded: true, error: 'groq: HTTP 429' };
    if (!res.ok) return { error: `groq: HTTP ${res.status}` };

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const reading = safeParseJson(text);
    if (!reading) return { error: 'groq: Invalid JSON' };
    return { reading, provider: 'Groq (Llama 3.3 70B)' };
  } catch (err) {
    return { error: `groq: ${err?.name || 'FetchError'}` };
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(clientIp)) {
    return jsonResponse(
      {
        code: 'RATE_LIMITED',
        message:
          'คุณใช้สิทธิ์ตีความด้วย AI ครบตามโควต้าช่วงเวลานี้แล้ว โปรดรอสักครู่ (ประมาณ 10 นาที) หรืออ่านคำทำนายจากตำราต้นฉบับด้านล่างได้ทันที'
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
  const errors = [];

  if (geminiKey) {
    const discovered = await discoverActiveFlashModels(geminiKey);
    const candidates = Array.from(
      new Set([
        ...discovered,
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-3-flash-preview'
      ])
    ).slice(0, 4);

    for (const model of candidates) {
      const attempt = await callGemini(geminiKey, model, prompt);
      if (attempt.reading) return jsonResponse(attempt, 200);
      if (attempt.quotaExceeded) sawQuota = true;
      if (attempt.error) errors.push(attempt.error);
    }
  }

  if (groqKey) {
    const backup = await callGroq(groqKey, prompt);
    if (backup.reading) return jsonResponse(backup, 200);
    if (backup.quotaExceeded) sawQuota = true;
    if (backup.error) errors.push(backup.error);
  }

  if (sawQuota) {
    return jsonResponse(
      {
        code: 'QUOTA_EXCEEDED',
        detail: errors.join(' | '),
        message:
          lang === 'en'
            ? 'Our free AI reading quota is busy right now. You can still read your full guidebook message below.'
            : 'พลังเวทของ AI ฟรีในชั่วโมงนี้มีผู้ใช้งานหนาแน่นเกินโควต้า คุณยังสามารถอ่านคำทำนายจากตำราโคลว์การ์ดต้นฉบับด้านล่างได้ครบถ้วน'
      },
      429
    );
  }

  return jsonResponse(
    {
      code: 'AI_UNAVAILABLE',
      detail: errors.join(' | '),
      message:
        lang === 'en'
          ? 'The AI reader is taking a brief rest. You can read your complete guidebook interpretation below.'
          : 'ห้องพยากรณ์ AI ไม่พร้อมใช้งานชั่วคราว สามารถอ่านคำทำนายจากตำราต้นฉบับด้านล่างได้ทันที'
    },
    502
  );
}
