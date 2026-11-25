import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Grid2x2,
  Lock,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { AnalyticsView } from './components/AnalyticsView';
import { CrossMathBoard, type EquationStatus } from './components/CrossMathBoard';
import { LanguageSelector } from './components/LanguageSelector';
import { NumberKeypad } from './components/NumberKeypad';
import { PWAInstallButton } from './components/PWAInstallButton';
import { StageBrowser } from './components/StageBrowser';
import {
  computeConsecutiveCleared,
  localDb,
  type LearningAnalyticsSummary,
  type OpCountMap,
} from './db/localDb';
import {
  evaluateEquation,
  findNextLogicalHintCell,
  generatePuzzle,
  getTierForPuzzle,
  type Operator,
} from './engine/puzzleGenerator';
import { useOnlineStatus } from './hooks/usePWAInstall';
import {
  detectDefaultLanguage,
  TRANSLATIONS,
  type LanguageCode,
} from './i18n/translations';
import { hintProvider } from './services/hintAdapter';
import { soundFx } from './services/soundFx';

type ActiveTab = 'play' | 'stages' | 'analytics';

function emptyOpMistakes(): OpCountMap {
  return { '+': 0, '-': 0, '×': 0, '÷': 0 };
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [language, setLanguage] = useState<LanguageCode>(() => detectDefaultLanguage());
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Progression & Analytics state (from offline IndexedDB)
  const [clearedSet, setClearedSet] = useState<Set<number>>(() => new Set());
  const [bestTimes, setBestTimes] = useState<Record<number, number>>({});
  const [analytics, setAnalytics] = useState<LearningAnalyticsSummary | null>(null);

  // Current Puzzle Play state
  const [puzzleNo, setPuzzleNo] = useState<number>(1);
  const [userValues, setUserValues] = useState<Record<string, string>>({});
  const [hintedKeys, setHintedKeys] = useState<Set<string>>(() => new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [opMistakes, setOpMistakes] = useState<OpCountMap>(emptyOpMistakes);
  const [isSolved, setIsSolved] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const recordedErrorSigsRef = useRef<Set<string>>(new Set());
  const matchedEqIdsRef = useRef<Set<string>>(new Set());
  const isOnline = useOnlineStatus();

  const t = TRANSLATIONS[language];

  // Keep <html lang> in sync for screen readers, hyphenation and font fallback
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const consecutiveCleared = useMemo(() => computeConsecutiveCleared(clearedSet), [clearedSet]);
  const maxUnlockedPuzzleNo = consecutiveCleared + 5;

  // Deterministic offline puzzle generation (< 2ms for any NO.1 .. NO.999999)
  const puzzle = useMemo(() => generatePuzzle(puzzleNo), [puzzleNo]);

  // Load saved state for a specific puzzle number
  const loadPuzzleSession = useCallback(async (targetNo: number, forceFresh = false) => {
    const gen = generatePuzzle(targetNo);
    recordedErrorSigsRef.current = new Set();
    matchedEqIdsRef.current = new Set();

    if (!forceFresh) {
      const saved = await localDb.getInProgress(targetNo);
      if (saved) {
        setPuzzleNo(targetNo);
        setUserValues(saved.values);
        setHintedKeys(new Set(saved.hintedKeys));
        setElapsedSec(saved.elapsedSec);
        setMistakes(saved.mistakes);
        setOpMistakes(saved.opMistakes ?? emptyOpMistakes());
        setIsSolved(false);
        const firstEmpty =
          gen.blankKeys.find((k) => !saved.values[k]) ?? gen.blankKeys[0] ?? null;
        setSelectedKey(firstEmpty);
        return;
      }
    } else {
      await localDb.clearInProgress(targetNo);
    }

    setPuzzleNo(targetNo);
    setUserValues({});
    setHintedKeys(new Set());
    setElapsedSec(0);
    setMistakes(0);
    setOpMistakes(emptyOpMistakes());
    setIsSolved(false);
    setSelectedKey(gen.blankKeys[0] ?? null);
  }, []);

  const refreshAnalytics = useCallback(async () => {
    const [cleared, times, summary] = await Promise.all([
      localDb.getClearedSet(),
      localDb.getBestTimeMap(),
      localDb.getAnalyticsSummary(),
    ]);
    setClearedSet(cleared);
    setBestTimes(times);
    setAnalytics(summary);
  }, []);

  // Initial offline DB hydration
  useEffect(() => {
    let active = true;
    (async () => {
      const [prefs, cleared, times, summary] = await Promise.all([
        localDb.getPreferences(),
        localDb.getClearedSet(),
        localDb.getBestTimeMap(),
        localDb.getAnalyticsSummary(),
      ]);
      if (!active) return;

      setLanguage(prefs.language);
      setSoundEnabled(prefs.soundEnabled);
      soundFx.enabled = prefs.soundEnabled;
      setClearedSet(cleared);
      setBestTimes(times);
      setAnalytics(summary);

      const allowedMax = computeConsecutiveCleared(cleared) + 5;
      const startNo = Math.min(Math.max(1, prefs.lastPuzzleNo), allowedMax);
      await loadPuzzleSession(startNo);
      if (active) setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [loadPuzzleSession]);

  // Persist user preferences when language, sound, or puzzleNo changes
  useEffect(() => {
    if (!hydrated) return;
    soundFx.enabled = soundEnabled;
    localDb.savePreferences({
      language,
      soundEnabled,
      lastPuzzleNo: puzzleNo,
    });
  }, [hydrated, language, soundEnabled, puzzleNo]);

  // Active solve timer (pauses when solved or away from play tab)
  useEffect(() => {
    if (!hydrated || isSolved || activeTab !== 'play') return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [hydrated, isSolved, activeTab]);

  // Auto-save in-progress state offline to IndexedDB
  useEffect(() => {
    if (!hydrated || isSolved) return;
    const hasAnyInput = Object.keys(userValues).length > 0 || hintedKeys.size > 0;
    if (!hasAnyInput && elapsedSec === 0) return;

    const timer = window.setTimeout(() => {
      localDb.saveInProgress({
        puzzleNo,
        values: userValues,
        hintedKeys: Array.from(hintedKeys),
        elapsedSec,
        mistakes,
        opMistakes,
        updatedAt: Date.now(),
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [hydrated, isSolved, puzzleNo, userValues, hintedKeys, elapsedSec, mistakes, opMistakes]);

  // Evaluate equations in real time with prefix-awareness for multi-digit entry
  const { equationStatuses, errorCellKeys, allEquationsValid, blanksRemaining } = useMemo(() => {
    const statuses: Record<string, EquationStatus> = {};
    const errCells = new Set<string>();
    let validCount = 0;

    const getVal = (k: string): number | null => {
      const node = puzzle.nodes[k];
      if (!node) return null;
      if (!node.isBlank) return node.answer;
      const raw = userValues[k];
      if (!raw || raw.trim() === '') return null;
      const parsed = Number(raw);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    };

    const isStillTypingPrefix = (k: string): boolean => {
      if (k !== selectedKey) return false;
      const node = puzzle.nodes[k];
      if (!node || !node.isBlank) return false;
      const raw = userValues[k] ?? '';
      const target = String(node.answer);
      return raw.length > 0 && raw.length < target.length && target.startsWith(raw);
    };

    for (const eq of puzzle.equations) {
      const [k0, k1, k2] = eq.cells;
      const v0 = getVal(k0);
      const v1 = getVal(k1);
      const v2 = getVal(k2);

      if (v0 === null || v1 === null || v2 === null) {
        statuses[eq.id] = 'incomplete';
        continue;
      }

      const expected = evaluateEquation(v0, eq.op, v1);
      if (expected === v2) {
        statuses[eq.id] = 'valid';
        validCount++;
      } else if (
        isStillTypingPrefix(k0) ||
        isStillTypingPrefix(k1) ||
        isStillTypingPrefix(k2)
      ) {
        statuses[eq.id] = 'incomplete';
      } else {
        statuses[eq.id] = 'invalid';
        eq.cells.forEach((ck) => {
          if (puzzle.nodes[ck]?.isBlank && !hintedKeys.has(ck)) {
            errCells.add(ck);
          }
        });
      }
    }

    let remaining = 0;
    for (const bk of puzzle.blankKeys) {
      if (!userValues[bk]) remaining++;
    }

    return {
      equationStatuses: statuses,
      errorCellKeys: errCells,
      allEquationsValid: validCount === puzzle.equations.length && remaining === 0,
      blanksRemaining: remaining,
    };
  }, [puzzle, userValues, selectedKey, hintedKeys]);

  // Track newly detected equation errors (deduplicated) & equation match chimes
  useEffect(() => {
    if (!hydrated || isSolved) return;

    let newMistakeCount = 0;
    const opErrDelta: OpCountMap = emptyOpMistakes();
    let playedMatch = false;

    for (const eq of puzzle.equations) {
      const status = equationStatuses[eq.id];
      if (status === 'invalid') {
        const sig = `${eq.id}:${eq.cells.map((k) => userValues[k] ?? puzzle.nodes[k]?.answer).join(',')}`;
        if (!recordedErrorSigsRef.current.has(sig)) {
          recordedErrorSigsRef.current.add(sig);
          newMistakeCount++;
          opErrDelta[eq.op]++;
        }
      } else if (status === 'valid') {
        if (!matchedEqIdsRef.current.has(eq.id)) {
          matchedEqIdsRef.current.add(eq.id);
          playedMatch = true;
        }
      } else {
        matchedEqIdsRef.current.delete(eq.id);
      }
    }

    if (newMistakeCount > 0) {
      setMistakes((m) => m + newMistakeCount);
      setOpMistakes((prev) => ({
        '+': prev['+'] + opErrDelta['+'],
        '-': prev['-'] + opErrDelta['-'],
        '×': prev['×'] + opErrDelta['×'],
        '÷': prev['÷'] + opErrDelta['÷'],
      }));
      setShakeKey((k) => k + 1);
      soundFx.error();
    } else if (playedMatch && !allEquationsValid) {
      soundFx.equationMatch();
    }
  }, [hydrated, isSolved, equationStatuses, puzzle, userValues, allEquationsValid]);

  // Trigger puzzle victory & persist to offline IndexedDB
  useEffect(() => {
    if (!hydrated || isSolved || !allEquationsValid) return;

    setIsSolved(true);
    soundFx.victory();

    const opCounts: OpCountMap = emptyOpMistakes();
    for (const eq of puzzle.equations) {
      opCounts[eq.op]++;
    }

    localDb
      .recordCompletion({
        puzzleNo: puzzle.puzzleNo,
        tier: puzzle.tier,
        durationSec: Math.max(1, elapsedSec),
        mistakes,
        hintsUsed: hintedKeys.size,
        blanksCount: puzzle.blankKeys.length,
        opCounts,
        opMistakes,
      })
      .then(() => refreshAnalytics());
  }, [
    hydrated,
    isSolved,
    allEquationsValid,
    puzzle,
    elapsedSec,
    mistakes,
    hintedKeys,
    opMistakes,
    refreshAnalytics,
  ]);

  // Select puzzle with strict +5 unlock enforcement
  const handleSelectPuzzle = useCallback(
    async (targetNo: number) => {
      if (targetNo < 1 || targetNo > maxUnlockedPuzzleNo) return;
      await loadPuzzleSession(targetNo);
      setActiveTab('play');
    },
    [maxUnlockedPuzzleNo, loadPuzzleSession]
  );

  // Find next unsolved blank after a cell completes accurately
  const findNextUnsolvedBlank = useCallback(
    (currentKey: string, nextVals: Record<string, string>): string | null => {
      const idx = puzzle.blankKeys.indexOf(currentKey);
      const total = puzzle.blankKeys.length;
      for (let offset = 1; offset <= total; offset++) {
        const cand = puzzle.blankKeys[(idx + offset) % total];
        if (!hintedKeys.has(cand) && !nextVals[cand]) {
          return cand;
        }
      }
      return currentKey;
    },
    [puzzle.blankKeys, hintedKeys]
  );

  const handleDigitInput = useCallback(
    (digit: string) => {
      if (isSolved) return;
      let targetKey = selectedKey;
      if (!targetKey || !puzzle.nodes[targetKey]?.isBlank || hintedKeys.has(targetKey)) {
        targetKey =
          puzzle.blankKeys.find((k) => !hintedKeys.has(k) && !userValues[k]) ??
          puzzle.blankKeys.find((k) => !hintedKeys.has(k)) ??
          null;
        if (!targetKey) return;
        setSelectedKey(targetKey);
      }

      const current = userValues[targetKey] ?? '';
      if (current.length >= puzzle.maxInputDigits) return;
      if (current === '' && digit === '0') return; // positive integers only

      const nextVal = current + digit;
      const nextVals = { ...userValues, [targetKey]: nextVal };
      setUserValues(nextVals);
      soundFx.tap();

      // Smoothly advance when the cell matches its exact answer length & value
      const expected = String(puzzle.nodes[targetKey].answer);
      if (nextVal === expected) {
        const nextBlank = findNextUnsolvedBlank(targetKey, nextVals);
        if (nextBlank) setSelectedKey(nextBlank);
      }
    },
    [isSolved, selectedKey, puzzle, hintedKeys, userValues, findNextUnsolvedBlank]
  );

  const handleBackspace = useCallback(() => {
    if (isSolved || !selectedKey || hintedKeys.has(selectedKey)) return;
    const cur = userValues[selectedKey] ?? '';
    if (!cur) return;
    soundFx.backspace();
    const next = cur.slice(0, -1);
    setUserValues((prev) => {
      const copy = { ...prev };
      if (next === '') delete copy[selectedKey];
      else copy[selectedKey] = next;
      return copy;
    });
  }, [isSolved, selectedKey, hintedKeys, userValues]);

  const handleClearCell = useCallback(() => {
    if (isSolved || !selectedKey || hintedKeys.has(selectedKey)) return;
    if (!userValues[selectedKey]) return;
    soundFx.backspace();
    setUserValues((prev) => {
      const copy = { ...prev };
      delete copy[selectedKey];
      return copy;
    });
  }, [isSolved, selectedKey, hintedKeys, userValues]);

  const handleResetPuzzle = useCallback(() => {
    if (isSolved) return;
    soundFx.backspace();
    setUserValues((prev) => {
      const kept: Record<string, string> = {};
      hintedKeys.forEach((hk) => {
        if (prev[hk]) kept[hk] = prev[hk];
      });
      return kept;
    });
    const firstEditable = puzzle.blankKeys.find((k) => !hintedKeys.has(k)) ?? null;
    setSelectedKey(firstEditable);
  }, [isSolved, hintedKeys, puzzle.blankKeys]);

  const handleRequestHint = useCallback(async () => {
    if (isSolved) return;
    const targetCell = findNextLogicalHintCell(puzzle, userValues, selectedKey);
    if (!targetCell) return;

    const reward = await hintProvider.requestHintReward();
    if (!reward.granted) return;

    const answerStr = String(puzzle.nodes[targetCell].answer);
    const nextVals = { ...userValues, [targetCell]: answerStr };
    const nextHints = new Set(hintedKeys);
    nextHints.add(targetCell);

    setUserValues(nextVals);
    setHintedKeys(nextHints);
    soundFx.hint();

    const nextEmpty =
      puzzle.blankKeys.find((k) => !nextHints.has(k) && !nextVals[k]) ??
      puzzle.blankKeys.find((k) => !nextHints.has(k)) ??
      null;
    setSelectedKey(nextEmpty);
  }, [isSolved, puzzle, userValues, selectedKey, hintedKeys]);

  // Full desktop keyboard support
  useEffect(() => {
    if (activeTab !== 'play') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitInput(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleClearCell();
      } else if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (puzzle.blankKeys.length > 0 && !isSolved) {
          e.preventDefault();
          const idx = selectedKey ? puzzle.blankKeys.indexOf(selectedKey) : -1;
          const next = puzzle.blankKeys[(idx + 1) % puzzle.blankKeys.length];
          setSelectedKey(next);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (puzzle.blankKeys.length > 0 && !isSolved) {
          e.preventDefault();
          const idx = selectedKey ? puzzle.blankKeys.indexOf(selectedKey) : 0;
          const prev =
            puzzle.blankKeys[(idx - 1 + puzzle.blankKeys.length) % puzzle.blankKeys.length];
          setSelectedKey(prev);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    isSolved,
    puzzle.blankKeys,
    selectedKey,
    handleDigitInput,
    handleBackspace,
    handleClearCell,
  ]);

  const currentTierLabel = useMemo(() => {
    const tier = getTierForPuzzle(puzzleNo);
    if (tier === 1) return t.tier1Name;
    if (tier === 2) return t.tier2Name;
    if (tier === 3) return t.tier3Name;
    if (tier === 4) return t.tier4Name;
    return t.tier5Name;
  }, [puzzleNo, t]);

  // Frontier quick strip: shows the 5 active unlocked stages ahead of consecutiveCleared + 1 locked sentinel
  const frontierStages = useMemo(() => {
    const start = consecutiveCleared + 1;
    return [start, start + 1, start + 2, start + 3, start + 4, start + 5];
  }, [consecutiveCleared]);

  const hasAnyError = errorCellKeys.size > 0;
  const canUseHint =
    !isSolved &&
    puzzle.blankKeys.some((k) => userValues[k] !== String(puzzle.nodes[k].answer));

  const handleNextPuzzle = () => {
    const nextNo = puzzleNo + 1;
    // Since current puzzle is solved, check updated allowance (consecutiveCleared may have incremented)
    const updatedSet = new Set(clearedSet);
    updatedSet.add(puzzleNo);
    const updatedMax = computeConsecutiveCleared(updatedSet) + 5;
    if (nextNo <= updatedMax) {
      loadPuzzleSession(nextNo);
    } else {
      loadPuzzleSession(computeConsecutiveCleared(updatedSet) + 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8F9] text-slate-900">
      {/* Top Navigation Bar — Clean 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('play')}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.appName}
          </button>

          {/* Zone 2: Clean single-line text nav links (Desktop) */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('play')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                activeTab === 'play'
                  ? 'text-teal-800 border-teal-700'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              {t.navPlay}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stages')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                activeTab === 'stages'
                  ? 'text-teal-800 border-teal-700'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              {t.navStages}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                activeTab === 'analytics'
                  ? 'text-teal-800 border-teal-700'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              {t.navAnalytics}
            </button>
          </nav>

          {/* Zone 3: Language & Install Action */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton t={t} />
            <LanguageSelector t={t} currentLang={language} onChange={setLanguage} />
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4 sm:pt-7 pb-24 md:pb-10">
        {activeTab === 'play' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
            {/* Left / Center Primary Focal Anchor: Cross-Math Puzzle Board */}
            <section className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6">
              {/* Stage Identity & Quiet Unboxed Metadata */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-extrabold font-num tracking-tight text-slate-900">
                      NO.{puzzle.puzzleNo}
                    </h1>
                    {clearedSet.has(puzzle.puzzleNo) && (
                      <span className="text-xs font-semibold text-teal-700">
                        · {t.clearedBadge}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span>{currentTierLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-num">
                      {t.blanksLeft}: {blanksRemaining}
                    </span>
                  </div>
                </div>

                {/* Timer + Sound Toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-num text-sm sm:text-base font-bold text-slate-800 px-2">
                    {formatTimer(elapsedSec)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled((s) => !s)}
                    aria-label={soundEnabled ? t.soundOn : t.soundOff}
                    title={soundEnabled ? t.soundOn : t.soundOff}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-teal-700" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Interactive Cross-Math Circle Grid */}
              <div className="my-2 sm:my-4">
                <CrossMathBoard
                  t={t}
                  puzzle={puzzle}
                  userValues={userValues}
                  hintedKeys={hintedKeys}
                  selectedKey={selectedKey}
                  equationStatuses={equationStatuses}
                  errorCellKeys={errorCellKeys}
                  shakeKey={shakeKey}
                  isSolved={isSolved}
                  onSelectCell={(k) => {
                    if (!hintedKeys.has(k)) {
                      setSelectedKey(k);
                    }
                  }}
                />
              </div>

              {/* Contextual Status Strip / Solved Banner */}
              {isSolved ? (
                <div className="mt-4 rounded-xl bg-teal-50 border border-teal-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pop">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-teal-900 font-bold text-base">
                      <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0" />
                      <span>{t.solvedTitle}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-teal-800/90">{t.solvedSubtitle}</p>
                    <div className="pt-1 flex items-center gap-2 text-xs font-num text-teal-900/80">
                      <span>
                        {t.timeLabel} {formatTimer(elapsedSec)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.mistakesLabel} {mistakes}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.hintsLabel} {hintedKeys.size}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => loadPuzzleSession(puzzleNo, true)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-teal-300 bg-white text-teal-900 text-sm font-semibold hover:bg-teal-50 transition whitespace-nowrap"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{t.replay}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextPuzzle}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 active:scale-[0.98] transition whitespace-nowrap"
                    >
                      <span>{t.nextPuzzle}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span
                    className={
                      hasAnyError ? 'text-rose-700 font-semibold' : 'text-slate-500'
                    }
                  >
                    {hasAnyError ? t.equationErrorHint : t.selectBlankPrompt}
                  </span>
                  <span className="font-num text-slate-400 shrink-0">
                    {t.mistakesLabel}: {mistakes}
                  </span>
                </div>
              )}
            </section>

            {/* Right Control Column: Keypad & +5 Unlocked Frontier Strip */}
            <aside className="lg:col-span-5 xl:col-span-4 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                <NumberKeypad
                  t={t}
                  disabled={isSolved}
                  canHint={canUseHint}
                  onDigit={handleDigitInput}
                  onBackspace={handleBackspace}
                  onClearCell={handleClearCell}
                  onHint={handleRequestHint}
                  onReset={handleResetPuzzle}
                />
              </div>

              {/* Active +5 Frontier Window Selector */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    NO.{consecutiveCleared + 1} – NO.{maxUnlockedPuzzleNo}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('stages')}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
                  >
                    {t.navStages}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {frontierStages.map((no) => {
                    const locked = no > maxUnlockedPuzzleNo;
                    const active = no === puzzleNo;
                    const cleared = clearedSet.has(no);
                    return (
                      <button
                        key={no}
                        type="button"
                        disabled={locked}
                        onClick={() => handleSelectPuzzle(no)}
                        className={`min-h-[42px] rounded-xl border px-2 text-xs font-num font-bold flex items-center justify-center gap-1 transition ${
                          locked
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            : active
                              ? 'bg-teal-700 border-teal-700 text-white'
                              : cleared
                                ? 'bg-[#EBF6F6] border-[#2A6F77]/40 text-teal-950 hover:border-teal-700'
                                : 'bg-white border-slate-200 text-slate-800 hover:border-teal-600'
                        }`}
                      >
                        {locked && <Lock className="w-3 h-3 shrink-0" />}
                        <span>NO.{no}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {t.unlockedWindowNote}
                </p>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'stages' && (
          <StageBrowser
            t={t}
            currentPuzzleNo={puzzleNo}
            consecutiveCleared={consecutiveCleared}
            maxUnlockedPuzzleNo={maxUnlockedPuzzleNo}
            clearedSet={clearedSet}
            bestTimes={bestTimes}
            onSelectPuzzle={handleSelectPuzzle}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            t={t}
            summary={analytics}
            onJumpToPuzzle={handleSelectPuzzle}
          />
        )}
      </main>

      {/* Subtle Offline Connectivity Indicator (only when browser is offline) */}
      {!isOnline && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-md"
        >
          <WifiOff className="w-3.5 h-3.5 text-teal-400" />
          <span>{t.offlineReady}</span>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation Bar (3 compact thumb-zone tabs, strictly <= 15% cap) */}
      <nav
        aria-label={t.navLabel}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-3 h-14">
          <button
            type="button"
            onClick={() => setActiveTab('play')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
              activeTab === 'play' ? 'text-teal-700' : 'text-slate-500'
            }`}
          >
            <Play className="w-5 h-5" />
            <span className="truncate max-w-[90px]">{t.navPlay}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stages')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
              activeTab === 'stages' ? 'text-teal-700' : 'text-slate-500'
            }`}
          >
            <Grid2x2 className="w-5 h-5" />
            <span className="truncate max-w-[90px]">{t.navStages}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
              activeTab === 'analytics' ? 'text-teal-700' : 'text-slate-500'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="truncate max-w-[90px]">{t.navAnalytics}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
