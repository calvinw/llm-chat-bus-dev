import { useState, useCallback, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, RotateCcw, Check, RefreshCw, Sparkles,
  BookmarkPlus, BookmarkCheck, List, ArrowLeft, Calculator,
} from 'lucide-react';
import { FLASHCARDS } from '@/utils/flashcards';

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

// Muted tint only — all share the same glass base
const DIFFICULTY_STYLES = {
  easy:   {
    active:   'bg-emerald-400/20 border-emerald-300/40 text-emerald-800 dark:text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.15)] backdrop-blur-sm',
    inactive: 'bg-white/10 border-white/20 text-slate-500 dark:text-slate-400 hover:bg-white/20 backdrop-blur-sm',
  },
  medium: {
    active:   'bg-amber-400/20 border-amber-300/40 text-amber-800 dark:text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.15)] backdrop-blur-sm',
    inactive: 'bg-white/10 border-white/20 text-slate-500 dark:text-slate-400 hover:bg-white/20 backdrop-blur-sm',
  },
  hard:   {
    active:   'bg-rose-400/20 border-rose-300/40 text-rose-800 dark:text-rose-300 shadow-[0_0_10px_rgba(251,113,133,0.15)] backdrop-blur-sm',
    inactive: 'bg-white/10 border-white/20 text-slate-500 dark:text-slate-400 hover:bg-white/20 backdrop-blur-sm',
  },
};

// Very muted tints — just enough to differentiate categories
const CATEGORY_COLORS = {
  'Income Statement':       'bg-sky-300/10 border-sky-300/25 text-sky-700 dark:text-sky-300',
  'Balance Sheet':          'bg-violet-300/10 border-violet-300/25 text-violet-700 dark:text-violet-300',
  'Strategic Profit Model': 'bg-amber-300/10 border-amber-300/25 text-amber-700 dark:text-amber-300',
  'Retail Metrics':         'bg-rose-300/10 border-rose-300/25 text-rose-700 dark:text-rose-300',
  'Liquidity':              'bg-cyan-300/10 border-cyan-300/25 text-cyan-700 dark:text-cyan-300',
  'Leverage':               'bg-orange-300/10 border-orange-300/25 text-orange-700 dark:text-orange-300',
  'Advanced Financials':    'bg-indigo-300/10 border-indigo-300/25 text-indigo-700 dark:text-indigo-300',
};

const VALID_CATEGORIES = Object.keys(CATEGORY_COLORS);

// ── Shared glass style tokens ──────────────────────────────────────────────

const GLASS_CARD  = 'backdrop-blur-xl bg-white/15 dark:bg-white/8 border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.25)]';
const GLASS_BTN   = 'bg-white/10 border-white/20 text-slate-600 dark:text-slate-300 hover:bg-white/22 backdrop-blur-sm transition-colors';
const GLASS_ACTIVE = 'bg-white/25 border-white/40 text-slate-800 dark:text-white backdrop-blur-sm shadow-sm';

// ── Equation utilities ─────────────────────────────────────────────────────

function getCardEquation(card) {
  const m = card.back.match(/Formula:\s*([^\n]+)/);
  if (m) return `${card.front} = ${m[1].trim()}`;
  for (const line of card.back.split('\n')) {
    const t = line.trim();
    if (/\w[\w\s%'()]*\s*=\s*\w/.test(t) && !t.includes('NOT') && !t.includes("isn't")) {
      return t.split('→')[0].split(' — ')[0].trim();
    }
  }
  return null;
}

const EQ_OPS = new Set(['=', '×', '÷', '+', '−']);

function tokenizeEq(eq) {
  const result = [];
  let buf = '', depth = 0;
  for (const ch of eq) {
    if (ch === '(') { depth++; buf += ch; }
    else if (ch === ')') { depth--; buf += ch; }
    else if (depth === 0 && EQ_OPS.has(ch)) {
      if (buf.trim()) result.push(buf.trim());
      result.push(ch);
      buf = '';
    } else { buf += ch; }
  }
  if (buf.trim()) result.push(buf.trim());
  return result;
}

function getBlankableIndices(tokens) {
  return tokens.reduce((acc, t, i) => {
    const clean = t.replace(/[()]/g, '').trim();
    if (!EQ_OPS.has(t) && clean && !/^\d+$/.test(clean) && !/[=×÷+−]/.test(clean)) acc.push(i);
    return acc;
  }, []);
}

function normalizeAns(s) {
  return s.toLowerCase().replace(/[%()×÷+−=\-]/g, '').replace(/\s+/g, ' ').trim();
}

// ── Component ─────────────────────────────────────────────────────────────

export function FlashcardDeck({ onCardChange }) {
  const [difficulty, setDifficulty]         = useState('easy');
  const [topic, setTopic]                   = useState('All');
  const [index, setIndex]                   = useState(0);
  const [flipped, setFlipped]               = useState(false);
  const [known, setKnown]                   = useState({});
  const [studying, setStudying]             = useState({});
  const [saved, setSaved]                   = useState({});
  const [generatedCards, setGeneratedCards] = useState([]);
  const [generating, setGenerating]         = useState(false);
  const [generateMsg, setGenerateMsg]       = useState('');
  const [showMyList, setShowMyList]         = useState(false);
  const [eqMode, setEqMode]                 = useState(false);
  const [userAnswer, setUserAnswer]         = useState('');
  const [answerChecked, setAnswerChecked]   = useState(false);
  const [answerCorrect, setAnswerCorrect]   = useState(false);
  const [blankChoice, setBlankChoice]       = useState(0);

  // ── Derived deck ────────────────────────────────────────────────────────

  const allCards     = useMemo(() => [...FLASHCARDS, ...generatedCards], [generatedCards]);
  const byDifficulty = useMemo(() => allCards.filter(c => c.difficulty === difficulty), [allCards, difficulty]);
  const topics       = useMemo(() => {
    const cats = [...new Set(byDifficulty.map(c => c.category))].sort();
    return ['All', ...cats];
  }, [byDifficulty]);
  const deck = useMemo(() => {
    let cards = topic === 'All' ? byDifficulty : byDifficulty.filter(c => c.category === topic);
    if (eqMode) cards = cards.filter(c => !!getCardEquation(c));
    return cards;
  }, [byDifficulty, topic, eqMode]);
  const savedCards = useMemo(() => allCards.filter(c => saved[c.id]), [allCards, saved]);

  const card       = deck[index] ?? null;
  const total      = deck.length;
  const knownCount = deck.filter(c => known[c.id]).length;
  const studyCount = deck.filter(c => studying[c.id]).length;

  // ── Equation derived ────────────────────────────────────────────────────

  const equation      = useMemo(() => eqMode && card ? getCardEquation(card) : null, [eqMode, card]);
  const eqTokens      = useMemo(() => equation ? tokenizeEq(equation) : [], [equation]);
  const blankIdxs     = useMemo(() => getBlankableIndices(eqTokens), [eqTokens]);
  const blankTokenIdx = blankIdxs[blankChoice % Math.max(blankIdxs.length, 1)];
  const correctAnswer = blankTokenIdx !== undefined ? eqTokens[blankTokenIdx].replace(/[()]/g, '').trim() : '';

  // ── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => { onCardChange?.(card); }, [card, onCardChange]);

  useEffect(() => {
    setUserAnswer(''); setAnswerChecked(false); setAnswerCorrect(false);
    const eq = eqMode && card ? getCardEquation(card) : null;
    if (eq) {
      const idxs = getBlankableIndices(tokenizeEq(eq));
      if (idxs.length > 0) setBlankChoice(Math.floor(Math.random() * idxs.length));
    }
  }, [card?.id, eqMode]);

  // ── Callbacks ───────────────────────────────────────────────────────────

  const changeDifficulty = useCallback((d) => { setDifficulty(d); setTopic('All'); setFlipped(false); setIndex(0); }, []);
  const changeTopic      = useCallback((t) => { setTopic(t); setFlipped(false); setIndex(0); }, []);
  const toggleEqMode     = useCallback(() => { setEqMode(m => !m); setFlipped(false); setIndex(0); }, []);
  const goNext           = useCallback(() => { setFlipped(false); setTimeout(() => setIndex(i => (i + 1) % Math.max(total, 1)), 150); }, [total]);
  const goPrev           = useCallback(() => { setFlipped(false); setTimeout(() => setIndex(i => (i - 1 + Math.max(total, 1)) % Math.max(total, 1)), 150); }, [total]);
  const handleFlip       = useCallback(() => setFlipped(f => !f), []);

  const handleKnow = useCallback(() => {
    if (!card) return;
    setKnown(s => ({ ...s, [card.id]: true }));
    setStudying(s => { const n = { ...s }; delete n[card.id]; return n; });
    goNext();
  }, [card, goNext]);

  const handleStudyMore = useCallback(() => {
    if (!card) return;
    setStudying(s => ({ ...s, [card.id]: true }));
    setKnown(s => { const n = { ...s }; delete n[card.id]; return n; });
    goNext();
  }, [card, goNext]);

  const handleSave = useCallback(() => {
    if (!card) return;
    setSaved(s => { const n = { ...s }; if (n[card.id]) delete n[card.id]; else n[card.id] = true; return n; });
  }, [card]);

  const handleRemoveFromList = useCallback((id) => {
    setSaved(s => { const n = { ...s }; delete n[id]; return n; });
  }, []);

  const handleReset = useCallback(() => {
    setIndex(0); setFlipped(false); setKnown({}); setStudying({});
    setGeneratedCards([]); setGenerateMsg('');
  }, []);

  const handleCheckAnswer = useCallback(() => {
    if (!userAnswer.trim()) return;
    setAnswerCorrect(normalizeAns(userAnswer) === normalizeAns(correctAnswer));
    setAnswerChecked(true);
  }, [userAnswer, correctAnswer]);

  // ── AI generation ────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const apiKey = localStorage.getItem('openrouter_api_key');
    if (!apiKey) { setGenerateMsg('No API key found. Add one in Settings first.'); return; }
    setGenerating(true); setGenerateMsg('');
    const model      = localStorage.getItem('openrouter_model') || 'openai/gpt-4o-mini';
    const topicLabel = topic === 'All' ? 'any retail or financial topic' : topic;
    const diffDesc   = difficulty === 'easy' ? 'basic definitions, suitable for beginners'
      : difficulty === 'medium' ? 'intermediate concepts and formulas'
      : 'advanced analysis, ratios, and strategic relationships';
    const prompt = `You are helping undergraduate retail management students study financial concepts. Generate exactly 5 flashcards.\n\nDifficulty: ${difficulty} (${diffDesc})\nTopic: ${topicLabel}\n\nReturn ONLY valid JSON:\n{"cards":[{"front":"the term","back":"definition; Formula: X ÷ Y if relevant","category":"one of: Income Statement, Balance Sheet, Strategic Profit Model, Retail Metrics, Liquidity, Leverage, Advanced Financials"}]}\n\nRules: match difficulty and topic, no very common terms for medium/hard, use \\n\\n to separate definition from formula.`;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': window.location.href, 'X-Title': 'FIT Retail Index Chat' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data    = await res.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      let parsed;
      try { parsed = JSON.parse(jsonStr); }
      catch { const m = content.match(/\{[\s\S]*\}/); if (!m) throw new Error('Could not read the AI response.'); parsed = JSON.parse(m[0]); }
      const timestamp = `${difficulty}-${Date.now()}`;
      const newCards  = (parsed.cards ?? [])
        .map((c, i) => ({ id: `gen-${timestamp}-${i}`, front: (c.front ?? '').trim(), back: (c.back ?? '').trim(), category: VALID_CATEGORIES.includes(c.category) ? c.category : (topic === 'All' ? 'Advanced Financials' : topic), difficulty, generated: true }))
        .filter(c => c.front && c.back);
      if (!newCards.length) throw new Error('No usable cards in the response. Try again.');
      setGeneratedCards(prev => [...prev, ...newCards]);
      setFlipped(false); setIndex(deck.length);
      setGenerateMsg(`✓ ${newCards.length} new cards added!`);
      setTimeout(() => setGenerateMsg(''), 3000);
    } catch (err) { setGenerateMsg(err.message || 'Something went wrong. Try again.'); }
    finally { setGenerating(false); }
  }, [difficulty, topic, deck.length]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const categoryColor = card ? (CATEGORY_COLORS[card.category] ?? 'bg-white/10 border-white/20 text-slate-500') : '';
  const cardStatus    = card ? (known[card.id] ? 'known' : studying[card.id] ? 'studying' : null) : null;
  const isSaved       = card ? !!saved[card.id] : false;

  // ── Shared container & orbs ──────────────────────────────────────────────

  const containerCls = 'relative flex flex-col gap-3 px-6 py-4 border-b select-none overflow-hidden bg-gradient-to-br from-slate-100/90 via-white/50 to-slate-200/70 dark:from-slate-900/90 dark:via-slate-800/50 dark:to-slate-950/70';

  const Orbs = () => (
    <>
      <div aria-hidden className="pointer-events-none absolute -top-8 -right-8 size-36 rounded-full bg-violet-400/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-6 -left-6 size-28 rounded-full bg-cyan-400/15 blur-3xl" />
    </>
  );

  // ── My List view ────────────────────────────────────────────────────────

  if (showMyList) {
    return (
      <div className={containerCls}>
        <Orbs />
        <div className="relative flex items-center justify-between">
          <button
            onClick={() => setShowMyList(false)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border ${GLASS_BTN}`}
          >
            <ArrowLeft className="size-3.5" />
            Back to flashcards
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">{savedCards.length} saved</span>
        </div>

        <p className="relative text-sm font-semibold text-slate-700 dark:text-slate-200">My Vocab List</p>

        {savedCards.length === 0 ? (
          <div className={`relative flex items-center justify-center rounded-2xl border ${GLASS_CARD} py-10`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">No cards saved yet — hit "Save to my list" on any card!</p>
          </div>
        ) : (
          <div className="relative flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
            {savedCards.map(c => (
              <div key={c.id} className={`rounded-2xl border ${GLASS_CARD} p-4 flex flex-col gap-1.5`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{c.front}</span>
                    <Badge className={`text-xs ${CATEGORY_COLORS[c.category] ?? 'bg-white/10 border-white/20 text-slate-500'}`} variant="outline">
                      {c.category}
                    </Badge>
                    {c.generated && (
                      <Badge className="text-xs bg-violet-300/15 border-violet-300/25 text-violet-700 dark:text-violet-300" variant="outline">
                        <Sparkles className="size-2.5 mr-1" />AI
                      </Badge>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveFromList(c.id)}
                    className="text-xs text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line">{c.back}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main deck view ──────────────────────────────────────────────────────

  return (
    <div className={containerCls}>
      <Orbs />

      {/* ── Difficulty + My List ── */}
      <div className="relative flex items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">Difficulty:</span>
        <div className="flex gap-1.5">
          {Object.entries(DIFFICULTY_LABELS).map(([d, label]) => {
            const s = DIFFICULTY_STYLES[d];
            return (
              <button
                key={d}
                onClick={() => changeDifficulty(d)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${difficulty === d ? s.active : s.inactive}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowMyList(true)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${GLASS_BTN}`}
          >
            <List className="size-3.5" />
            My List
            {savedCards.length > 0 && (
              <span className="bg-violet-400/30 text-violet-800 dark:text-violet-200 border border-violet-300/30 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                {savedCards.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Topic filter ── */}
      <div className="relative flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">Topic:</span>
        <div className="flex gap-1.5 flex-wrap">
          {topics.map(t => (
            <button
              key={t}
              onClick={() => changeTopic(t)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${topic === t ? GLASS_ACTIVE : GLASS_BTN}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div className="relative flex items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">Mode:</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => eqMode && toggleEqMode()}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${!eqMode ? GLASS_ACTIVE : GLASS_BTN}`}
          >
            Definitions
          </button>
          <button
            onClick={() => !eqMode && toggleEqMode()}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              eqMode
                ? 'bg-violet-400/20 border-violet-300/40 text-violet-800 dark:text-violet-200 shadow-[0_0_10px_rgba(167,139,250,0.2)] backdrop-blur-sm'
                : GLASS_BTN
            }`}
          >
            <Calculator className="size-3" />
            Equation practice
          </button>
        </div>
      </div>

      {/* ── Progress + stats ── */}
      <div className="relative flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Card {total > 0 ? index + 1 : 0} of {total}{eqMode ? ' (equations)' : ''}</span>
        <div className="flex gap-3">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{knownCount} Got it</span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">{studyCount} Still learning</span>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <RefreshCw className="size-3" />
          Reset
        </button>
      </div>

      <div className="relative w-full bg-white/15 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-400/80 to-slate-400/60 transition-all duration-300 rounded-full"
          style={{ width: total > 0 ? `${((index + 1) / total) * 100}%` : '0%' }}
        />
      </div>

      {/* ── Card + nav ── */}
      {total === 0 ? (
        <div className={`relative flex items-center justify-center rounded-2xl border ${GLASS_CARD} text-center p-8`} style={{ minHeight: '200px' }}>
          <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-line">
            {eqMode ? 'No equation cards in this filter.\nTry a different difficulty or topic.' : 'No cards match this filter.'}
          </p>
        </div>
      ) : (
        <div className="relative flex items-center gap-3 w-full">

          {/* Prev button */}
          <button
            onClick={goPrev}
            className={`shrink-0 size-8 flex items-center justify-center rounded-xl border ${GLASS_BTN}`}
          >
            <ChevronLeft className="size-4" />
          </button>

          {/* ── Equation practice card ── */}
          {eqMode ? (
            <div
              className={`flex-1 flex flex-col items-center justify-center gap-3 rounded-2xl border ${GLASS_CARD} p-5`}
              style={{ minHeight: '220px' }}
            >
              <div className="flex items-center gap-2">
                <Badge className={`text-xs font-medium ${categoryColor}`} variant="outline">{card.category}</Badge>
                {card.generated && (
                  <Badge className="text-xs bg-violet-300/15 border-violet-300/25 text-violet-700 dark:text-violet-300" variant="outline">
                    <Sparkles className="size-2.5 mr-1" />AI
                  </Badge>
                )}
              </div>

              <p className="text-lg font-semibold text-center text-slate-800 dark:text-slate-100">{card.front}</p>

              {/* Equation with blank */}
              <div className="flex flex-wrap items-center justify-center gap-1 text-sm font-medium">
                {eqTokens.map((t, i) => {
                  if (i === blankTokenIdx) {
                    return (
                      <span
                        key={i}
                        className={`px-3 py-0.5 rounded-md border-b-2 min-w-[70px] text-center transition-all ${
                          !answerChecked
                            ? 'bg-white/10 border-violet-400/50 text-slate-400'
                            : answerCorrect
                            ? 'bg-emerald-400/15 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-400/15 border-rose-400 text-rose-600 dark:text-rose-300 line-through'
                        }`}
                      >
                        {answerChecked ? (userAnswer || '?') : '___'}
                      </span>
                    );
                  }
                  if (EQ_OPS.has(t)) return <span key={i} className="text-slate-400 dark:text-slate-500 font-bold px-0.5">{t}</span>;
                  return <span key={i} className="text-slate-700 dark:text-slate-200">{t}</span>;
                })}
              </div>

              {!answerChecked ? (
                <div className="flex gap-2 w-full max-w-[260px]">
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={e => setUserAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && userAnswer.trim() && handleCheckAnswer()}
                    placeholder="Fill in the blank…"
                    className="flex-1 px-3 py-1.5 text-sm rounded-xl border bg-white/20 dark:bg-white/10 border-white/30 backdrop-blur-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
                    autoFocus
                  />
                  <button
                    onClick={handleCheckAnswer}
                    disabled={!userAnswer.trim()}
                    className="px-4 py-1.5 text-xs font-semibold rounded-xl border bg-white/20 border-white/30 text-slate-700 dark:text-slate-200 hover:bg-white/30 backdrop-blur-sm transition-colors disabled:opacity-40"
                  >
                    Check
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-center">
                  <p className={`text-sm font-semibold ${answerCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                    {answerCorrect ? '✓ Correct!' : `✗ Answer: "${correctAnswer}"`}
                  </p>
                  {!answerCorrect && (
                    <p className="text-xs text-slate-400">Full: {equation}</p>
                  )}
                </div>
              )}
            </div>

          ) : (
            /* ── Standard flip card ── */
            <div
              className="flex-1 cursor-pointer"
              style={{ perspective: '1000px', height: '220px' }}
              onClick={handleFlip}
            >
              <div
                style={{
                  position: 'relative', width: '100%', height: '100%',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.45s cubic-bezier(0.4, 0.2, 0.2, 1)',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Front */}
                <div
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                  className={`absolute inset-0 rounded-2xl border ${GLASS_CARD} flex flex-col items-center justify-center gap-3 p-6`}
                >
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs font-medium ${categoryColor}`} variant="outline">{card.category}</Badge>
                    {card.generated && (
                      <Badge className="text-xs bg-violet-300/15 border-violet-300/25 text-violet-700 dark:text-violet-300" variant="outline">
                        <Sparkles className="size-2.5 mr-1" />AI
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-semibold text-center leading-snug text-slate-800 dark:text-slate-100">{card.front}</p>
                  <p className="text-xs text-slate-400">Click to flip</p>
                </div>

                {/* Back */}
                <div
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  className={`absolute inset-0 rounded-2xl border ${GLASS_CARD} flex flex-col items-center justify-center gap-2 p-6 overflow-y-auto`}
                >
                  <p className="text-sm text-center leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-200">{card.back}</p>
                </div>
              </div>
            </div>
          )}

          {/* Next button */}
          <button
            onClick={goNext}
            className={`shrink-0 size-8 flex items-center justify-center rounded-xl border ${GLASS_BTN}`}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* ── Action buttons — always visible (equation mode: only after checking) ── */}
      {total > 0 && (!eqMode || answerChecked) && (
        <div className="relative flex gap-2 justify-center flex-wrap">
          <button
            onClick={handleStudyMore}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border ${
              cardStatus === 'studying' ? 'bg-amber-400/20 border-amber-300/40 text-amber-700 dark:text-amber-300 backdrop-blur-sm' : GLASS_BTN
            }`}
          >
            <RotateCcw className="size-3.5 text-amber-500" />
            Still learning
          </button>
          <button
            onClick={handleKnow}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border ${
              cardStatus === 'known' ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-700 dark:text-emerald-300 backdrop-blur-sm' : GLASS_BTN
            }`}
          >
            <Check className="size-3.5 text-emerald-500" />
            Got it!
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
              isSaved ? 'bg-violet-400/20 border-violet-300/40 text-violet-700 dark:text-violet-300 backdrop-blur-sm' : GLASS_BTN
            }`}
          >
            {isSaved ? <BookmarkCheck className="size-3.5 text-violet-500" /> : <BookmarkPlus className="size-3.5 text-violet-400" />}
            {isSaved ? 'Saved!' : 'Save to my list'}
          </button>
          {eqMode && (
            <button onClick={goNext} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border ${GLASS_BTN}`}>
              Next →
            </button>
          )}
        </div>
      )}

      {/* ── Generate button ── */}
      <div className="relative flex flex-col items-center gap-1.5">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-xl border transition-all ${
            generating ? 'opacity-50 cursor-not-allowed ' + GLASS_BTN : GLASS_BTN
          } text-violet-600 dark:text-violet-300`}
        >
          <Sparkles className="size-3.5" />
          {generating ? 'Generating…' : 'Generate more cards'}
        </button>
        {generateMsg && (
          <p className={`text-xs ${generateMsg.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {generateMsg}
          </p>
        )}
      </div>

    </div>
  );
}
