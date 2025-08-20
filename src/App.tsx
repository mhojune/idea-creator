import { useEffect, useMemo, useState } from "react";

type Category = "전체" | "스타트업" | "콘텐츠" | "앱" | "게임" | "학습 도구";

type Idea = {
  id: string;
  title: string;
  description: string;
  complexity: "간단" | "중간" | "어려움";
  monetizable: boolean;
  category: Category | string;
  tags?: string[];
};

const CATEGORIES: Category[] = ["전체", "스타트업", "콘텐츠", "앱", "게임", "학습 도구"];

const RANDOM_TOPICS = [
  "헬스",
  "유튜브 콘텐츠",
  "스타트업",
  "교육",
  "여행",
  "생산성",
  "게임",
  "음악",
  "개발자 도구",
  "웹 개발",
];

function generateStableId(input: string): string {
  const data = new TextEncoder().encode(input);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash * 31 + data[i]) >>> 0;
  }
  return `id_${hash.toString(16)}`;
}

function mapRawIdeas(raw: any[]): Idea[] {
  return raw
    .map((item) => {
      const title = String(item.title ?? item.name ?? "").trim();
      const description = String(item.description ?? item.detail ?? "").trim();
      const complexityRaw = String(item.complexity ?? item.level ?? "").trim();
      const monetizableRaw =
        item.monetizable ?? item.monetization ?? item.monetizationPossible;
      const category = String(item.category ?? "기타").trim();
      if (!title || !description) return null;
      const complexity: Idea["complexity"] =
        complexityRaw === "간단" || complexityRaw === "쉬움"
          ? "간단"
          : complexityRaw === "어려움" || complexityRaw === "고급"
          ? "어려움"
          : "중간";
      const monetizable = Boolean(monetizableRaw);
      return {
        id: generateStableId(`${title}__${description}`),
        title,
        description,
        complexity,
        monetizable,
        category,
        tags: Array.isArray(item.tags) ? item.tags.map(String) : undefined,
      } as Idea;
    })
    .filter(Boolean) as Idea[];
}

export default function App() {
  const apiBase = import.meta.env.VITE_IDEA_API_BASE as string | undefined;
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState<Category>("전체");
  const [simpleOnly, setSimpleOnly] = useState(false);
  const [monetizableOnly, setMonetizableOnly] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [favorites, setFavorites] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("idea_creator_favorites");
      if (raw) setFavorites(JSON.parse(raw));
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("idea_creator_favorites", JSON.stringify(favorites));
    } catch (_) {}
  }, [favorites]);

  const filteredIdeas = useMemo(() => {
    return ideas.filter((i) => {
      if (category !== "전체" && String(i.category).trim() !== category) return false;
      if (simpleOnly && i.complexity !== "간단") return false;
      if (monetizableOnly && !i.monetizable) return false;
      return true;
    });
  }, [ideas, category, simpleOnly, monetizableOnly]);

  const hasProxy = Boolean(apiBase && apiBase.trim());

  async function generateIdeas() {
    setLoading(true);
    setError(null);
    try {
      if (!hasProxy) {
        throw new Error(
          "프록시 API가 설정되어 있지 않습니다. .env.local에 VITE_IDEA_API_BASE를 설정하세요."
        );
      }

      const res = await fetch(`${apiBase!.replace(/\/$/, "")}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, category, simpleOnly, monetizableOnly }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `프록시 오류: ${res.status}`);
      }
      const data = await res.json();
      const mapped = mapRawIdeas(Array.isArray(data?.ideas) ? data.ideas : []);
      if (mapped.length === 0) {
        throw new Error(
          "응답 파싱에 실패했어요. 프롬프트를 조금 바꿔 다시 시도해 주세요."
        );
      }
      setIdeas(mapped);
    } catch (err: any) {
      setError(err?.message || "아이디어 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function onRandomTopic() {
    const picked = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
    setTopic(picked);
  }

  async function copyIdea(idea: Idea) {
    const payload = `아이디어: ${idea.title}\n설명: ${idea.description}\n복잡도: ${
      idea.complexity
    }\n수익화 가능: ${idea.monetizable ? "예" : "아니오"}\n카테고리: ${idea.category}`;
    await navigator.clipboard.writeText(payload);
  }

  function toggleFavorite(idea: Idea) {
    setFavorites((prev) => {
      const exists = prev.some((x) => x.id === idea.id);
      if (exists) return prev.filter((x) => x.id !== idea.id);
      return [idea, ...prev];
    });
  }

  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">아이디어 크리에이터</h1>
          <p className="text-sm text-gray-600">
            주제를 입력하면 LLM이 3~5개의 새로운 아이디어를 제안합니다.
          </p>
        </header>

        {!hasProxy && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            환경 변수 VITE_IDEA_API_BASE가 설정되어 있지 않습니다. 루트에 .env.local을
            만들고 Cloudflare Worker URL(예:
            https://your-worker.your-subdomain.workers.dev)을 넣어주세요.
          </div>
        )}

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            className="sm:col-span-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="주제 또는 키워드 (예: 헬스, 웹 개발, 게임)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              onClick={generateIdeas}
              disabled={loading}
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "생성 중..." : "아이디어 생성"}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={simpleOnly}
              onChange={(e) => setSimpleOnly(e.target.checked)}
            />
            간단한 것만
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={monetizableOnly}
              onChange={(e) => setMonetizableOnly(e.target.checked)}
            />
            수익화 가능한 것만
          </label>
          <button
            onClick={onRandomTopic}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            랜덤 주제
          </button>
          <button
            onClick={generateIdeas}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            다시 생성
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </div>
        )}

        <section className="space-y-3">
          {filteredIdeas.length === 0 && !loading && (
            <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              아이디어가 없습니다. 주제를 입력하고 생성해 보세요.
            </div>
          )}

          {filteredIdeas.map((idea) => {
            const isFav = favorites.some((f) => f.id === idea.id);
            return (
              <div
                key={idea.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold">{idea.title}</h3>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => copyIdea(idea)}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      복사
                    </button>
                    <button
                      onClick={() => toggleFavorite(idea)}
                      className={`rounded-md px-2 py-1 text-xs ${
                        isFav
                          ? "bg-yellow-500 text-white"
                          : "border border-gray-300 bg-white hover:bg-gray-50"
                      }`}
                    >
                      {isFav ? "즐겨찾기✓" : "즐겨찾기"}
                    </button>
                  </div>
                </div>
                <p className="mb-3 text-sm leading-6 text-gray-700">{idea.description}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2 py-1">
                    복잡도: {idea.complexity}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 ${
                      idea.monetizable ? "bg-emerald-100 text-emerald-700" : "bg-gray-100"
                    }`}
                  >
                    수익화: {idea.monetizable ? "가능" : "불가"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-1">
                    카테고리: {idea.category}
                  </span>
                  {idea.tags?.slice(0, 5).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-blue-50 px-2 py-1 text-blue-700"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {favorites.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-base font-semibold">즐겨찾기</h2>
            <div className="space-y-2">
              {favorites.map((f) => (
                <div
                  key={f.id}
                  className="rounded-md border border-gray-200 bg-white p-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-medium">{f.title}</div>
                    <button
                      onClick={() => toggleFavorite(f)}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      제거
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 line-clamp-2">
                    {f.description}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
