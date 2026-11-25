export type Operator = '+' | '-' | '×' | '÷';
export type DifficultyTier = 1 | 2 | 3 | 4 | 5;

export interface GridNode {
  key: string; // "r,c"
  r: number;
  c: number;
  answer: number;
  isBlank: boolean;
}

export interface Equation {
  id: string;
  dir: 'H' | 'V';
  cells: [string, string, string]; // [A, B, C] where A op B = C
  op: Operator;
}

export interface EdgeSymbol {
  key: string; // "H:r,c" (between r,c and r,c+1) or "V:r,c" (between r,c and r+1,c)
  symbol: Operator | '=';
  equationId: string;
}

export interface CrossMathPuzzle {
  puzzleNo: number;
  tier: DifficultyTier;
  rows: number;
  cols: number;
  nodes: Record<string, GridNode>;
  equations: Equation[];
  edges: Record<string, EdgeSymbol>;
  blankKeys: string[];
  maxInputDigits: number;
}

interface TierConfig {
  tier: DifficultyTier;
  gridRows: number;
  gridCols: number;
  targetEquations: number;
  targetBlankRatio: number;
  minBlanks: number;
  maxBlanks: number;
  ops: Operator[];
  minOperand: number;
  maxOperand: number;
  minResult: number;
  maxResult: number;
  maxDivisor: number;
  preferMultiDigitOperands: boolean;
  minSeedValue: number;
  maxSeedValue: number;
}

// Fast deterministic PRNG (Mulberry32) so NO.1 .. NO.999999+ always generate identically offline
function createRng(seed: number): () => number {
  let a = (seed ^ 0x6d2b79f5) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function getTierForPuzzle(puzzleNo: number): DifficultyTier {
  if (puzzleNo <= 19) return 1;
  if (puzzleNo <= 99) return 2;
  if (puzzleNo <= 299) return 3;
  if (puzzleNo <= 999) return 4;
  return 5;
}

function getTierConfig(puzzleNo: number): TierConfig {
  // Tier 1: NO.1 - NO.19 (Warmup 1-digit, small grids, gentle ramp up to NO.20)
  if (puzzleNo <= 5) {
    return {
      tier: 1,
      gridRows: 3,
      gridCols: 3,
      targetEquations: puzzleNo <= 2 ? 2 : 3,
      targetBlankRatio: 0.42,
      minBlanks: 2,
      maxBlanks: 4,
      ops: ['+', '-'],
      minOperand: 1,
      maxOperand: 9,
      minResult: 2,
      maxResult: 18,
      maxDivisor: 4,
      preferMultiDigitOperands: false,
      minSeedValue: 2,
      maxSeedValue: 9,
    };
  }
  if (puzzleNo <= 12) {
    return {
      tier: 1,
      gridRows: 4,
      gridCols: 4,
      targetEquations: 4,
      targetBlankRatio: 0.48,
      minBlanks: 4,
      maxBlanks: 6,
      ops: ['+', '-', '×'],
      minOperand: 2,
      maxOperand: 9,
      minResult: 2,
      maxResult: 28,
      maxDivisor: 6,
      preferMultiDigitOperands: false,
      minSeedValue: 2,
      maxSeedValue: 9,
    };
  }
  if (puzzleNo <= 19) {
    return {
      tier: 1,
      gridRows: 5,
      gridCols: 5,
      targetEquations: 5 + (puzzleNo % 2),
      targetBlankRatio: 0.5,
      minBlanks: 5,
      maxBlanks: 7,
      ops: ['+', '-', '×'],
      minOperand: 2,
      maxOperand: 9,
      minResult: 2,
      maxResult: 36,
      maxDivisor: 8,
      preferMultiDigitOperands: false,
      minSeedValue: 2,
      maxSeedValue: 9,
    };
  }

  // Tier 2: NO.20 - NO.99 (User's screenshot baseline! 5x5 connected web, 1-digit focus, results up to ~40)
  if (puzzleNo <= 99) {
    const includeDiv = puzzleNo >= 35;
    return {
      tier: 2,
      gridRows: 5,
      gridCols: 5,
      targetEquations: 7 + (puzzleNo % 3), // 7-9 equations like the reference image
      targetBlankRatio: 0.52 + ((puzzleNo - 20) / 80) * 0.06,
      minBlanks: 7,
      maxBlanks: 10,
      ops: includeDiv ? ['+', '-', '×', '÷'] : ['+', '-', '×'],
      minOperand: 2,
      maxOperand: 12,
      minResult: 2,
      maxResult: 45,
      maxDivisor: 9,
      preferMultiDigitOperands: false,
      minSeedValue: 2,
      maxSeedValue: 9,
    };
  }

  // Tier 3: NO.100 - NO.299 (Still 1-digit friendly numbers, MUCH higher blank density!)
  if (puzzleNo <= 299) {
    const progress = (puzzleNo - 100) / 200; // 0 .. 1
    return {
      tier: 3,
      gridRows: 5,
      gridCols: 5,
      targetEquations: 8 + (puzzleNo % 3), // 8-10 dense equations
      targetBlankRatio: 0.64 + progress * 0.1, // up to 74% blanks!
      minBlanks: 10,
      maxBlanks: 16,
      ops: ['+', '-', '×', '÷'],
      minOperand: 2,
      maxOperand: 9,
      minResult: 2,
      maxResult: 54,
      maxDivisor: 9,
      preferMultiDigitOperands: false,
      minSeedValue: 2,
      maxSeedValue: 9,
    };
  }

  // Tier 4: NO.300 - NO.999 (2-Digit Era!)
  if (puzzleNo <= 999) {
    const progress = (puzzleNo - 300) / 700;
    const maxOp = Math.round(35 + progress * 60); // ramps smoothly from 35 up to 95
    return {
      tier: 4,
      gridRows: 5,
      gridCols: 5,
      targetEquations: 8 + (puzzleNo % 3),
      targetBlankRatio: 0.58 + progress * 0.1,
      minBlanks: 9,
      maxBlanks: 15,
      ops: ['+', '-', '×', '÷'],
      minOperand: 10,
      maxOperand: maxOp,
      minResult: 10,
      maxResult: Math.min(240, maxOp * 3),
      maxDivisor: 15,
      preferMultiDigitOperands: true,
      minSeedValue: 11,
      maxSeedValue: Math.min(75, maxOp),
    };
  }

  // Tier 5: NO.1000+ (3-Digit Endless Master Era — works infinitely for NO.10000, NO.50000+)
  const cycle = (puzzleNo - 1000) % 50;
  const waveScale = Math.min(1, (puzzleNo - 1000) / 5000);
  const maxOp = Math.round(220 + waveScale * 250 + (cycle % 5) * 20);
  return {
    tier: 5,
    gridRows: 5,
    gridCols: 5,
    targetEquations: 8 + (puzzleNo % 3),
    targetBlankRatio: 0.62 + (cycle % 4) * 0.025,
    minBlanks: 10,
    maxBlanks: 16,
    ops: ['+', '-', '×', '÷'],
    minOperand: 100,
    maxOperand: Math.min(499, maxOp),
    minResult: 100,
    maxResult: 999,
    maxDivisor: 25,
    preferMultiDigitOperands: true,
    minSeedValue: 105,
    maxSeedValue: Math.min(450, maxOp),
  };
}

export function evaluateEquation(a: number, op: Operator, b: number): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      if (b === 0 || a % b !== 0) return null;
      return a / b;
  }
}

function getDivisors(n: number, minD: number, maxD: number): number[] {
  const divs: number[] = [];
  const limit = Math.min(maxD, Math.floor(n / 2));
  for (let d = Math.max(2, minD); d <= limit; d++) {
    if (n % d === 0) divs.push(d);
  }
  return divs;
}

function inBounds(val: number, minV: number, maxV: number): boolean {
  return Number.isInteger(val) && val >= minV && val <= maxV;
}

// Synthesize a valid triple (A, op, B, C) given 0, 1, or 2 known values at positions 0, 1, 2
function synthesizeTriple(
  rng: () => number,
  cfg: TierConfig,
  fixed: [number | null, number | null, number | null]
): { vals: [number, number, number]; op: Operator } | null {
  const [f0, f1, f2] = fixed;
  const ops = shuffle(rng, cfg.ops);
  const opMin = cfg.tier >= 4 ? Math.max(2, Math.floor(cfg.minOperand * 0.4)) : cfg.minOperand;
  const resMin = cfg.tier >= 5 ? 12 : cfg.minResult;

  // Case A: All 3 fixed -> check if an operator fits
  if (f0 !== null && f1 !== null && f2 !== null) {
    for (const op of ops) {
      if (evaluateEquation(f0, op, f1) === f2) {
        return { vals: [f0, f1, f2], op };
      }
    }
    return null;
  }

  // Case B: Exactly 2 fixed -> solve deterministically for the 3rd
  const knownCount = (f0 !== null ? 1 : 0) + (f1 !== null ? 1 : 0) + (f2 !== null ? 1 : 0);
  if (knownCount === 2) {
    for (const op of ops) {
      if (f0 !== null && f1 !== null) {
        const c = evaluateEquation(f0, op, f1);
        if (c !== null && inBounds(c, 1, cfg.maxResult)) {
          return { vals: [f0, f1, c], op };
        }
      } else if (f0 !== null && f2 !== null) {
        let b: number | null = null;
        if (op === '+') b = f2 - f0;
        else if (op === '-') b = f0 - f2;
        else if (op === '×') b = f0 > 0 && f2 % f0 === 0 ? f2 / f0 : null;
        else if (op === '÷') b = f2 > 0 && f0 % f2 === 0 ? f0 / f2 : null;
        if (b !== null && inBounds(b, 2, cfg.maxResult)) {
          if (op === '×' && b === 1) continue;
          if (op === '÷' && b === 1) continue;
          return { vals: [f0, b, f2], op };
        }
      } else if (f1 !== null && f2 !== null) {
        let a: number | null = null;
        if (op === '+') a = f2 - f1;
        else if (op === '-') a = f2 + f1;
        else if (op === '×') a = f1 > 0 && f2 % f1 === 0 ? f2 / f1 : null;
        else if (op === '÷') a = f1 * f2;
        if (a !== null && inBounds(a, 1, cfg.maxResult)) {
          if (op === '×' && a === 1) continue;
          return { vals: [a, f1, f2], op };
        }
      }
    }
    return null;
  }

  // Case C: 0 fixed (seed equation)
  if (knownCount === 0) {
    for (const op of ops) {
      if (op === '+') {
        const a = randInt(rng, cfg.minSeedValue, cfg.maxSeedValue);
        const b = randInt(rng, cfg.minOperand, Math.min(cfg.maxOperand, cfg.maxResult - a));
        const c = a + b;
        if (inBounds(c, resMin, cfg.maxResult)) return { vals: [a, b, c], op };
      } else if (op === '-') {
        const b = randInt(rng, cfg.minOperand, cfg.maxOperand);
        const c = randInt(rng, cfg.minOperand, Math.min(cfg.maxOperand, cfg.maxResult - b));
        const a = b + c;
        if (inBounds(a, resMin, cfg.maxResult)) return { vals: [a, b, c], op };
      } else if (op === '×') {
        const maxMulA = cfg.tier >= 5 ? 45 : cfg.tier === 4 ? 18 : 9;
        const maxMulB = cfg.tier >= 5 ? 25 : cfg.tier === 4 ? 12 : 9;
        const minMulA = cfg.tier >= 5 ? 12 : cfg.tier === 4 ? 4 : 2;
        const a = randInt(rng, minMulA, maxMulA);
        const b = randInt(rng, 2, Math.min(maxMulB, Math.floor(cfg.maxResult / a)));
        const c = a * b;
        if (b >= 2 && inBounds(c, resMin, cfg.maxResult)) return { vals: [a, b, c], op };
      } else if (op === '÷') {
        const b = randInt(rng, 2, cfg.maxDivisor);
        const minC = cfg.tier >= 5 ? 12 : cfg.tier === 4 ? 4 : 2;
        const maxC = Math.min(cfg.maxOperand, Math.floor(cfg.maxResult / b));
        if (maxC >= minC) {
          const c = randInt(rng, minC, maxC);
          const a = b * c;
          if (inBounds(a, resMin, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      }
    }
    return null;
  }

  // Case D: Exactly 1 fixed -> branch out creatively with tier-appropriate operands
  for (let attempt = 0; attempt < 16; attempt++) {
    const op = ops[attempt % ops.length];

    if (f0 !== null) {
      const a = f0;
      if (op === '+') {
        const maxB = Math.min(cfg.maxOperand, cfg.maxResult - a);
        const minB = Math.min(opMin, maxB);
        if (maxB >= 1 && maxB >= minB) {
          const b = randInt(rng, Math.max(1, minB), maxB);
          const c = a + b;
          if (inBounds(c, 2, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      } else if (op === '-') {
        const maxB = Math.min(cfg.maxOperand, a - 1);
        if (maxB >= 1) {
          const minB = Math.min(opMin, maxB);
          const b = randInt(rng, Math.max(1, minB), maxB);
          const c = a - b;
          if (inBounds(c, 1, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      } else if (op === '×') {
        const maxB = Math.min(cfg.tier <= 3 ? 9 : 19, Math.floor(cfg.maxResult / Math.max(1, a)));
        if (a >= 2 && maxB >= 2) {
          const b = randInt(rng, 2, maxB);
          const c = a * b;
          if (inBounds(c, 4, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      } else if (op === '÷') {
        const divs = getDivisors(a, 2, cfg.maxDivisor);
        if (divs.length > 0) {
          const b = divs[Math.floor(rng() * divs.length)];
          const c = a / b;
          if (inBounds(c, 2, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      }
    } else if (f1 !== null) {
      const b = f1;
      if (op === '+') {
        const maxA = Math.min(cfg.maxOperand, cfg.maxResult - b);
        if (maxA >= 1) {
          const minA = Math.min(opMin, maxA);
          const a = randInt(rng, Math.max(1, minA), maxA);
          const c = a + b;
          if (inBounds(c, 2, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      } else if (op === '-') {
        const maxC = Math.min(cfg.maxOperand, cfg.maxResult - b);
        if (maxC >= 1) {
          const minC = Math.min(opMin, maxC);
          const c = randInt(rng, Math.max(1, minC), maxC);
          const a = b + c;
          if (inBounds(a, 2, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      } else if (op === '×') {
        const maxA = Math.min(cfg.tier <= 3 ? 9 : 25, Math.floor(cfg.maxResult / Math.max(1, b)));
        if (b >= 2 && maxA >= 2) {
          const a = randInt(rng, 2, maxA);
          const c = a * b;
          if (inBounds(c, 4, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      } else if (op === '÷') {
        const maxC = Math.min(cfg.tier <= 3 ? 9 : 40, Math.floor(cfg.maxResult / Math.max(1, b)));
        if (b >= 2 && b <= cfg.maxDivisor && maxC >= 2) {
          const c = randInt(rng, 2, maxC);
          const a = b * c;
          if (inBounds(a, 4, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      }
    } else if (f2 !== null) {
      const c = f2;
      if (op === '+') {
        if (c >= 3) {
          const maxA = Math.min(cfg.maxOperand, c - 1);
          const minA = Math.max(1, c - cfg.maxOperand);
          if (maxA >= minA) {
            const a = randInt(rng, minA, maxA);
            const b = c - a;
            if (inBounds(b, 1, cfg.maxResult)) return { vals: [a, b, c], op };
          }
        }
      } else if (op === '-') {
        const maxB = Math.min(cfg.maxOperand, cfg.maxResult - c);
        if (maxB >= 1) {
          const minB = Math.min(opMin, maxB);
          const b = randInt(rng, Math.max(1, minB), maxB);
          const a = c + b;
          if (inBounds(a, 2, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      } else if (op === '×') {
        const divs = getDivisors(c, 2, cfg.tier <= 3 ? 9 : 30);
        if (divs.length > 0) {
          const a = divs[Math.floor(rng() * divs.length)];
          const b = c / a;
          if (inBounds(b, 2, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      } else if (op === '÷') {
        const maxB = Math.min(cfg.maxDivisor, Math.floor(cfg.maxResult / Math.max(1, c)));
        if (c >= 2 && maxB >= 2) {
          const b = randInt(rng, 2, maxB);
          const a = b * c;
          if (inBounds(a, 4, cfg.maxResult)) return { vals: [a, b, c], op };
        }
      }
    }
  }
  return null;
}

// Logical constraint-propagation solver: verifies 100% unique solvability with zero guessing
function canUniquelySolve(equations: Equation[], allNodeKeys: string[], blankSet: Set<string>): boolean {
  const known = new Set<string>();
  for (const k of allNodeKeys) {
    if (!blankSet.has(k)) known.add(k);
  }

  let progress = true;
  while (progress) {
    progress = false;
    for (const eq of equations) {
      const [c0, c1, c2] = eq.cells;
      const k0 = known.has(c0);
      const k1 = known.has(c1);
      const k2 = known.has(c2);
      const count = (k0 ? 1 : 0) + (k1 ? 1 : 0) + (k2 ? 1 : 0);
      if (count === 2) {
        if (!k0) known.add(c0);
        if (!k1) known.add(c1);
        if (!k2) known.add(c2);
        progress = true;
      }
    }
  }
  return known.size === allNodeKeys.length;
}

function edgeKey(dir: 'H' | 'V', r: number, c: number): string {
  return `${dir}:${r},${c}`;
}

function nodeKey(r: number, c: number): string {
  return `${r},${c}`;
}

export function generatePuzzle(puzzleNo: number): CrossMathPuzzle {
  const safeNo = Math.max(1, Math.floor(puzzleNo));
  const cfg = getTierConfig(safeNo);

  // Try up to 12 deterministic sub-seeds so we ALWAYS hit rich connected grids
  let bestPuzzle: CrossMathPuzzle | null = null;

  for (let retry = 0; retry < 12; retry++) {
    const rng = createRng(safeNo * 2654435761 + retry * 1013904223 + 17);
    const values = new Map<string, number>();
    const equations: Equation[] = [];
    const usedEdges = new Set<string>();

    // Place initial seed equation
    const initDir: 'H' | 'V' = rng() < 0.55 ? 'H' : 'V';
    const initR = initDir === 'H' ? randInt(rng, 0, cfg.gridRows - 1) : randInt(rng, 0, cfg.gridRows - 3);
    const initC = initDir === 'H' ? randInt(rng, 0, cfg.gridCols - 3) : randInt(rng, 0, cfg.gridCols - 1);
    const seedTriple = synthesizeTriple(rng, cfg, [null, null, null]);
    if (!seedTriple) continue;

    const addEq = (dir: 'H' | 'V', r: number, c: number, vals: [number, number, number], op: Operator) => {
      const cells: [string, string, string] =
        dir === 'H'
          ? [nodeKey(r, c), nodeKey(r, c + 1), nodeKey(r, c + 2)]
          : [nodeKey(r, c), nodeKey(r + 1, c), nodeKey(r + 2, c)];
      const e1 = dir === 'H' ? edgeKey('H', r, c) : edgeKey('V', r, c);
      const e2 = dir === 'H' ? edgeKey('H', r, c + 1) : edgeKey('V', r + 1, c);

      values.set(cells[0], vals[0]);
      values.set(cells[1], vals[1]);
      values.set(cells[2], vals[2]);
      usedEdges.add(e1);
      usedEdges.add(e2);
      equations.push({
        id: `eq-${equations.length}`,
        dir,
        cells,
        op,
      });
    };

    addEq(initDir, initR, initC, seedTriple.vals, seedTriple.op);

    // Grow connected cross-math equation web
    for (let step = 0; step < 90 && equations.length < cfg.targetEquations; step++) {
      // Collect candidate placements passing through at least 1 existing node
      const candidates: Array<{ dir: 'H' | 'V'; r: number; c: number; overlap: number }> = [];

      for (let r = 0; r < cfg.gridRows; r++) {
        for (let c = 0; c < cfg.gridCols; c++) {
          // Horizontal placement starting at (r, c)
          if (c + 2 < cfg.gridCols) {
            const e1 = edgeKey('H', r, c);
            const e2 = edgeKey('H', r, c + 1);
            if (!usedEdges.has(e1) && !usedEdges.has(e2)) {
              const overlap =
                (values.has(nodeKey(r, c)) ? 1 : 0) +
                (values.has(nodeKey(r, c + 1)) ? 1 : 0) +
                (values.has(nodeKey(r, c + 2)) ? 1 : 0);
              if (overlap >= 1 && overlap <= 2) {
                candidates.push({ dir: 'H', r, c, overlap });
              }
            }
          }
          // Vertical placement starting at (r, c)
          if (r + 2 < cfg.gridRows) {
            const e1 = edgeKey('V', r, c);
            const e2 = edgeKey('V', r + 1, c);
            if (!usedEdges.has(e1) && !usedEdges.has(e2)) {
              const overlap =
                (values.has(nodeKey(r, c)) ? 1 : 0) +
                (values.has(nodeKey(r + 1, c)) ? 1 : 0) +
                (values.has(nodeKey(r + 2, c)) ? 1 : 0);
              if (overlap >= 1 && overlap <= 2) {
                candidates.push({ dir: 'V', r, c, overlap });
              }
            }
          }
        }
      }

      if (candidates.length === 0) break;

      // Slightly prefer perpendicular intersections & loop closures for authentic cross-math feel
      const ordered = shuffle(rng, candidates).sort((a, b) => {
        const aScore = a.overlap === 2 ? 2 : 1;
        const bScore = b.overlap === 2 ? 2 : 1;
        return bScore - aScore + (rng() - 0.5) * 1.5;
      });

      let placed = false;
      for (const cand of ordered.slice(0, 14)) {
        const coords: [string, string, string] =
          cand.dir === 'H'
            ? [nodeKey(cand.r, cand.c), nodeKey(cand.r, cand.c + 1), nodeKey(cand.r, cand.c + 2)]
            : [nodeKey(cand.r, cand.c), nodeKey(cand.r + 1, cand.c), nodeKey(cand.r + 2, cand.c)];
        const fixed: [number | null, number | null, number | null] = [
          values.get(coords[0]) ?? null,
          values.get(coords[1]) ?? null,
          values.get(coords[2]) ?? null,
        ];
        const synth = synthesizeTriple(rng, cfg, fixed);
        if (synth) {
          addEq(cand.dir, cand.r, cand.c, synth.vals, synth.op);
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }

    if (equations.length < Math.max(2, cfg.targetEquations - 2)) {
      continue;
    }

    // Normalize coordinates tightly around (0, 0)
    let minR = Infinity;
    let maxR = -Infinity;
    let minC = Infinity;
    let maxC = -Infinity;
    for (const k of values.keys()) {
      const [r, c] = k.split(',').map(Number);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }

    const normRows = maxR - minR + 1;
    const normCols = maxC - minC + 1;
    const normNodes: Record<string, GridNode> = {};
    const remap = (k: string) => {
      const [r, c] = k.split(',').map(Number);
      return nodeKey(r - minR, c - minC);
    };

    for (const [k, val] of values.entries()) {
      const [r, c] = k.split(',').map(Number);
      const nr = r - minR;
      const nc = c - minC;
      const nk = nodeKey(nr, nc);
      normNodes[nk] = { key: nk, r: nr, c: nc, answer: val, isBlank: false };
    }

    const normEquations: Equation[] = equations.map((eq, idx) => ({
      id: `eq-${idx}`,
      dir: eq.dir,
      op: eq.op,
      cells: [remap(eq.cells[0]), remap(eq.cells[1]), remap(eq.cells[2])],
    }));

    // Build edge symbols map
    const edges: Record<string, EdgeSymbol> = {};
    for (const eq of normEquations) {
      const [r0, c0] = eq.cells[0].split(',').map(Number);
      const [r1, c1] = eq.cells[1].split(',').map(Number);
      const e1 = edgeKey(eq.dir, r0, c0);
      const e2 = edgeKey(eq.dir, r1, c1);
      edges[e1] = { key: e1, symbol: eq.op, equationId: eq.id };
      edges[e2] = { key: e2, symbol: '=', equationId: eq.id };
    }

    // Carve blanks with guaranteed unique logical solvability!
    const allKeys = Object.keys(normNodes);
    const desiredBlanks = Math.max(
      cfg.minBlanks,
      Math.min(cfg.maxBlanks, Math.round(allKeys.length * cfg.targetBlankRatio))
    );

    // Compute node degree (how many equations pass through each node)
    const degree = new Map<string, number>();
    for (const eq of normEquations) {
      for (const ck of eq.cells) {
        degree.set(ck, (degree.get(ck) ?? 0) + 1);
      }
    }

    // In Tier 3+ (NO.100+), bias slightly toward blanking intersection nodes for deeper deduction!
    const orderedKeys = shuffle(rng, allKeys).sort((a, b) => {
      if (cfg.tier >= 3) {
        return (degree.get(b) ?? 1) - (degree.get(a) ?? 1) + (rng() - 0.5) * 1.8;
      }
      return 0;
    });

    const blankSet = new Set<string>();
    for (const k of orderedKeys) {
      if (blankSet.size >= desiredBlanks) break;
      blankSet.add(k);
      if (!canUniquelySolve(normEquations, allKeys, blankSet)) {
        blankSet.delete(k);
      }
    }

    // Sort blanks in reading order (top-to-bottom, left-to-right) for intuitive keyboard/auto-advance
    const blankKeys = Array.from(blankSet).sort((a, b) => {
      const [ar, ac] = a.split(',').map(Number);
      const [br, bc] = b.split(',').map(Number);
      return ar !== br ? ar - br : ac - bc;
    });

    let maxAns = 9;
    for (const k of blankKeys) {
      normNodes[k].isBlank = true;
      if (normNodes[k].answer > maxAns) maxAns = normNodes[k].answer;
    }

    const candidatePuzzle: CrossMathPuzzle = {
      puzzleNo: safeNo,
      tier: cfg.tier,
      rows: normRows,
      cols: normCols,
      nodes: normNodes,
      equations: normEquations,
      edges,
      blankKeys,
      maxInputDigits: Math.max(2, String(maxAns).length + 1),
    };

    if (!bestPuzzle || candidatePuzzle.blankKeys.length > bestPuzzle.blankKeys.length) {
      bestPuzzle = candidatePuzzle;
    }

    if (
      candidatePuzzle.equations.length >= cfg.targetEquations - 1 &&
      candidatePuzzle.blankKeys.length >= cfg.minBlanks
    ) {
      return candidatePuzzle;
    }
  }

  // Fallback guaranteed simple valid puzzle (practically never reached)
  if (bestPuzzle) return bestPuzzle;
  return {
    puzzleNo: safeNo,
    tier: cfg.tier,
    rows: 3,
    cols: 3,
    nodes: {
      '0,0': { key: '0,0', r: 0, c: 0, answer: 4, isBlank: false },
      '0,1': { key: '0,1', r: 0, c: 1, answer: 5, isBlank: true },
      '0,2': { key: '0,2', r: 0, c: 2, answer: 9, isBlank: false },
      '1,0': { key: '1,0', r: 1, c: 0, answer: 3, isBlank: false },
      '2,0': { key: '2,0', r: 2, c: 0, answer: 7, isBlank: true },
    },
    equations: [
      { id: 'eq-0', dir: 'H', op: '+', cells: ['0,0', '0,1', '0,2'] },
      { id: 'eq-1', dir: 'V', op: '+', cells: ['0,0', '1,0', '2,0'] },
    ],
    edges: {
      'H:0,0': { key: 'H:0,0', symbol: '+', equationId: 'eq-0' },
      'H:0,1': { key: 'H:0,1', symbol: '=', equationId: 'eq-0' },
      'V:0,0': { key: 'V:0,0', symbol: '+', equationId: 'eq-1' },
      'V:1,0': { key: 'V:1,0', symbol: '=', equationId: 'eq-1' },
    },
    blankKeys: ['0,1', '2,0'],
    maxInputDigits: 2,
  };
}

// Compute which single blank cell is easiest to deduce right now (great for smart Hints!)
export function findNextLogicalHintCell(
  puzzle: CrossMathPuzzle,
  userValues: Record<string, string>,
  preferredKey: string | null
): string | null {
  // If user selected an unsolved blank cell, honor their selection first
  if (preferredKey && puzzle.nodes[preferredKey]?.isBlank) {
    const cur = userValues[preferredKey];
    if (cur !== String(puzzle.nodes[preferredKey].answer)) {
      return preferredKey;
    }
  }

  // Otherwise pick a blank cell that sits inside an equation with 2 already-correct/given cells
  const isSolved = (k: string) => {
    const n = puzzle.nodes[k];
    if (!n) return false;
    if (!n.isBlank) return true;
    return userValues[k] === String(n.answer);
  };

  for (const eq of puzzle.equations) {
    const unsolved = eq.cells.filter((k) => !isSolved(k));
    if (unsolved.length === 1) {
      return unsolved[0];
    }
  }

  // Fallback: first blank cell not yet matching the answer
  for (const k of puzzle.blankKeys) {
    if (!isSolved(k)) return k;
  }
  return null;
}
