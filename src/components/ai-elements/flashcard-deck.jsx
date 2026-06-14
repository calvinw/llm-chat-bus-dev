import { useState, useCallback, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, RotateCcw, Check, RefreshCw, Sparkles,
  BookmarkPlus, BookmarkCheck, List, ArrowLeft, Calculator,
} from 'lucide-react';
import { FLASHCARDS } from '@/utils/flashcards';

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const DIFFICULTY_ACTIVE_TEXT = { easy: '#166534', medium: '#92400E', hard: '#9F1239' };

const CATEGORY_COLORS = {
  'Income Statement':       'bg-sky-200/50 border-sky-300/50 text-sky-900',
  'Balance Sheet':          'bg-purple-200/50 border-purple-300/50 text-purple-900',
  'Strategic Profit Model': 'bg-amber-200/50 border-amber-300/50 text-amber-900',
  'Retail Metrics':         'bg-rose-200/50 border-rose-300/50 text-rose-900',
  'Liquidity':              'bg-teal-200/50 border-teal-300/50 text-teal-900',
  'Leverage':               'bg-orange-200/50 border-orange-300/50 text-orange-900',
  'Advanced Financials':    'bg-indigo-200/50 border-indigo-300/50 text-indigo-900',
};

const VALID_CATEGORIES = Object.keys(CATEGORY_COLORS);

// ── Glass style tokens ─────────────────────────────────────────────────────

const S = {
  container: {
    background: 'linear-gradient(145deg, #FFF8E7 0%, #FFE8A3 40%, #FCECC8 100%)',
  },
  card: {
    background: 'rgba(255,255,255,0.35)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '32px',
    boxShadow: '0 8px 32px rgba(180,140,60,0.15), inset 0 1px 0 rgba(255,255,255,0.7)',
  },
  pillOn: {
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.8)',
    borderRadius: '999px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 2px 8px rgba(180,140,60,0.1)',
  },
  pillOff: {
    background: 'transparent',
    border: '1px solid rgba(200,160,60,0.2)',
    borderRadius: '999px',
  },
  btn: {
    background: 'rgba(255,255,255,0.5)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(200,160,60,0.3)',
    borderRadius: '999px',
  },
  track: {
    background: 'rgba(255,255,255,0.4)',
    borderRadius: '999px',
    height: '6px',
    overflow: 'hidden',
  },
  fill: {
    background: 'linear-gradient(90deg, #F59E0B, #D97706)',
    height: '100%',
    transition: 'width 0.3s ease',
    borderRadius: '999px',
  },
};

// Warm text color palette
const C = {
  heading: '#3D2C00',
  body:    'rgba(80,60,0,0.85)',
  muted:   'rgba(80,60,0,0.5)',
  amber:   '#92400E',
};

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

// ── Decorative amber blobs ────────────────────────────────────────────────

function Orbs() {
  return (
    <>
      <div aria-hidden style={{ position:'absolute', top:'-30px', right:'-20px', width:'160px', height:'160px', background:'rgba(251,191,36,0.22)', borderRadius:'50%', filter:'blur(48px)', pointerEvents:'none' }} />
      <div aria-hidden style={{ position:'absolute', bottom:'-20px', left:'-20px', width:'120px', height:'120px', background:'rgba(245,158,11,0.18)', borderRadius:'50%', filter:'blur(40px)', pointerEvents:'none' }} />
      <div aria-hidden style={{ position:'absolute', top:'45%', left:'35%', width:'90px', height:'90px', background:'rgba(252,211,77,0.13)', borderRadius:'50%', filter:'blur(36px)', pointerEvents:'none' }} />
    </>
  );
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

  const allCards     = useMemo(() => [...FLASHCARDS, ...generatedCards], [generatedCards]);
  const byDifficulty = useMemo(() => allCards.filter(c => c.difficulty === difficulty), [allCards, difficulty]);
  const topics       = useMemo(() => ['All', ...[...new Set(byDifficulty.map(c => c.category))].sort()], [byDifficulty]);
  const deck         = useMemo(() => {
    let cards = topic === 'All' ? byDifficulty : byDifficulty.filter(c => c.category === topic);
    if (eqMode) cards = cards.filter(c => !!getCardEquation(c));
    return cards;
  }, [byDifficulty, topic, eqMode]);
  const savedCards   = useMemo(() => allCards.filter(c => saved[c.id]), [allCards, saved]);

  const card       = deck[index] ?? null;
  const total      = deck.length;
  const knownCount = deck.filter(c => known[c.id]).length;
  const studyCount = deck.filter(c => studying[c.id]).length;

  const equation      = useMemo(() => eqMode && card ? getCardEquation(card) : null, [eqMode, card]);
  const eqTokens      = useMemo(() => equation ? tokenizeEq(equation) : [], [equation]);
  const blankIdxs     = useMemo(() => getBlankableIndices(eqTokens), [eqTokens]);
  const blankTokenIdx = blankIdxs[blankChoice % Math.max(blankIdxs.length, 1)];
  const correctAnswer = blankTokenIdx !== undefined ? eqTokens[blankTokenIdx].replace(/[()]/g, '').trim() : '';

  useEffect(() => { onCardChange?.(card); }, [card, onCardChange]);
  useEffect(() => {
    setUserAnswer(''); setAnswerChecked(false); setAnswerCorrect(false);
    const eq = eqMode && card ? getCardEquation(card) : null;
    if (eq) {
      const idxs = getBlankableIndices(tokenizeEq(eq));
      if (idxs.length > 0) setBlankChoice(Math.floor(Math.random() * idxs.length));
    }
  }, [card?.id, eqMode]);

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
        .map((c, i) => ({ id:`gen-${timestamp}-${i}`, front:(c.front??'').trim(), back:(c.back??'').trim(), category:VALID_CATEGORIES.includes(c.category)?c.category:(topic==='All'?'Advanced Financials':topic), difficulty, generated:true }))
        .filter(c => c.front && c.back);
      if (!newCards.length) throw new Error('No usable cards in the response. Try again.');
      setGeneratedCards(prev => [...prev, ...newCards]);
      setFlipped(false); setIndex(deck.length);
      setGenerateMsg(`✓ ${newCards.length} new cards added!`);
      setTimeout(() => setGenerateMsg(''), 3000);
    } catch (err) { setGenerateMsg(err.message || 'Something went wrong. Try again.'); }
    finally { setGenerating(false); }
  }, [difficulty, topic, deck.length]);

  const categoryColor = card ? (CATEGORY_COLORS[card.category] ?? 'bg-amber-200/50 border-amber-300/50 text-amber-900') : '';
  const cardStatus    = card ? (known[card.id] ? 'known' : studying[card.id] ? 'studying' : null) : null;
  const isSaved       = card ? !!saved[card.id] : false;

  // Action button style variants
  const btnStudying = { ...S.btn, background:'rgba(255,248,235,0.75)', border:'1px solid rgba(217,119,6,0.4)' };
  const btnKnown    = { ...S.btn, background:'rgba(236,253,245,0.75)', border:'1px solid rgba(16,185,129,0.4)' };
  const btnSaved    = { ...S.btn, background:'rgba(245,243,255,0.75)', border:'1px solid rgba(139,92,246,0.4)' };

  // Equation blank slot styles
  const blankSlotStyle = !answerChecked
    ? { background:'rgba(255,255,255,0.4)', borderBottom:'2px solid rgba(200,160,60,0.5)', borderRadius:'6px', padding:'2px 16px', minWidth:'70px', textAlign:'center', display:'inline-block', color:'rgba(80,60,0,0.3)', transition:'all 0.2s' }
    : answerCorrect
    ? { background:'rgba(209,250,229,0.6)', border:'2px solid rgba(16,185,129,0.5)', borderRadius:'6px', padding:'2px 16px', minWidth:'70px', textAlign:'center', display:'inline-block', color:'#065F46' }
    : { background:'rgba(254,226,226,0.6)', border:'2px solid rgba(239,68,68,0.45)', borderRadius:'6px', padding:'2px 16px', minWidth:'70px', textAlign:'center', display:'inline-block', color:'#9F1239', textDecoration:'line-through' };

  // ── My List view ────────────────────────────────────────────────────────

  if (showMyList) {
    return (
      <div className="relative flex flex-col gap-3 px-6 py-4 border-b select-none overflow-hidden" style={S.container}>
        <Orbs />

        <div className="relative flex items-center justify-between">
          <button
            onClick={() => setShowMyList(false)}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 transition-opacity hover:opacity-75"
            style={{ ...S.btn, color: C.amber }}
          >
            <ArrowLeft className="size-3.5" />
            Back to flashcards
          </button>
          <span className="text-xs" style={{ color: C.muted }}>{savedCards.length} saved</span>
        </div>

        <p className="relative text-sm font-semibold" style={{ color: C.heading }}>My Vocab List</p>

        {savedCards.length === 0 ? (
          <div className="relative flex items-center justify-center py-10" style={S.card}>
            <p className="text-sm" style={{ color: C.muted }}>No cards saved yet — hit "Save to my list" on any card!</p>
          </div>
        ) : (
          <div className="relative flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
            {savedCards.map(c => (
              <div key={c.id} className="p-4 flex flex-col gap-1.5" style={S.card}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: C.heading }}>{c.front}</span>
                    <Badge className={`text-xs ${CATEGORY_COLORS[c.category] ?? 'bg-amber-200/50 border-amber-300/50 text-amber-900'}`} variant="outline">
                      {c.category}
                    </Badge>
                    {c.generated && (
                      <Badge className="text-xs bg-amber-200/50 border-amber-300/50 text-amber-900" variant="outline">
                        <Sparkles className="size-2.5 mr-1" />AI
                      </Badge>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveFromList(c.id)}
                    className="text-xs shrink-0 hover:text-rose-600 transition-colors"
                    style={{ color: C.muted }}
                  >
                    Remove
                  </button>
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: C.body }}>{c.back}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main deck view ──────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col gap-3 px-6 py-4 border-b select-none overflow-hidden" style={S.container}>
      <Orbs />

      {/* ── Difficulty + My List ── */}
      <div className="relative flex items-center gap-2">
        <span className="text-xs font-medium shrink-0" style={{ color: C.muted }}>Difficulty:</span>
        <div className="flex gap-1.5">
          {Object.entries(DIFFICULTY_LABELS).map(([d, label]) => (
            <button
              key={d}
              onClick={() => changeDifficulty(d)}
              style={difficulty === d ? { ...S.pillOn, color: DIFFICULTY_ACTIVE_TEXT[d] } : { ...S.pillOff, color: C.muted }}
              className="px-3 py-1 text-xs font-semibold transition-all"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowMyList(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 transition-opacity hover:opacity-75"
            style={{ ...S.btn, color: C.amber }}
          >
            <List className="size-3.5" />
            My List
            {savedCards.length > 0 && (
              <span style={{ background:'rgba(255,255,255,0.7)', border:'1px solid rgba(200,160,60,0.4)', borderRadius:'999px', padding:'1px 6px', fontSize:'10px', fontWeight:'700', color: C.amber }}>
                {savedCards.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Topic filter ── */}
      <div className="relative flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium shrink-0" style={{ color: C.muted }}>Topic:</span>
        <div className="flex gap-1.5 flex-wrap">
          {topics.map(t => (
            <button
              key={t}
              onClick={() => changeTopic(t)}
              style={topic === t ? { ...S.pillOn, color: C.amber } : { ...S.pillOff, color: C.muted }}
              className="px-2.5 py-0.5 text-xs font-medium transition-all"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div className="relative flex items-center gap-2">
        <span className="text-xs font-medium shrink-0" style={{ color: C.muted }}>Mode:</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => eqMode && toggleEqMode()}
            style={!eqMode ? { ...S.pillOn, color: C.amber } : { ...S.pillOff, color: C.muted }}
            className="px-3 py-1 text-xs font-semibold transition-all"
          >
            Definitions
          </button>
          <button
            onClick={() => !eqMode && toggleEqMode()}
            style={eqMode
              ? { ...S.pillOn, color:'#4C1D95', background:'rgba(237,233,254,0.75)', border:'1px solid rgba(196,181,253,0.7)' }
              : { ...S.pillOff, color: C.muted }
            }
            className="flex items-center gap-1 px-3 py-1 text-xs font-semibold transition-all"
          >
            <Calculator className="size-3" />
            Equation practice
          </button>
        </div>
      </div>

      {/* ── Progress + stats ── */}
      <div className="relative flex items-center justify-between text-xs">
        <span style={{ color: C.muted }}>Card {total > 0 ? index + 1 : 0} of {total}{eqMode ? ' (equations)' : ''}</span>
        <div className="flex gap-3">
          <span style={{ color:'#166534', fontWeight:600 }}>{knownCount} Got it</span>
          <span style={{ color:'#92400E', fontWeight:600 }}>{studyCount} Still learning</span>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 transition-opacity hover:opacity-60"
          style={{ color: C.muted }}
        >
          <RefreshCw className="size-3" />
          Reset
        </button>
      </div>

      <div className="relative" style={S.track}>
        <div style={{ ...S.fill, width: total > 0 ? `${((index + 1) / total) * 100}%` : '0%' }} />
      </div>

      {/* ── Card + nav ── */}
      {total === 0 ? (
        <div className="relative flex items-center justify-center text-center p-8" style={{ ...S.card, minHeight:'200px' }}>
          <p className="text-sm whitespace-pre-line" style={{ color: C.muted }}>
            {eqMode ? 'No equation cards in this filter.\nTry a different difficulty or topic.' : 'No cards match this filter.'}
          </p>
        </div>
      ) : (
        <div className="relative flex items-center gap-3 w-full">

          {/* Prev */}
          <button
            onClick={goPrev}
            className="shrink-0 size-8 flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ ...S.btn, borderRadius:'50%', padding:0 }}
          >
            <ChevronLeft className="size-4" style={{ color: C.amber }} />
          </button>

          {/* ── Equation card ── */}
          {eqMode ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-5" style={{ ...S.card, minHeight:'220px' }}>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs font-medium ${categoryColor}`} variant="outline">{card.category}</Badge>
                {card.generated && (
                  <Badge className="text-xs bg-amber-200/50 border-amber-300/50 text-amber-900" variant="outline">
                    <Sparkles className="size-2.5 mr-1" />AI
                  </Badge>
                )}
              </div>

              <p className="text-lg font-bold text-center" style={{ color: C.heading }}>{card.front}</p>

              {/* Equation with blank */}
              <div className="flex flex-wrap items-center justify-center gap-1 text-sm font-semibold">
                {eqTokens.map((t, i) => {
                  if (i === blankTokenIdx) {
                    return <span key={i} style={blankSlotStyle}>{answerChecked ? (userAnswer || '?') : '___'}</span>;
                  }
                  if (EQ_OPS.has(t)) return <span key={i} style={{ color: C.muted, fontWeight:700, padding:'0 2px' }}>{t}</span>;
                  return <span key={i} style={{ color: C.heading }}>{t}</span>;
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
                    style={{
                      flex:1, background:'rgba(255,255,255,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
                      border:'none', borderBottom:'2px solid rgba(200,160,60,0.45)', borderRadius:'10px', outline:'none',
                      padding:'7px 12px', fontSize:'13px', color: C.heading,
                    }}
                    className="placeholder:text-[rgba(80,60,0,0.35)]"
                    autoFocus
                  />
                  <button
                    onClick={handleCheckAnswer}
                    disabled={!userAnswer.trim()}
                    className="px-4 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-40"
                    style={{ ...S.btn, color: C.amber }}
                  >
                    Check
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-center">
                  <p className="text-sm font-semibold" style={{ color: answerCorrect ? '#065F46' : '#9F1239' }}>
                    {answerCorrect ? '✓ Correct!' : `✗ Answer: "${correctAnswer}"`}
                  </p>
                  {!answerCorrect && (
                    <p className="text-xs" style={{ color: C.muted }}>Full: {equation}</p>
                  )}
                </div>
              )}
            </div>

          ) : (
            /* ── Flip card ── */
            <div
              className="flex-1 cursor-pointer"
              style={{ perspective:'1000px', height:'220px' }}
              onClick={handleFlip}
            >
              <div style={{
                position:'relative', width:'100%', height:'100%',
                transformStyle:'preserve-3d',
                transition:'transform 0.45s cubic-bezier(0.4,0.2,0.2,1)',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                {/* Front */}
                <div
                  style={{ ...S.card, backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden' }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs font-medium ${categoryColor}`} variant="outline">{card.category}</Badge>
                    {card.generated && (
                      <Badge className="text-xs bg-amber-200/50 border-amber-300/50 text-amber-900" variant="outline">
                        <Sparkles className="size-2.5 mr-1" />AI
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-center leading-snug" style={{ color: C.heading }}>{card.front}</p>
                  <p className="text-xs" style={{ color: C.muted }}>Click to flip</p>
                </div>

                {/* Back */}
                <div
                  style={{ ...S.card, backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden', transform:'rotateY(180deg)' }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 overflow-y-auto"
                >
                  <p className="text-sm text-center leading-relaxed whitespace-pre-line" style={{ color: C.body }}>{card.back}</p>
                </div>
              </div>
            </div>
          )}

          {/* Next */}
          <button
            onClick={goNext}
            className="shrink-0 size-8 flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ ...S.btn, borderRadius:'50%', padding:0 }}
          >
            <ChevronRight className="size-4" style={{ color: C.amber }} />
          </button>
        </div>
      )}

      {/* ── Action buttons ── */}
      {total > 0 && (!eqMode || answerChecked) && (
        <div className="relative flex gap-2 justify-center flex-wrap">
          <button
            onClick={handleStudyMore}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-75"
            style={cardStatus === 'studying' ? { ...btnStudying, color:'#92400E' } : { ...S.btn, color: C.body }}
          >
            <RotateCcw className="size-3.5" style={{ color:'#D97706' }} />
            Still learning
          </button>
          <button
            onClick={handleKnow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-75"
            style={cardStatus === 'known' ? { ...btnKnown, color:'#065F46' } : { ...S.btn, color: C.body }}
          >
            <Check className="size-3.5" style={{ color:'#10B981' }} />
            Got it!
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-75"
            style={isSaved ? { ...btnSaved, color:'#4C1D95' } : { ...S.btn, color: C.body }}
          >
            {isSaved
              ? <BookmarkCheck className="size-3.5" style={{ color:'#7C3AED' }} />
              : <BookmarkPlus className="size-3.5" style={{ color:'#7C3AED' }} />}
            {isSaved ? 'Saved!' : 'Save to my list'}
          </button>
          {eqMode && (
            <button
              onClick={goNext}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-75"
              style={{ ...S.btn, color: C.amber }}
            >
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
          className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-75 disabled:opacity-40"
          style={{ ...S.btn, color: C.amber }}
        >
          <Sparkles className="size-3.5" />
          {generating ? 'Generating…' : 'Generate more cards'}
        </button>
        {generateMsg && (
          <p className="text-xs" style={{ color: generateMsg.startsWith('✓') ? '#166534' : '#9F1239' }}>
            {generateMsg}
          </p>
        )}
      </div>

    </div>
  );
}
