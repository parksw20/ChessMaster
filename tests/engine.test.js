// 실행: node tests/engine.test.js
const assert = require('assert');
const Chess = require('../js/engine.js');
const AI = require('../js/ai.js');

const cases = [
  // [이름, FEN, 깊이, 기대값] — 표준 perft 수치
  ['시작 위치', Chess.START_FEN, 3, 8902],
  ['Kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 2, 2039],
  ['Kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['Position 3 (앙파상/핀)', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 4, 43238],
  ['Position 4 (프로모션)', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3, 9467],
  ['Position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
];

for (const [name, fen, depth, expected] of cases) {
  const t = Date.now();
  const got = Chess.perft(Chess.fromFEN(fen), depth);
  assert.strictEqual(got, expected, `${name} perft(${depth}) = ${got}, 기대값 ${expected}`);
  console.log(`✓ ${name} perft(${depth}) = ${got} (${Date.now() - t}ms)`);
}

// FEN 왕복
assert.strictEqual(Chess.toFEN(Chess.fromFEN(Chess.START_FEN)), Chess.START_FEN);
console.log('✓ FEN 왕복');

// 게임 상태
const mate = Chess.fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
const ra8 = Chess.legalMoves(mate).find((m) => Chess.sqName(m.from) === 'a1' && Chess.sqName(m.to) === 'a8');
const after = Chess.makeMove(mate, ra8);
assert.deepStrictEqual(Chess.gameStatus(after).result, 'checkmate');
console.log('✓ 백랭크 체크메이트 판정');

const stale = Chess.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
assert.strictEqual(Chess.gameStatus(stale).result, 'stalemate');
console.log('✓ 스테일메이트 판정');

// AI: 한 수 메이트를 찾아야 한다
for (const level of [2, 3]) {
  const best = AI.bestMove(mate, level);
  assert.strictEqual(Chess.sqName(best.to), 'a8', `AI 레벨 ${level}이 메이트를 놓침`);
}
console.log('✓ AI 한 수 메이트 탐색');

// AI: 공짜 퀸은 잡아야 한다
const freeQueen = Chess.fromFEN('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
assert.strictEqual(Chess.sqName(AI.bestMove(freeQueen, 2).to), 'd5');
console.log('✓ AI 공짜 퀸 잡기');

// 튜토리얼 FEN 검증
global.window = global;
require('../js/tutorial-lessons.js');
for (const lesson of global.LESSONS) {
  if (!lesson.fen) continue;
  const s = Chess.fromFEN(lesson.fen);
  assert.strictEqual(Chess.toFEN(s).split(' ')[0], lesson.fen.split(' ')[0], `튜토리얼 FEN 오류: ${lesson.title}`);
  if (lesson.goal && lesson.goal.type !== 'info') {
    assert.ok(Chess.legalMoves(s).length > 0, `튜토리얼에 둘 수 있는 수가 없음: ${lesson.title}`);
  }
}
console.log(`✓ 튜토리얼 ${global.LESSONS.length}단계 FEN 검증`);

console.log('\n모든 테스트 통과!');
