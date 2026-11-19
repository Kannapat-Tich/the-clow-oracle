/**
 * THE CLOW — Cloudflare Pages Function (/api/analytics)
 * เก็บสถิติการใช้งานแบบละเอียดสำหรับงาน Data Science โดยไม่เก็บข้อมูลส่วนบุคคล (ไม่มี IP/คำถามผู้ใช้)
 *
 * รองรับ:
 * - POST /api/analytics : บันทึก Event (page_view, spread_start, card_draw, card_reveal, summary_view, summary_share)
 * - GET  /api/analytics?key=<ANALYTICS_ADMIN_KEY> : ดูสรุปสถิติ JSON (ยอดเข้าชม, ผังยอดนิยม, อันดับไพ่, รายวัน)
 * - GET  /api/analytics?key=<ANALYTICS_ADMIN_KEY>&format=csv : ดาวน์โหลดข้อมูลดิบเป็น CSV สำหรับ Data Science
 */

const ALLOWED_EVENTS = new Set([
  'page_view',
  'spread_start',
  'card_draw',
  'card_reveal',
  'summary_view',
  'summary_share'
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function csvEscape(val) {
  const s = val === null || val === undefined ? '' : String(val);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  const eventType = String(body?.eventType || '').trim();
  if (!ALLOWED_EVENTS.has(eventType)) {
    return json({ ok: false, error: 'INVALID_EVENT' }, 400);
  }

  const db = env?.ANALYTICS_DB;
  if (!db) {
    return json({ ok: true, stored: false, note: 'ANALYTICS_DB binding not configured yet' }, 202);
  }

  const sessionId = String(body?.sessionId || 'anon').slice(0, 64);
  const spreadId = body?.spreadId ? String(body.spreadId).slice(0, 64) : null;
  const spreadName = body?.spreadName ? String(body.spreadName).slice(0, 120) : null;
  const cardId = body?.cardId ? String(body.cardId).slice(0, 64) : null;
  const cardName = body?.cardName ? String(body.cardName).slice(0, 120) : null;
  const posIndex = Number.isFinite(Number(body?.posIndex)) ? Number(body.posIndex) : null;
  const aiMode = body?.aiMode ? String(body.aiMode).slice(0, 32) : null;
  const viewportW = Number.isFinite(Number(body?.viewportW)) ? Number(body.viewportW) : null;

  await db
    .prepare(
      `INSERT INTO analytics_events (event_type, session_id, spread_id, spread_name, card_id, card_name, pos_index, ai_mode, viewport_w)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(eventType, sessionId, spreadId, spreadName, cardId, cardName, posIndex, aiMode, viewportW)
    .run();

  return json({ ok: true, stored: true }, 201);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const adminKey = env?.ANALYTICS_ADMIN_KEY;
  const reqKey = url.searchParams.get('key');

  if (!adminKey || reqKey !== adminKey) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const db = env?.ANALYTICS_DB;
  if (!db) {
    return json({ error: 'ANALYTICS_DB_NOT_CONFIGURED' }, 503);
  }

  const format = url.searchParams.get('format');
  if (format === 'csv') {
    const limit = Math.min(10000, Math.max(1, Number(url.searchParams.get('limit') || 5000)));
    const { results } = await db
      .prepare(
        `SELECT id, event_type, session_id, spread_id, spread_name, card_id, card_name, pos_index, ai_mode, viewport_w, created_at
         FROM analytics_events ORDER BY id DESC LIMIT ?`
      )
      .bind(limit)
      .all();

    const headers = [
      'id',
      'event_type',
      'session_id',
      'spread_id',
      'spread_name',
      'card_id',
      'card_name',
      'pos_index',
      'ai_mode',
      'viewport_w',
      'created_at'
    ];
    const rows = [headers.join(',')];
    for (const row of results || []) {
      rows.push(headers.map((h) => csvEscape(row[h])).join(','));
    }

    return new Response(rows.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="the-clow-analytics.csv"',
        'Cache-Control': 'no-store'
      }
    });
  }

  const [totalsRes, spreadsRes, cardsRes, dailyRes] = await Promise.all([
    db
      .prepare(
        `SELECT event_type, COUNT(*) AS count, COUNT(DISTINCT session_id) AS unique_sessions
         FROM analytics_events GROUP BY event_type`
      )
      .all(),
    db
      .prepare(
        `SELECT spread_id, spread_name, COUNT(*) AS count
         FROM analytics_events
         WHERE event_type = 'spread_start' AND spread_id IS NOT NULL
         GROUP BY spread_id, spread_name
         ORDER BY count DESC`
      )
      .all(),
    db
      .prepare(
        `SELECT card_id, card_name, COUNT(*) AS draw_count
         FROM analytics_events
         WHERE event_type = 'card_draw' AND card_id IS NOT NULL
         GROUP BY card_id, card_name
         ORDER BY draw_count DESC`
      )
      .all(),
    db
      .prepare(
        `SELECT substr(created_at, 1, 10) AS day,
                SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS visits,
                SUM(CASE WHEN event_type = 'summary_view' THEN 1 ELSE 0 END) AS completed_readings
         FROM analytics_events
         GROUP BY day
         ORDER BY day DESC
         LIMIT 30`
      )
      .all()
  ]);

  const topSpreads = spreadsRes.results || [];
  return json({
    totalsByEvent: totalsRes.results || [],
    mostPopularSpread: topSpreads[0] || null,
    spreadRanking: topSpreads,
    cardDrawFrequencies: cardsRes.results || [],
    dailyTrend: dailyRes.results || []
  });
}
