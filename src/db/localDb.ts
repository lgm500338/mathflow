import type { DifficultyTier, Operator } from '../engine/puzzleGenerator';
import type { LanguageCode } from '../i18n/translations';
import { detectDefaultLanguage } from '../i18n/translations';

export interface OpCountMap {
  '+': number;
  '-': number;
  '×': number;
  '÷': number;
}

export interface SolveSession {
  id: string;
  puzzleNo: number;
  tier: DifficultyTier;
  completedAt: number;
  dateKey: string; // YYYY-MM-DD local
  durationSec: number;
  mistakes: number;
  hintsUsed: number;
  blanksCount: number;
  opCounts: OpCountMap;
  opMistakes: OpCountMap;
}

export interface InProgressState {
  puzzleNo: number;
  values: Record<string, string>;
  hintedKeys: string[];
  elapsedSec: number;
  mistakes: number;
  opMistakes: OpCountMap;
  updatedAt: number;
}

export interface UserPreferences {
  language: LanguageCode;
  soundEnabled: boolean;
  lastPuzzleNo: number;
}

export interface LearningAnalyticsSummary {
  totalClearedUnique: number;
  consecutiveCleared: number;
  maxUnlockedPuzzleNo: number;
  totalSessions: number;
  avgDurationSec: number;
  overallAccuracy: number;
  currentStreakDays: number;
  opStats: Record<Operator, { solvedEqs: number; mistakes: number; accuracy: number }>;
  strongestOp: Operator | null;
  weakestOp: Operator | null;
  tierClearedCounts: Record<DifficultyTier, number>;
  last7Days: Array<{ dateKey: string; label: string; count: number }>;
  recentSessions: SolveSession[];
}

const DB_NAME = 'CrossMathOfflineDB';
const DB_VERSION = 1;
const STORE_META = 'meta';
const STORE_SESSIONS = 'sessions';
const STORE_PROGRESS = 'inProgress';

const LS_FALLBACK_KEY = 'crossmath_offline_fallback_v1';

interface FallbackBlob {
  cleared: number[];
  prefs: UserPreferences;
  sessions: SolveSession[];
  inProgress: Record<number, InProgressState>;
}

function getLocalDateKey(ts = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyOpMap(): OpCountMap {
  return { '+': 0, '-': 0, '×': 0, '÷': 0 };
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          store.createIndex('completedAt', 'completedAt');
          store.createIndex('puzzleNo', 'puzzleNo');
        }
        if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
          db.createObjectStore(STORE_PROGRESS, { keyPath: 'puzzleNo' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function loadFallback(): FallbackBlob {
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (raw) return JSON.parse(raw) as FallbackBlob;
  } catch {
    // ignore storage errors
  }
  return {
    cleared: [],
    prefs: { language: detectDefaultLanguage(), soundEnabled: true, lastPuzzleNo: 1 },
    sessions: [],
    inProgress: {},
  };
}

function saveFallback(blob: FallbackBlob): void {
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(blob));
  } catch {
    // ignore quota errors
  }
}

export function computeConsecutiveCleared(clearedNumbers: Iterable<number>): number {
  const set = new Set<number>(clearedNumbers);
  let n = 0;
  while (set.has(n + 1)) {
    n++;
  }
  return n;
}

export function computeMaxUnlocked(clearedNumbers: Iterable<number>): number {
  const consecutive = computeConsecutiveCleared(clearedNumbers);
  // Strict +5 window ahead of consecutive cleared progress:
  // Start (0 cleared) -> NO.1..5 unlocked; NO.100 cleared -> NO.101..105 unlocked.
  return consecutive + 5;
}

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private getDB(): Promise<IDBDatabase | null> {
    if (!this.dbPromise) {
      this.dbPromise = openDB();
    }
    return this.dbPromise;
  }

  async getPreferences(): Promise<UserPreferences> {
    const db = await this.getDB();
    const defaults: UserPreferences = {
      language: detectDefaultLanguage(),
      soundEnabled: true,
      lastPuzzleNo: 1,
    };
    if (!db) {
      return { ...defaults, ...loadFallback().prefs };
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('prefs');
      req.onsuccess = () => resolve(req.result ? { ...defaults, ...req.result } : defaults);
      req.onerror = () => resolve(defaults);
    });
  }

  async savePreferences(prefs: UserPreferences): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const fb = loadFallback();
      fb.prefs = prefs;
      saveFallback(fb);
      return;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put(prefs, 'prefs');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async getClearedSet(): Promise<Set<number>> {
    const db = await this.getDB();
    if (!db) {
      return new Set(loadFallback().cleared);
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('cleared');
      req.onsuccess = () => resolve(new Set<number>(Array.isArray(req.result) ? req.result : []));
      req.onerror = () => resolve(new Set<number>());
    });
  }

  async getInProgress(puzzleNo: number): Promise<InProgressState | null> {
    const db = await this.getDB();
    if (!db) {
      return loadFallback().inProgress[puzzleNo] ?? null;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROGRESS, 'readonly');
      const req = tx.objectStore(STORE_PROGRESS).get(puzzleNo);
      req.onsuccess = () => resolve((req.result as InProgressState) ?? null);
      req.onerror = () => resolve(null);
    });
  }

  async saveInProgress(state: InProgressState): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const fb = loadFallback();
      fb.inProgress[state.puzzleNo] = state;
      saveFallback(fb);
      return;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROGRESS, 'readwrite');
      tx.objectStore(STORE_PROGRESS).put(state);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async clearInProgress(puzzleNo: number): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const fb = loadFallback();
      delete fb.inProgress[puzzleNo];
      saveFallback(fb);
      return;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROGRESS, 'readwrite');
      tx.objectStore(STORE_PROGRESS).delete(puzzleNo);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async recordCompletion(input: Omit<SolveSession, 'id' | 'completedAt' | 'dateKey'>): Promise<SolveSession> {
    const now = Date.now();
    const session: SolveSession = {
      ...input,
      id: `${input.puzzleNo}-${now}`,
      completedAt: now,
      dateKey: getLocalDateKey(now),
    };

    const cleared = await this.getClearedSet();
    cleared.add(input.puzzleNo);
    const clearedArr = Array.from(cleared).sort((a, b) => a - b);

    const db = await this.getDB();
    if (!db) {
      const fb = loadFallback();
      fb.cleared = clearedArr;
      fb.sessions.push(session);
      delete fb.inProgress[input.puzzleNo];
      saveFallback(fb);
      return session;
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORE_META, STORE_SESSIONS, STORE_PROGRESS], 'readwrite');
      tx.objectStore(STORE_META).put(clearedArr, 'cleared');
      tx.objectStore(STORE_SESSIONS).put(session);
      tx.objectStore(STORE_PROGRESS).delete(input.puzzleNo);
      tx.oncomplete = () => resolve(session);
      tx.onerror = () => resolve(session);
    });
  }

  async getAllSessions(): Promise<SolveSession[]> {
    const db = await this.getDB();
    if (!db) {
      return [...loadFallback().sessions].sort((a, b) => b.completedAt - a.completedAt);
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const req = tx.objectStore(STORE_SESSIONS).getAll();
      req.onsuccess = () => {
        const list = (req.result as SolveSession[]) || [];
        list.sort((a, b) => b.completedAt - a.completedAt);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  }

  async getBestTimeMap(): Promise<Record<number, number>> {
    const sessions = await this.getAllSessions();
    const map: Record<number, number> = {};
    for (const s of sessions) {
      if (map[s.puzzleNo] === undefined || s.durationSec < map[s.puzzleNo]) {
        map[s.puzzleNo] = s.durationSec;
      }
    }
    return map;
  }

  async getAnalyticsSummary(): Promise<LearningAnalyticsSummary> {
    const [clearedSet, sessions] = await Promise.all([this.getClearedSet(), this.getAllSessions()]);
    const consecutiveCleared = computeConsecutiveCleared(clearedSet);
    const maxUnlockedPuzzleNo = consecutiveCleared + 5;

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((acc, s) => acc + s.durationSec, 0);
    const avgDurationSec = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;

    let totalBlanks = 0;
    let totalMistakes = 0;
    const opCounts = emptyOpMap();
    const opMistakes = emptyOpMap();

    for (const s of sessions) {
      totalBlanks += s.blanksCount;
      totalMistakes += s.mistakes;
      (['+', '-', '×', '÷'] as Operator[]).forEach((op) => {
        opCounts[op] += s.opCounts?.[op] ?? 0;
        opMistakes[op] += s.opMistakes?.[op] ?? 0;
      });
    }

    const overallAccuracy =
      totalBlanks + totalMistakes > 0
        ? Math.round((totalBlanks / (totalBlanks + totalMistakes)) * 100)
        : 100;

    const opStats = {} as Record<Operator, { solvedEqs: number; mistakes: number; accuracy: number }>;
    let strongestOp: Operator | null = null;
    let weakestOp: Operator | null = null;
    let bestAcc = -1;
    let worstAcc = 101;

    (['+', '-', '×', '÷'] as Operator[]).forEach((op) => {
      const solved = opCounts[op];
      const err = opMistakes[op];
      const acc = solved + err > 0 ? Math.round((solved / (solved + err)) * 100) : 0;
      opStats[op] = { solvedEqs: solved, mistakes: err, accuracy: acc };
      if (solved >= 2) {
        if (acc > bestAcc) {
          bestAcc = acc;
          strongestOp = op;
        }
        if (acc < worstAcc) {
          worstAcc = acc;
          weakestOp = op;
        }
      }
    });

    if (strongestOp && weakestOp && bestAcc - worstAcc < 4) {
      weakestOp = null; // Balanced performance
    }

    // Tier cleared counts
    const tierClearedCounts: Record<DifficultyTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const n of clearedSet) {
      if (n <= 19) tierClearedCounts[1]++;
      else if (n <= 99) tierClearedCounts[2]++;
      else if (n <= 299) tierClearedCounts[3]++;
      else if (n <= 999) tierClearedCounts[4]++;
      else tierClearedCounts[5]++;
    }

    // Daily counts & streak
    const dailyMap = new Map<string, number>();
    for (const s of sessions) {
      dailyMap.set(s.dateKey, (dailyMap.get(s.dateKey) ?? 0) + 1);
    }

    const last7Days: Array<{ dateKey: string; label: string; count: number }> = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dk = getLocalDateKey(d.getTime());
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      last7Days.push({ dateKey: dk, label, count: dailyMap.get(dk) ?? 0 });
    }

    let currentStreakDays = 0;
    const todayKey = getLocalDateKey(today.getTime());
    const startOffset = dailyMap.has(todayKey) ? 0 : 1;
    for (let i = startOffset; i < 3650; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dk = getLocalDateKey(d.getTime());
      if ((dailyMap.get(dk) ?? 0) > 0) {
        currentStreakDays++;
      } else {
        break;
      }
    }

    return {
      totalClearedUnique: clearedSet.size,
      consecutiveCleared,
      maxUnlockedPuzzleNo,
      totalSessions,
      avgDurationSec,
      overallAccuracy,
      currentStreakDays,
      opStats,
      strongestOp,
      weakestOp,
      tierClearedCounts,
      last7Days,
      recentSessions: sessions.slice(0, 12),
    };
  }
}

export const localDb = new LocalDatabase();
