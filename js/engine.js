/*
 * 체스 규칙 엔진
 * - 보드: 길이 64 배열, index = row * 8 + col (row 0 = 8번째 줄, 화면 맨 위)
 * - 말: 'wp', 'bk' 처럼 [색][종류] 두 글자 문자열 (w=하얀 팀, b=검은 팀)
 * - 상태는 불변 객체로 다루며 makeMove 는 항상 새 상태를 돌려준다.
 */
(function (root) {
  'use strict';

  const FILES = 'abcdefgh';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  const other = (c) => (c === 'w' ? 'b' : 'w');
  const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const sqName = (i) => FILES[i & 7] + (8 - (i >> 3));
  const sqIndex = (name) => (8 - parseInt(name[1], 10)) * 8 + FILES.indexOf(name[0]);

  function fromFEN(fen) {
    const [placement, turn = 'w', cast = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
    const board = new Array(64).fill(null);
    let i = 0;
    for (const ch of placement) {
      if (ch === '/') continue;
      if (/\d/.test(ch)) { i += parseInt(ch, 10); continue; }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      board[i++] = color + ch.toLowerCase();
    }
    return {
      board,
      turn,
      castling: { K: cast.includes('K'), Q: cast.includes('Q'), k: cast.includes('k'), q: cast.includes('q') },
      ep: ep === '-' ? -1 : sqIndex(ep),
      half: parseInt(half, 10) || 0,
      full: parseInt(full, 10) || 1,
    };
  }

  function toFEN(state) {
    let out = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = state.board[r * 8 + c];
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        out += p[0] === 'w' ? p[1].toUpperCase() : p[1];
      }
      if (empty) out += empty;
      if (r < 7) out += '/';
    }
    const cs = state.castling;
    const cast = (cs.K ? 'K' : '') + (cs.Q ? 'Q' : '') + (cs.k ? 'k' : '') + (cs.q ? 'q' : '') || '-';
    return `${out} ${state.turn} ${cast} ${state.ep < 0 ? '-' : sqName(state.ep)} ${state.half} ${state.full}`;
  }

  function isAttacked(board, sq, by) {
    const r = sq >> 3, c = sq & 7;
    // 폰: 하얀 폰은 위(row 감소)로 공격하므로 공격하는 하얀 폰은 한 줄 아래에 있다
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) {
      if (onBoard(pr, c + dc) && board[pr * 8 + c + dc] === by + 'p') return true;
    }
    for (const [dr, dc] of KNIGHT) {
      if (onBoard(r + dr, c + dc) && board[(r + dr) * 8 + c + dc] === by + 'n') return true;
    }
    for (const [dr, dc] of KING) {
      if (onBoard(r + dr, c + dc) && board[(r + dr) * 8 + c + dc] === by + 'k') return true;
    }
    const slide = (dirs, a, b) => {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (onBoard(rr, cc)) {
          const p = board[rr * 8 + cc];
          if (p) {
            if (p === by + a || p === by + b) return true;
            break;
          }
          rr += dr; cc += dc;
        }
      }
      return false;
    };
    return slide(DIAG, 'b', 'q') || slide(ORTH, 'r', 'q');
  }

  function inCheck(state, color) {
    const k = state.board.indexOf(color + 'k');
    return k >= 0 && isAttacked(state.board, k, other(color));
  }

  function pseudoMoves(state) {
    const { board, turn } = state;
    const enemy = other(turn);
    const moves = [];
    const add = (from, to, extra) => {
      moves.push(Object.assign({ from, to, piece: board[from], captured: board[to] }, extra));
    };

    for (let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if (!p || p[0] !== turn) continue;
      const r = sq >> 3, c = sq & 7, t = p[1];

      if (t === 'p') {
        const dir = turn === 'w' ? -1 : 1;
        const startRow = turn === 'w' ? 6 : 1;
        const lastRow = turn === 'w' ? 0 : 7;
        const r1 = r + dir;
        if (!onBoard(r1, c)) continue;
        const pushPawn = (to, extra) => {
          if (r1 === lastRow) {
            for (const promo of ['q', 'r', 'b', 'n']) add(sq, to, Object.assign({ promo }, extra));
          } else {
            add(sq, to, extra);
          }
        };
        const one = r1 * 8 + c;
        if (!board[one]) {
          pushPawn(one);
          const two = (r + 2 * dir) * 8 + c;
          if (r === startRow && !board[two]) add(sq, two, { flag: 'double' });
        }
        for (const dc of [-1, 1]) {
          if (!onBoard(r1, c + dc)) continue;
          const to = r1 * 8 + c + dc;
          if (board[to] && board[to][0] === enemy) {
            pushPawn(to);
          } else if (to === state.ep && !board[to]) {
            const capSq = r * 8 + c + dc;
            if (board[capSq] === enemy + 'p') add(sq, to, { flag: 'ep', captured: board[capSq], capSq });
          }
        }
        continue;
      }

      if (t === 'n' || t === 'k') {
        for (const [dr, dc] of t === 'n' ? KNIGHT : KING) {
          const rr = r + dr, cc = c + dc;
          if (!onBoard(rr, cc)) continue;
          const to = rr * 8 + cc;
          if (!board[to] || board[to][0] === enemy) add(sq, to);
        }
        if (t === 'k') addCastling(state, sq, add);
        continue;
      }

      const dirs = t === 'b' ? DIAG : t === 'r' ? ORTH : DIAG.concat(ORTH);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (onBoard(rr, cc)) {
          const to = rr * 8 + cc;
          if (board[to]) {
            if (board[to][0] === enemy) add(sq, to);
            break;
          }
          add(sq, to);
          rr += dr; cc += dc;
        }
      }
    }
    return moves;
  }

  function addCastling(state, sq, add) {
    const { board, turn, castling } = state;
    const home = turn === 'w' ? 60 : 4;
    if (sq !== home) return;
    const enemy = other(turn);
    const kSide = turn === 'w' ? castling.K : castling.k;
    const qSide = turn === 'w' ? castling.Q : castling.q;
    if (!kSide && !qSide) return;
    if (isAttacked(board, home, enemy)) return;
    if (kSide && board[home + 3] === turn + 'r' && !board[home + 1] && !board[home + 2] &&
        !isAttacked(board, home + 1, enemy) && !isAttacked(board, home + 2, enemy)) {
      add(home, home + 2, { flag: 'castleK' });
    }
    if (qSide && board[home - 4] === turn + 'r' && !board[home - 1] && !board[home - 2] && !board[home - 3] &&
        !isAttacked(board, home - 1, enemy) && !isAttacked(board, home - 2, enemy)) {
      add(home, home - 2, { flag: 'castleQ' });
    }
  }

  function makeMove(state, m) {
    const b = state.board.slice();
    const turn = state.turn;
    const piece = b[m.from];
    b[m.from] = null;
    if (m.flag === 'ep') b[m.capSq] = null;
    b[m.to] = m.promo ? turn + m.promo : piece;
    if (m.flag === 'castleK') { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = null; }
    if (m.flag === 'castleQ') { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = null; }

    const cs = Object.assign({}, state.castling);
    if (piece[1] === 'k') {
      if (turn === 'w') { cs.K = false; cs.Q = false; } else { cs.k = false; cs.q = false; }
    }
    for (const s of [m.from, m.to]) {
      if (s === 63) cs.K = false;
      if (s === 56) cs.Q = false;
      if (s === 7) cs.k = false;
      if (s === 0) cs.q = false;
    }

    return {
      board: b,
      turn: other(turn),
      castling: cs,
      ep: m.flag === 'double' ? (m.from + m.to) / 2 : -1,
      half: piece[1] === 'p' || m.captured ? 0 : state.half + 1,
      full: turn === 'b' ? state.full + 1 : state.full,
    };
  }

  function legalMoves(state) {
    return pseudoMoves(state).filter((m) => !inCheck(makeMove(state, m), state.turn));
  }

  function insufficientMaterial(board) {
    const rest = board.filter((p) => p && p[1] !== 'k');
    if (rest.length === 0) return true;
    return rest.length === 1 && (rest[0][1] === 'b' || rest[0][1] === 'n');
  }

  function positionKey(state) {
    const cs = state.castling;
    return state.board.map((p) => p || '.').join('') + state.turn +
      (cs.K ? 'K' : '') + (cs.Q ? 'Q' : '') + (cs.k ? 'k' : '') + (cs.q ? 'q' : '') + state.ep;
  }

  function gameStatus(state) {
    const moves = legalMoves(state);
    const check = inCheck(state, state.turn);
    if (moves.length === 0) {
      return check
        ? { over: true, result: 'checkmate', winner: other(state.turn), check }
        : { over: true, result: 'stalemate', check };
    }
    if (insufficientMaterial(state.board)) return { over: true, result: 'material', check };
    if (state.half >= 100) return { over: true, result: 'fifty', check };
    return { over: false, check };
  }

  function perft(state, depth) {
    if (depth === 0) return 1;
    const moves = legalMoves(state);
    if (depth === 1) return moves.length;
    let n = 0;
    for (const m of moves) n += perft(makeMove(state, m), depth - 1);
    return n;
  }

  const Chess = {
    START_FEN, FILES, other, sqName, sqIndex, fromFEN, toFEN,
    isAttacked, inCheck, pseudoMoves, legalMoves, makeMove,
    gameStatus, positionKey, perft,
    newGame: () => fromFEN(START_FEN),
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Chess;
  else root.Chess = Chess;
})(this);
