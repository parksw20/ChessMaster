/*
 * 마법 컴퓨터 (간단한 알파-베타 탐색)
 * level 1: 쉬움 — 1수 앞, 실수를 자주 함
 * level 2: 보통 — 2수 앞
 * level 3: 어려움 — 3수 앞 + 잡기 연장 탐색
 */
(function (root) {
  'use strict';
  const Chess = root.Chess || (typeof require !== 'undefined' ? require('./engine.js') : null);

  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE = 100000;

  // 하얀 팀 기준 위치 점수표 (row 0 = 8번째 줄). 검은 팀은 뒤집어서 사용한다.
  const PST = {
    p: [
      0, 0, 0, 0, 0, 0, 0, 0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0,
      5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0,
    ],
    n: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50,
    ],
    b: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20,
    ],
    r: [
      0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0,
    ],
    q: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20,
    ],
    k: [
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20,
      -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20,
      20, 30, 10, 0, 0, 10, 30, 20,
    ],
  };

  // 현재 차례인 쪽 기준 점수
  function evaluate(state) {
    let score = 0;
    const b = state.board;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      const t = p[1];
      const v = VALUE[t] + PST[t][p[0] === 'w' ? i : 63 - i];
      score += p[0] === 'w' ? v : -v;
    }
    return state.turn === 'w' ? score : -score;
  }

  function orderMoves(moves) {
    return moves.sort((a, b) => score(b) - score(a));
    function score(m) {
      let s = 0;
      if (m.captured) s += 10 * VALUE[m.captured[1]] - VALUE[m.piece[1]] + 1000;
      if (m.promo) s += VALUE[m.promo];
      return s;
    }
  }

  function quiesce(state, alpha, beta, depth) {
    const stand = evaluate(state);
    if (stand >= beta || depth <= 0) return stand;
    if (stand > alpha) alpha = stand;
    const caps = orderMoves(Chess.legalMoves(state).filter((m) => m.captured));
    for (const m of caps) {
      const s = -quiesce(Chess.makeMove(state, m), -beta, -alpha, depth - 1);
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  function negamax(state, depth, alpha, beta, ply, useQ) {
    const moves = Chess.legalMoves(state);
    if (moves.length === 0) return Chess.inCheck(state, state.turn) ? -MATE + ply : 0;
    if (depth === 0) return useQ ? quiesce(state, alpha, beta, 4) : evaluate(state);
    let best = -Infinity;
    for (const m of orderMoves(moves)) {
      const s = -negamax(Chess.makeMove(state, m), depth - 1, -beta, -alpha, ply + 1, useQ);
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return best;
  }

  function bestMove(state, level) {
    level = level || 2;
    const moves = orderMoves(Chess.legalMoves(state));
    if (moves.length === 0) return null;
    const depth = level === 1 ? 1 : level === 2 ? 2 : 3;
    const noise = level === 1 ? 120 : level === 2 ? 15 : 0;
    const useQ = level === 3;

    let best = null, bestScore = -Infinity;
    for (const m of moves) {
      let s = -negamax(Chess.makeMove(state, m), depth - 1, -Infinity, Infinity, 1, useQ);
      // 메이트는 절대 놓치지 않고, 그 외에는 레벨에 따라 조금씩 흔들어서 매번 다른 수를 둔다
      if (s < MATE - 1000) s += (Math.random() - 0.5) * noise;
      if (m.promo && m.promo !== 'q') s -= 50;
      if (s > bestScore) { bestScore = s; best = m; }
    }
    return best;
  }

  const AI = { bestMove, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  else root.AI = AI;
})(typeof window !== 'undefined' ? window : this);
