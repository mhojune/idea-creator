export interface Env {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGINS?: string; // 쉼표(,)로 구분된 오리진 목록. 미설정 시 * 허용
}

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  } as Record<string, string>;
}

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function extractJsonArray(text: string): unknown[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  const fenced = /```json[\s\S]*?```/gi.exec(text);
  if (fenced && fenced[0]) {
    const inner = fenced[0].replace(/```json|```/gi, "").trim();
    try {
      const parsed = JSON.parse(inner);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try {
      const parsed = JSON.parse(slice);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

async function handleGenerate(request: Request, env: Env) {
  const { topic = "", category = "전체", simpleOnly = false, monetizableOnly = false } =
    (await request.json().catch(() => ({}))) as any;

  const categoryHint = category === "전체" ? "" : `선택된 카테고리: ${category}.`;
  const filterHint = [
    simpleOnly ? "복잡도는 가급적 '간단' 위주" : null,
    monetizableOnly ? "수익화 가능성이 높은 아이디어 위주" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const prompt = [
    "당신은 창의적인 제품/콘텐츠 아이디어 생성기입니다.",
    `주제: ${topic || "랜덤"}. ${categoryHint}`,
    filterHint ? `필터: ${filterHint}.` : "",
    "한국어로 3~5개의 새로운 아이디어를 제안하세요.",
    "다음 JSON 스키마를 엄격히 따르고, JSON 배열만 출력하세요 (추가 설명, 마크다운 금지).",
    "각 아이디어 객체는 {",
    "  title: string,",
    "  description: string,",
    "  complexity: '간단' | '중간' | '어려움',",
    "  monetizable: boolean,",
    "  category: '스타트업' | '콘텐츠' | '앱' | '게임' | '학습 도구' | '기타',",
    "  tags?: string[]",
    "}",
  ]
    .filter(Boolean)
    .join("\n");

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
    encodeURIComponent(env.GEMINI_API_KEY);

  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return json({ error: text || `Upstream error ${resp.status}` }, { status: 502 });
  }
  const data = (await resp.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const array = extractJsonArray(text);
  return json({ ideas: array });
}

export default {
  async fetch(request: Request, env: Env) {
    const cors = buildCorsHeaders();

    if (request.method === "OPTIONS") {
      // If origin is not allowed, return 204 without ACAO to make the failure explicit on client
      return new Response(null, { status: 204, headers: { ...cors } });
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === "/generate" && request.method === "POST") {
        const res = await handleGenerate(request, env);
        const headers = new Headers(res.headers);
        Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
        return new Response(res.body, { status: res.status, headers });
      }
      return new Response("Not Found", { status: 404, headers: { ...cors } });
    } catch (e: any) {
      return new Response(e?.message || "Internal Error", { status: 500, headers: { ...cors } });
    }
  },
};


