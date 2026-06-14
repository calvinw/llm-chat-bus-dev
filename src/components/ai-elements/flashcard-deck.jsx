import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, RotateCcw, Check, RefreshCw, Sparkles,
  BookmarkPlus, BookmarkCheck, List, ArrowLeft, Calculator,
} from 'lucide-react';
import { FLASHCARDS } from '@/utils/flashcards';

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const DIFFICULTY_STYLES = {
  easy:   { active: 'bg-green-600 text-white hover:bg-green-700',   inactive: 'border-green-300 text-green-700 hover:bg-green-50 dark:hover:bg-green-950' },
  medium: { active: 'bg-amber-500 text-white hover:bg-amber-600',   inactive: 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950' },
  hard:   { active: 'bg-red-600 text-white hover:bg-red-700',       inactive: 'border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950' },
};

const CATEGORY_COLORS = {
  'Income Statement':       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Balance Sheet':          'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'Strategic Profit Model': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Retail Metrics':         'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  'Liquidity':              'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'Leverage':               'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Advanced Financials':    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
};

const VALID_CATEGORIES = Object.keys(CATEGORY_COLORS);

// ── Equation utilities ─────────────────────────────────────────────────────

// Extract a full equation string from a card, e.g. "ROA = Net Profit Margin % × Asset Turnover"
function getCardEquation(card) {
  const m = card.back.match(/Formula:\s*([^\n]+)/);
  if (m) return `${card.front} = ${m[1].trim()}`;
  // Fallback: find a line in the body that looks like "X = Y" (e.g. DuPont card)
  for (const line of card.back.split('\n')) {
    const t = line.trim();
    if (/\w[\w\s%'()]*\s*=\s*\w/.test(t) && !t.includes('NOT') && !t.includes("isn't")) {
      return t.split('→')[0].split(' — ')[0].trim();
    }
  }
  return null;
}

const EQ_OPS = new Set(['=', '×', '÷', '+', '−']);

// Split equation into tokens, treating parenthesized sub-expressions as single tokens
function tokenizeEq(eq) {
  const result = [];
  let buf = '';
  let depth = 0;
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

// Return indices of tokens the student can be asked to fill in
// (excludes operators, pure numbers, and compound sub-expressions with nested operators)
function getBlankableIndices(tokens) {
  return tokens.reduce((acc, t, i) => {
    const clean = t.replace(/[()]/g, '').trim();
    if (!EQ_OPS.has(t) && clean && !/^\d+$/.test(clean) && !/[=×÷+−]/.test(clean)) {
      acc.push(i);
    }
    return acc;
  }, []);
}

function normalizeAns(s) {
  return s.toLowerCase().replace(/[%()×÷+−=\-]/g, '').replace(/\s+/g, ' ').trim();
}

// ── Component ─────────────────────────────────────────────────────────────

export function FlashcardDeck({ onCardChange }) {
  // Core study state
  const [difficulty, setDifficulty]         = useState('easy');
  const [topic, setTopic]                   = useState('All');
  const [index, setIndex]                   = useState(0);
  const [flipped, setFlipped]               = useState(false);
  const [known, setKnown]                   = useState({});
  const [studying, setStudying]             = useState({});
  const [saved, setSaved]                   = useState({});

  // Generated cards
  const [generatedCards, setGeneratedCards] = useState([]);
  const [generating, setGenerating]         = useState(false);
  const [generateMsg, setGenerateMsg]       = useState('');

  // UI panels
  const [showMyList, setShowMyList]         = useState(false);

  // Equation (fill-in-the-blank) mode
  const [eqMode, setEqMode]                 = useState(false);
  const [userAnswer, setUserAnswer]         = useState('');
  const [answerChecked, setAnswerChecked]   = useState(false);
  const [answerCorrect, setAnswerCorrect]   = useState(false);
  const [blankChoice, setBlankChoice]       = useState(0); // index into blankableIndices

  // ── Derived deck ────────────────────────────────────────────────────────

  const allCards = useMemo(() => [...FLASHCARDS, ...generatedCards], [generatedCards]);

  const byDifficulty = useMemo(
    () => allCards.filter(c => c.difficulty === difficulty),
    [allCards, difficulty]
  );

  const topics = useMemo(() => {
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

  // ── Equation mode derived values ────────────────────────────────────────

  const equation     = useMemo(() => eqMode && card ? getCardEquation(card) : null, [eqMode, card]);
  const eqTokens     = useMemo(() => equation ? tokenizeEq(equation) : [], [equation]);
  const blankIdxs    = useMemo(() => getBlankableIndices(eqTokens), [eqTokens]);
  const blankTokenIdx = blankIdxs[blankChoice % Math.max(blankIdxs.length, 1)];
  const correctAnswer = blankTokenIdx !== undefined
    ? eqTokens[blankTokenIdx].replace(/[()]/g, '').trim()
    : '';

  // ── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => { onCardChange?.(card); }, [card, onCardChange]);

  // Reset equation answer state and pick a new random blank on card change
  useEffect(() => {
    setUserAnswer('');
    setAnswerChecked(false);
    setAnswerCorrect(false);
    const eq = eqMode && card ? getCardEquation(card) : null;
    if (eq) {
      const idxs = getBlankableIndices(tokenizeEq(eq));
      if (idxs.length > 0) setBlankChoice(Math.floor(Math.random() * idxs.length));
    }
  }, [card?.id, eqMode]);

  // ── Navigation ──────────────────────────────────────────────────────────

  const changeDifficulty = useCallback((d) => {
    setDifficulty(d); setTopic('All'); setFlipped(false); setIndex(0);
  }, []);

  const changeTopic = useCallback((t) => {
    setTopic(t); setFlipped(false); setIndex(0);
  }, []);

  const toggleEqMode = useCallback(() => {
    setEqMode(m => !m); setFlipped(false); setIndex(0);
  }, []);

  const goNext = useCallback(() => {
    setFlipped(false);
    setTimeout(() => setIndex(i => (i + 1) % Math.max(total, 1)), 150);
  }, [total]);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setTimeout(() => setIndex(i => (i - 1 + Math.max(total, 1)) % Math.max(total, 1)), 150);
  }, [total]);

  // ── Card actions ────────────────────────────────────────────────────────

  const handleFlip        = useCallback(() => setFlipped(f => !f), []);

  const handleKnow        = useCallback(() => {
    if (!card) return;
    setKnown(s => ({ ...s, [card.id]: true }));
    setStudying(s => { const n = { ...s }; delete n[card.id]; return n; });
    goNext();
  }, [card, goNext]);

  const handleStudyMore   = useCallback(() => {
    if (!card) return;
    setStudying(s => ({ ...s, [card.id]: true }));
    setKnown(s => { const n = { ...s }; delete n[card.id]; return n; });
    goNext();
  }, [card, goNext]);

  const handleSave        = useCallback(() => {
    if (!card) return;
    setSaved(s => {
      const n = { ...s };
      if (n[card.id]) delete n[card.id]; else n[card.id] = true;
      return n;
    });
  }, [card]);

  const handleRemoveFromList = useCallback((id) => {
    setSaved(s => { const n = { ...s }; delete n[id]; return n; });
  }, []);

  const handleReset       = useCallback(() => {
    setIndex(0); setFlipped(false); setKnown({}); setStudying({});
    setGeneratedCards([]); setGenerateMsg('');
  }, []);

  // ── Equation check ──────────────────────────────────────────────────────

  const handleCheckAnswer = useCallback(() => {
    if (!userAnswer.trim()) return;
    setAnswerCorrect(normalizeAns(userAnswer) === normalizeAns(correctAnswer));
    setAnswerChecked(true);
  }, [userAnswer, correctAnswer]);

  // ── AI card generation ───────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const apiKey = localStorage.getItem('openrouter_api_key');
    if (!apiKey) { setGenerateMsg('No API key found. Add one in Settings first.'); return; }

    setGenerating(true);
    setGenerateMsg('');

    const model      = localStorage.getItem('openrouter_model') || 'openai/gpt-4o-mini';
    const topicLabel = topic === 'All' ? 'any retail or financial topic' : topic;
    const diffDesc   = difficulty === 'easy'
      ? 'basic definitions, suitable for beginners'
      : difficulty === 'medium' ? 'intermediate concepts and formulas'
      : 'advanced analysis, ratios, and strategic relationships';

    const prompt = `You are helping undergraduate retail management students study financial concepts. Generate exactly 5 flashcards.

Difficulty: ${difficulty} (${diffDesc})
Topic: ${topicLabel}

Return ONLY valid JSON in this exact format — no markdown, no explanation, just JSON:
{
  "cards": [
    {
      "front": "the term or concept",
      "back": "plain-English definition or explanation; include formula if relevant (e.g. Formula: X ÷ Y)",
      "category": "must be one of exactly: Income Statement, Balance Sheet, Strategic Profit Model, Retail Metrics, Liquidity, Leverage, Advanced Financials"
    }
  ]
}

Rules:
- All 5 cards must match the requested difficulty and topic
- Do not repeat very common terms like Revenue or COGS for medium/hard difficulty
- Keep definitions clear and useful for a business student
- Use line breaks (\\n\\n) to separate the definition from the formula`;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'FIT Retail Index Chat',
        },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
      });

      if (!res.ok) throw new Error(`API returned ${res.status}`);

      const data    = await res.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      let parsed;
      try { parsed = JSON.parse(jsonStr); }
      catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('Could not read the AI response. Try again.');
        parsed = JSON.parse(m[0]);
      }

      const timestamp = `${difficulty}-${Date.now()}`;
      const newCards  = (parsed.cards ?? [])
        .map((c, i) => ({
          id:        `gen-${timestamp}-${i}`,
          front:     (c.front ?? '').trim(),
          back:      (c.back ?? '').trim(),
          category:  VALID_CATEGORIES.includes(c.category) ? c.category : (topic === 'All' ? 'Advanced Financials' : topic),
          difficulty,
          generated: true,
        }))
        .filter(c => c.front && c.back);

      if (!newCards.length) throw new Error('No usable cards in the response. Try again.');

      const firstNewIdx = deck.length;
      setGeneratedCards(prev => [...prev, ...newCards]);
      setFlipped(false);
      setIndex(firstNewIdx);
      setGenerateMsg(`✓ ${newCards.length} new cards added!`);
      setTimeout(() => setGenerateMsg(''), 3000);

    } catch (err) {
      setGenerateMsg(err.message || 'Something went wrong. Try again.');
    } finally {
      setGenerating(false);
    }
  }, [difficulty, topic, deck.length]);

  // ── Shared card status helpers ──────────────────────────────────────────

  const categoryColor = card ? (CATEGORY_COLORS[card.category] ?? 'bg-muted text-muted-foreground') : '';
  const cardStatus    = card ? (known[card.id] ? 'known' : studying[card.id] ? 'studying' : null) : null;
  const isSaved       = card ? !!saved[card.id] : false;

  // ── My List view ────────────────────────────────────────────────────────

  if (showMyList) {
    return (
      <div className="flex flex-col gap-3 px-6 py-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowMyList(false)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to flashcards
          </button>
          <span className="text-xs text-muted-foreground">{savedCards.length} saved</span>
        </div>

        <h3 className="text-sm font-semibold">My Vocab List</h3>

        {savedCards.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border bg-card py-10">
            <p className="text-sm text-muted-foreground">No cards saved yet. Hit "Save to my list" on any card!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
            {savedCards.map(c => (
              <div key={c.id} className="rounded-xl border bg-card p-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{c.front}</span>
                    <Badge className={`text-xs ${CATEGORY_COLORS[c.category] ?? 'bg-muted text-muted-foreground'}`} variant="outline">
                      {c.category}
                    </Badge>
                    {c.generated && (
                      <Badge className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" variant="outline">
                        <Sparkles className="size-2.5 mr-1" />AI
                      </Badge>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveFromList(c.id)}
                    className="text-xs text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{c.back}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main deck view ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 px-6 py-4 border-b bg-muted/20 select-none">

      {/* ── Difficulty + My List ── */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Difficulty:</span>
        <div className="flex gap-1.5">
          {Object.entries(DIFFICULTY_LABELS).map(([d, label]) => {
            const isActive = difficulty === d;
            const s = DIFFICULTY_STYLES[d];
            return (
              <button
                key={d}
                onClick={() => changeDifficulty(d)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${isActive ? s.active : s.inactive}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowMyList(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <List className="size-3.5" />
            My List {savedCards.length > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                {savedCards.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Topic filter ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Topic:</span>
        <div className="flex gap-1.5 flex-wrap">
          {topics.map(t => {
            const isActive = topic === t;
            return (
              <button
                key={t}
                onClick={() => changeTopic(t)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-muted-foreground/30 text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Mode:</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => eqMode && toggleEqMode()}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              !eqMode
                ? 'bg-foreground text-background border-foreground'
                : 'border-muted-foreground/30 text-muted-foreground hover:border-foreground hover:text-foreground'
            }`}
          >
            Definitions
          </button>
          <button
            onClick={() => !eqMode && toggleEqMode()}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              eqMode
                ? 'bg-violet-600 text-white border-violet-600'
                : 'border-violet-300 text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950'
            }`}
          >
            <Calculator className="size-3" />
            Equation practice
          </button>
        </div>
      </div>

      {/* ── Progress bar + stats ── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Card {total > 0 ? index + 1 : 0} of {total}{eqMode ? ' (equations only)' : ''}</span>
        <div className="flex gap-3">
          <span className="text-green-600 font-medium">{knownCount} Got it</span>
          <span className="text-amber-600 font-medium">{studyCount} Still learning</span>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          title="Reset all progress and remove generated cards"
        >
          <RefreshCw className="size-3" />
          Reset
        </button>
      </div>

      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: total > 0 ? `${((index + 1) / total) * 100}%` : '0%' }}
        />
      </div>

      {/* ── Card + nav ── */}
      {total === 0 ? (
        <div className="flex items-center justify-center rounded-xl border bg-card text-center p-6" style={{ height: '220px' }}>
          <p className="text-sm text-muted-foreground">
            {eqMode
              ? 'No equation cards in this filter.\nTry a different difficulty or topic.'
              : 'No cards match this filter.'}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={goPrev}
            className="shrink-0 size-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>

          {/* ── Equation practice card ── */}
          {eqMode ? (
            <div
              className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border bg-card shadow-sm p-5"
              style={{ minHeight: '220px' }}
            >
              {/* Badges */}
              <div className="flex items-center gap-2">
                <Badge className={`text-xs font-medium ${categoryColor}`} variant="outline">
                  {card.category}
                </Badge>
                {card.generated && (
                  <Badge className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" variant="outline">
                    <Sparkles className="size-2.5 mr-1" />AI
                  </Badge>
                )}
              </div>

              {/* Term name */}
              <p className="text-lg font-semibold text-center">{card.front}</p>

              {/* Equation display with blank */}
              <div className="flex flex-wrap items-center justify-center gap-1 text-sm font-medium">
                {eqTokens.map((t, i) => {
                  if (i === blankTokenIdx) {
                    return (
                      <span
                        key={i}
                        className={`px-3 py-0.5 border-b-2 min-w-[70px] text-center transition-colors ${
                          !answerChecked
                            ? 'border-primary text-transparent'
                            : answerCorrect
                            ? 'border-green-500 text-green-600'
                            : 'border-red-400 text-red-500 line-through'
                        }`}
                      >
                        {answerChecked ? (userAnswer || '?') : '___'}
                      </span>
                    );
                  }
                  if (EQ_OPS.has(t)) {
                    return <span key={i} className="text-muted-foreground font-bold px-0.5">{t}</span>;
                  }
                  return <span key={i} className="text-foreground">{t}</span>;
                })}
              </div>

              {/* Input or result */}
              {!answerChecked ? (
                <div className="flex gap-2 w-full max-w-[260px]">
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={e => setUserAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && userAnswer.trim() && handleCheckAnswer()}
                    placeholder="Fill in the blank…"
                    className="flex-1 px-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleCheckAnswer} disabled={!userAnswer.trim()}>
                    Check
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-center">
                  <p className={`text-sm font-semibold ${answerCorrect ? 'text-green-600' : 'text-red-500'}`}>
                    {answerCorrect ? '✓ Correct!' : `✗ Answer: "${correctAnswer}"`}
                  </p>
                  {!answerCorrect && (
                    <p className="text-xs text-muted-foreground">Full equation: {equation}</p>
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
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.45s cubic-bezier(0.4, 0.2, 0.2, 1)',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Front */}
                <div
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                  className="absolute inset-0 rounded-xl border bg-card shadow-sm flex flex-col items-center justify-center gap-3 p-6"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs font-medium ${categoryColor}`} variant="outline">
                      {card.category}
                    </Badge>
                    {card.generated && (
                      <Badge className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" variant="outline">
                        <Sparkles className="size-2.5 mr-1" />AI
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-semibold text-center leading-snug">{card.front}</p>
                  <p className="text-xs text-muted-foreground">Click to flip</p>
                </div>

                {/* Back */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                  className="absolute inset-0 rounded-xl border bg-card shadow-sm flex flex-col items-center justify-center gap-2 p-6 overflow-y-auto"
                >
                  <p className="text-sm text-center leading-relaxed whitespace-pre-line">{card.back}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={goNext}
            className="shrink-0 size-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* ── Action buttons ── */}
      {total > 0 && (!eqMode || answerChecked) && (
        <div className="flex gap-2 justify-center flex-wrap">
          <Button
            size="sm"
            variant={cardStatus === 'studying' ? 'secondary' : 'outline'}
            onClick={handleStudyMore}
            className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
          >
            <RotateCcw className="size-3.5" />
            Still learning
          </Button>
          <Button
            size="sm"
            variant={cardStatus === 'known' ? 'secondary' : 'outline'}
            onClick={handleKnow}
            className="gap-1.5 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
          >
            <Check className="size-3.5" />
            Got it!
          </Button>
          <Button
            size="sm"
            variant={isSaved ? 'secondary' : 'outline'}
            onClick={handleSave}
            className={`gap-1.5 transition-colors ${isSaved ? 'text-blue-600 border-blue-400 bg-blue-50 dark:bg-blue-950' : 'text-blue-500 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950'}`}
          >
            {isSaved ? <BookmarkCheck className="size-3.5" /> : <BookmarkPlus className="size-3.5" />}
            {isSaved ? 'Saved!' : 'Save to my list'}
          </Button>
          {eqMode && (
            <Button size="sm" variant="outline" onClick={goNext} className="gap-1.5">
              Next →
            </Button>
          )}
        </div>
      )}

      {/* ── Generate button ── */}
      <div className="flex flex-col items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={generating}
          className="gap-2 text-violet-600 border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950"
        >
          <Sparkles className="size-3.5" />
          {generating ? 'Generating...' : 'Generate more cards'}
        </Button>
        {generateMsg && (
          <p className={`text-xs ${generateMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
            {generateMsg}
          </p>
        )}
      </div>

    </div>
  );
}
