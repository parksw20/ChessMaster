/* 화면, 게임 진행, 튜토리얼 진행 */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const { NAME, TEAM, glyph, josa } = Duel;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const HINTS_PER_GAME = 5;

  const S = {
    mode: 'menu',            // 'menu' | 'game' | 'tutorial'
    state: Chess.newGame(),
    history: [],             // [{ state: 이전 상태, move, check }]
    selected: -1,
    legal: [],
    lastMove: null,
    hint: null,
    hintsLeft: 0,
    flipped: false,
    busy: false,
    over: null,
    vs: 'human',             // 'human' | 'ai'
    aiColor: 'b',
    aiLevel: 1,
    settings: { moves: true, duel: true, sound: true },
    lesson: 0,
    stars: new Set(),
    lessonDone: false,
  };

  /* ---------- 설정 저장 ---------- */
  const store = {
    load() {
      try {
        const v = JSON.parse(localStorage.getItem('wizard-chess-settings') || 'null');
        if (v) Object.assign(S.settings, v);
      } catch (e) { /* 저장소를 쓸 수 없으면 기본값 */ }
    },
    save() {
      try { localStorage.setItem('wizard-chess-settings', JSON.stringify(S.settings)); } catch (e) { /* 무시 */ }
    },
  };

  /* ---------- 보드 ---------- */
  const boardEl = $('#board');
  const squares = [];
  for (let v = 0; v < 64; v++) {
    const d = document.createElement('div');
    d.className = 'sq';
    d.setAttribute('role', 'gridcell');
    boardEl.appendChild(d);
    squares.push(d);
  }
  const viewToSq = (v) => (S.flipped ? 63 - v : v);
  const sqEl = (sq) => squares[S.flipped ? 63 - sq : sq];

  function lesson() { return LESSONS[S.lesson]; }

  function movableHint(sq, p) {
    // 튜토리얼에서 아직 아무것도 고르지 않았을 때, 움직일 수 있는 말을 반짝이게 한다
    if (S.mode !== 'tutorial' || S.selected >= 0 || !p || p[0] !== S.state.turn) return false;
    const L = lesson();
    if (L.goal.type === 'info' || S.lessonDone) return false;
    return !L.onlyTypes || L.onlyTypes.includes(p[1]);
  }

  function render(anim) {
    const st = S.state;
    const targets = new Map();
    if (S.settings.moves) for (const m of S.legal) targets.set(m.to, m);
    const checkSq = Chess.inCheck(st, st.turn) ? st.board.indexOf(st.turn + 'k') : -1;

    for (let v = 0; v < 64; v++) {
      const sq = viewToSq(v);
      const el = squares[v];
      const r = sq >> 3, c = sq & 7;
      const cls = ['sq', (r + c) % 2 === 0 ? 'light' : 'dark'];
      if (S.lastMove && (S.lastMove.from === sq || S.lastMove.to === sq)) cls.push('last');
      if (S.selected === sq) cls.push('selected');
      if (targets.has(sq)) cls.push(targets.get(sq).captured ? 'capture' : 'move');
      if (sq === checkSq) cls.push('check');
      if (S.hint && S.hint.from === sq) cls.push('hint-from');
      if (S.hint && S.hint.to === sq) cls.push('hint-to');
      if (S.mode === 'tutorial' && S.stars.has(sq)) cls.push('star');
      const p = st.board[sq];
      if (movableHint(sq, p)) cls.push('pulse');
      el.className = cls.join(' ');
      el.dataset.sq = sq;
      el.setAttribute('aria-label', Chess.sqName(sq) + (p ? ` ${TEAM[p[0]]} ${NAME[p[1]]}` : ''));

      const vr = v >> 3, vc = v & 7;
      let html = '';
      if (vc === 0) html += `<span class="coord rank">${8 - r}</span>`;
      if (vr === 7) html += `<span class="coord file">${Chess.FILES[c]}</span>`;
      if (p) html += `<span class="piece ${p[0]}" data-t="${p[1]}">${glyph(p)}</span>`;
      el.innerHTML = html;
    }

    if (anim) animateMove(anim);
    renderBars();
  }

  function animateMove(m) {
    const slide = (from, to) => {
      const pieceEl = sqEl(to).querySelector('.piece');
      if (!pieceEl) return;
      const a = sqEl(from).getBoundingClientRect();
      const b = sqEl(to).getBoundingClientRect();
      pieceEl.style.transition = 'none';
      pieceEl.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px)`;
      pieceEl.classList.add('moving');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        pieceEl.style.transition = '';
        pieceEl.style.transform = '';
        setTimeout(() => pieceEl.classList.remove('moving'), 350);
      }));
    };
    slide(m.from, m.to);
    if (m.flag === 'castleK') slide(m.from + 3, m.from + 1);
    if (m.flag === 'castleQ') slide(m.from - 4, m.from - 1);
    if (m.promo) sqEl(m.to).querySelector('.piece')?.classList.add('promoted');
  }

  /* ---------- 효과 ---------- */
  const fxLayer = $('#fxLayer');
  function squareCenter(sq) {
    const f = fxLayer.getBoundingClientRect();
    const r = sqEl(sq).getBoundingClientRect();
    return { x: r.left - f.left + r.width / 2, y: r.top - f.top + r.height / 2, w: r.width };
  }

  function shatterAt(sq, piece) {
    const { x, y, w } = squareCenter(sq);
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = `shard ${piece[0]}`;
      const ang = Math.random() * Math.PI * 2;
      const dist = w * (0.5 + Math.random());
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      s.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
      s.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
      s.style.setProperty('--size', `${w * (0.08 + Math.random() * 0.14)}px`);
      fxLayer.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }

  function sparkleAt(sq, emoji) {
    const { x, y } = squareCenter(sq);
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('span');
      s.className = 'sparkle';
      s.textContent = emoji;
      const ang = (i / 8) * Math.PI * 2;
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty('--dx', `${Math.cos(ang) * 50}px`);
      s.style.setProperty('--dy', `${Math.sin(ang) * 50}px`);
      fxLayer.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const items = ['✨', '⭐', '🎉', '🪄', '💫', '🏆'];
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('span');
      s.textContent = items[i % items.length];
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDelay = `${Math.random() * 0.8}s`;
      s.style.fontSize = `${16 + Math.random() * 20}px`;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3500);
  }

  let toastTimer = null;
  function toast(msg, ms = 2400) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  /* ---------- 입력 ---------- */
  function humanCanMove() {
    if (S.busy) return false;
    if (S.mode === 'tutorial') return !(S.lessonDone && lesson().goal.type !== 'info');
    if (S.mode === 'game') return !S.over && !(S.vs === 'ai' && S.state.turn === S.aiColor);
    return false;
  }

  boardEl.addEventListener('click', (e) => {
    const el = e.target.closest('.sq');
    if (!el) return;
    Sound.unlock();
    onSquare(parseInt(el.dataset.sq, 10));
  });

  async function onSquare(sq) {
    if (!humanCanMove()) {
      if (S.mode === 'game' && S.vs === 'ai' && S.state.turn === S.aiColor && !S.over) toast('🤖 마법 컴퓨터 차례예요. 잠깐만 기다려요!');
      return;
    }
    const p = S.state.board[sq];
    if (S.selected >= 0) {
      const cands = S.legal.filter((m) => m.to === sq);
      if (cands.length) {
        const m = cands.length > 1 ? await askPromotion(cands) : cands[0];
        if (m) playMove(m);
        return;
      }
      if (sq === S.selected) { deselect(); return; }
    }
    if (p && p[0] === S.state.turn) select(sq);
    else {
      if (p && S.selected < 0) toast(`지금은 ${TEAM[S.state.turn]} 팀 차례예요!`);
      deselect();
    }
  }

  function select(sq) {
    const p = S.state.board[sq];
    const L = lesson();
    if (S.mode === 'tutorial' && L.onlyTypes && !L.onlyTypes.includes(p[1])) {
      toast(`이번에는 ${L.onlyTypes.map((t) => NAME[t]).join(', ')}만 움직여요!`);
      return;
    }
    S.selected = sq;
    S.legal = Chess.legalMoves(S.state).filter((m) => m.from === sq);
    if (S.hint && S.hint.from !== sq) S.hint = null;
    Sound.select();
    if (!S.legal.length) {
      Sound.oops();
      toast(Chess.inCheck(S.state, S.state.turn)
        ? '🚨 킹이 공격받고 있어요! 킹을 지킬 수 있는 말만 움직일 수 있어요.'
        : `이 ${josa(NAME[p[1]], '은', '는')} 지금 움직일 수 없어요. 다른 말을 골라 보세요.`);
    }
    render();
  }

  function deselect() {
    S.selected = -1;
    S.legal = [];
    render();
  }

  function askPromotion(cands) {
    return new Promise((resolve) => {
      const ov = $('#promo');
      const box = ov.querySelector('.promo-choices');
      const color = cands[0].piece[0];
      box.innerHTML = '';
      for (const t of ['q', 'r', 'b', 'n']) {
        const b = document.createElement('button');
        b.className = 'promo-btn';
        b.innerHTML = `<span class="piece ${color}">${glyph(color + t)}</span><span>${NAME[t]}</span>`;
        b.onclick = () => { ov.classList.add('hidden'); resolve(cands.find((m) => m.promo === t)); };
        box.appendChild(b);
      }
      ov.classList.remove('hidden');
    });
  }

  /* ---------- 수 두기 ---------- */
  async function playMove(m) {
    S.busy = true;
    S.selected = -1;
    S.legal = [];
    S.hint = null;
    const before = S.state;
    const next = Chess.makeMove(before, m);

    if (m.captured && S.settings.duel) {
      render();
      sqEl(m.from).classList.add('attacking');
      sqEl(m.flag === 'ep' ? m.capSq : m.to).classList.add('defending');
      await wait(250);
      await Duel.play(m.piece, m.captured);
    }

    const check = Chess.inCheck(next, next.turn);
    S.history.push({ state: before, move: m, check });
    S.state = next;
    S.lastMove = m;
    render(m);

    if (m.captured) {
      setTimeout(() => shatterAt(m.flag === 'ep' ? m.capSq : m.to, m.captured), 120);
      if (!S.settings.duel) Sound.crumble();
      else Sound.move();
    } else {
      Sound.move();
    }
    if (m.promo) { Sound.magic(); setTimeout(() => sparkleAt(m.to, '✨'), 300); }
    if (m.flag === 'castleK' || m.flag === 'castleQ') setTimeout(() => sparkleAt(m.to, '🏰'), 300);

    await wait(380);
    S.busy = false;
    if (S.mode === 'tutorial') afterTutorialMove(m, next, check);
    else afterGameMove(check);
  }

  /* ---------- 게임 ---------- */
  function startGame(vs, opts = {}) {
    closeAll();
    S.mode = 'game';
    S.vs = vs;
    S.aiLevel = opts.level || S.aiLevel;
    S.aiColor = vs === 'ai' ? (opts.humanColor === 'b' ? 'w' : 'b') : 'b';
    S.flipped = vs === 'ai' && S.aiColor === 'w';
    S.state = Chess.newGame();
    S.history = [];
    S.selected = -1; S.legal = []; S.lastMove = null; S.hint = null; S.over = null; S.busy = false;
    S.hintsLeft = HINTS_PER_GAME;
    $('#gamePanel').hidden = false;
    $('#tutorialPanel').hidden = true;
    render();
    updateGamePanel();
    if (vs === 'ai' && S.aiColor === 'w') aiTurn();
    else toast(vs === 'ai' ? '⚪ 내가 먼저 둬요! 말을 눌러 보세요.' : '⚪ 하얀 팀부터 시작해요!');
  }

  function repetition() {
    const key = Chess.positionKey(S.state);
    let n = 1;
    for (const h of S.history) if (Chess.positionKey(h.state) === key) n++;
    return n >= 3;
  }

  function afterGameMove(check) {
    let status = Chess.gameStatus(S.state);
    if (!status.over && repetition()) status = { over: true, result: 'repetition' };
    if (status.over) {
      S.over = status;
      updateGamePanel();
      setTimeout(() => showResult(status), 500);
      return;
    }
    if (check) {
      Sound.check();
      toast(`🚨 체크! ${TEAM[S.state.turn]} 킹이 위험해요! 킹을 지켜야 해요.`);
    }
    updateGamePanel();
    if (S.vs === 'ai' && S.state.turn === S.aiColor) aiTurn();
  }

  function aiTurn() {
    S.busy = true;
    updateGamePanel();
    const token = S.history.length;
    setTimeout(() => {
      if (S.mode !== 'game' || S.history.length !== token || S.over) { S.busy = false; return; }
      const m = AI.bestMove(S.state, S.aiLevel);
      if (m) playMove(m); else S.busy = false;
    }, 650);
  }

  function undo() {
    if (S.mode !== 'game' || S.busy || !S.history.length) return;
    const pop = () => {
      const h = S.history.pop();
      S.state = h.state;
    };
    pop();
    if (S.vs === 'ai' && S.state.turn === S.aiColor && S.history.length) pop();
    S.lastMove = S.history.length ? S.history[S.history.length - 1].move : null;
    S.over = null;
    S.selected = -1; S.legal = []; S.hint = null;
    Sound.magic();
    toast('↩️ 시간을 되돌렸어요!');
    render();
    updateGamePanel();
    if (S.vs === 'ai' && S.state.turn === S.aiColor) aiTurn();
  }

  function hint() {
    if (!humanCanMove()) return;
    if (S.hintsLeft <= 0) {
      Sound.oops();
      toast('💡 이번 판의 힌트를 모두 썼어요. 이제 스스로 생각해 봐요!');
      return;
    }
    // 이미 보여 준 힌트를 다시 누르면 횟수를 쓰지 않고 한 번 더 알려 준다
    const m = S.hint
      ? Chess.legalMoves(S.state).find((x) => x.from === S.hint.from && x.to === S.hint.to)
      : AI.bestMove(S.state, 2);
    if (!m) return;
    if (!S.hint) S.hintsLeft--;
    updateGamePanel();
    S.hint = { from: m.from, to: m.to };
    S.selected = m.from;
    S.legal = Chess.legalMoves(S.state).filter((x) => x.from === m.from);
    Sound.select();
    toast(`💡 ${josa(NAME[m.piece[1]], '을', '를')} ${Chess.sqName(m.to)} 칸으로 옮겨 보면 어때요? (남은 힌트 ${S.hintsLeft}번)`, 3500);
    render();
  }

  function describeMove(h) {
    const m = h.move;
    const who = `${TEAM[m.piece[0]]} ${NAME[m.piece[1]]}`;
    let text = `${who} ${Chess.sqName(m.from)} → ${Chess.sqName(m.to)}`;
    if (m.flag === 'castleK' || m.flag === 'castleQ') text = `${TEAM[m.piece[0]]} 킹 🏰 캐슬링 (${Chess.sqName(m.to)})`;
    if (m.captured) text += ` ⚔️ ${NAME[m.captured[1]]} 잡음`;
    if (m.flag === 'ep') text += ' (앙파상)';
    if (m.promo) text += ` ✨ ${josa(NAME[m.promo], '으로', '로')} 변신`;
    if (h.check) text += ' 🚨체크';
    return text;
  }

  function updateGamePanel() {
    if (S.mode !== 'game') return;
    const turn = S.state.turn;
    const statusEl = $('#status');
    statusEl.className = `status-box ${turn}`;
    let turnText, msg = '';
    if (S.over) {
      turnText = resultTitle(S.over);
      msg = '✨ 새 게임을 눌러 다시 시작해요.';
    } else if (S.vs === 'ai' && turn === S.aiColor) {
      turnText = '🤖 마법 컴퓨터 차례';
      msg = '<span class="thinking">생각 중<i>.</i><i>.</i><i>.</i></span>';
    } else {
      turnText = S.vs === 'ai' ? `🙂 내 차례 (${TEAM[turn]} 팀)` : `${turn === 'w' ? '⚪' : '⚫'} ${TEAM[turn]} 팀 차례`;
      msg = Chess.inCheck(S.state, turn) ? '🚨 체크! 킹을 지켜야 해요.' : '움직일 말을 눌러 보세요.';
    }
    statusEl.querySelector('.status-turn').textContent = turnText;
    statusEl.querySelector('.status-msg').innerHTML = msg;

    const log = $('#moveLog');
    log.innerHTML = '';
    S.history.forEach((h, i) => {
      const li = document.createElement('li');
      li.className = h.move.piece[0];
      li.innerHTML = `<span class="num">${i + 1}</span><span class="piece ${h.move.piece[0]}">${glyph(h.move.piece)}</span> ${describeMove(h)}`;
      log.appendChild(li);
    });
    log.scrollTop = log.scrollHeight;
    $('#btnUndo').disabled = !S.history.length;
    const hintBtn = $('#btnHint');
    hintBtn.textContent = `💡 힌트 ${S.hintsLeft}/${HINTS_PER_GAME}`;
    hintBtn.classList.toggle('used-up', S.hintsLeft <= 0);
    hintBtn.title = S.hintsLeft > 0 ? `이번 판에 힌트를 ${S.hintsLeft}번 더 쓸 수 있어요` : '이번 판의 힌트를 모두 썼어요';
  }

  function renderBars() {
    const bottom = S.flipped ? 'b' : 'w';
    const top = bottom === 'w' ? 'b' : 'w';
    const caps = { w: [], b: [] };
    for (const h of S.history) if (h.move.captured) caps[h.move.piece[0]].push(h.move.captured);
    const val = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const score = (c) => caps[c].reduce((s, p) => s + val[p[1]], 0);
    const order = 'qrbnp';

    for (const [id, color] of [['#barTop', top], ['#barBottom', bottom]]) {
      const bar = $(id);
      bar.querySelector('.team-chip').className = `team-chip ${color}`;
      let name = `${TEAM[color]} 팀`;
      if (S.mode === 'game' && S.vs === 'ai') name = color === S.aiColor ? `🤖 마법 컴퓨터 (${TEAM[color]})` : `🙂 나 (${TEAM[color]})`;
      if (S.mode === 'tutorial') name = color === 'w' ? '🙂 나 (하얀 팀)' : '검은 팀';
      bar.querySelector('.bar-name').textContent = name;
      bar.classList.toggle('active', S.mode !== 'menu' && !S.over && S.state.turn === color);
      const list = caps[color].slice().sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]));
      const diff = score(color) - score(color === 'w' ? 'b' : 'w');
      bar.querySelector('.captured').innerHTML =
        list.map((p) => `<span class="piece ${p[0]}">${glyph(p)}</span>`).join('') +
        (diff > 0 ? `<span class="adv">+${diff}</span>` : '');
    }
  }

  function resultTitle(st) {
    if (st.result === 'checkmate') {
      if (S.vs === 'ai') return st.winner === S.aiColor ? '🤖 마법 컴퓨터 승리' : '🏆 내가 이겼어요!';
      return `🏆 ${TEAM[st.winner]} 팀 승리!`;
    }
    return '🤝 무승부';
  }

  function showResult(st) {
    const ov = $('#result');
    const win = st.result === 'checkmate';
    const humanLost = win && S.vs === 'ai' && st.winner === S.aiColor;
    ov.querySelector('.result-emoji').textContent = !win ? '🤝' : humanLost ? '🐉' : '🏆';
    ov.querySelector('.result-title').textContent = win ? '체크메이트!' : '무승부';
    const reasons = {
      stalemate: '둘 수 있는 수가 하나도 없지만 체크는 아니라서 비겼어요. (스테일메이트)',
      material: '양쪽 모두 체크메이트를 만들 수 있는 말이 남지 않았어요.',
      fifty: '50번 동안 잡기도, 폰 움직임도 없어서 비겼어요.',
      repetition: '같은 모양이 세 번 나와서 비겼어요.',
    };
    let text = reasons[st.result] || '';
    if (win) {
      text = S.vs === 'ai'
        ? (humanLost ? '아쉬워요! 마법 컴퓨터가 이겼어요. 💡 힌트를 쓰면서 다시 도전해 볼까요?' : '대단해요! 마법 컴퓨터를 물리쳤어요! 🎉')
        : `${TEAM[st.winner]} 팀이 상대 킹을 가뒀어요! 멋진 게임이었어요. 🎉`;
    }
    ov.querySelector('.result-text').textContent = text;
    ov.classList.remove('hidden');
    if (humanLost) Sound.oops(); else { Sound.win(); confetti(); }
  }

  /* ---------- 튜토리얼 ---------- */
  function startTutorial(i = 0) {
    closeAll();
    S.mode = 'tutorial';
    S.vs = 'human';
    S.over = null;
    $('#gamePanel').hidden = true;
    $('#tutorialPanel').hidden = false;
    loadLesson(i);
  }

  function loadLesson(i, keepFeedback) {
    S.lesson = Math.max(0, Math.min(LESSONS.length - 1, i));
    const L = lesson();
    S.state = Chess.fromFEN(L.fen);
    S.history = [];
    S.selected = -1; S.legal = []; S.lastMove = null; S.hint = null; S.busy = false; S.flipped = false;
    S.stars = new Set((L.goal.squares || []).map(Chess.sqIndex));
    S.lessonDone = L.goal.type === 'info';
    renderTutorialPanel(keepFeedback);
    render();
  }

  function renderTutorialPanel(keepFeedback) {
    const L = lesson();
    const p = $('#tutorialPanel');
    p.querySelector('.tut-bar').style.width = `${((S.lesson + 1) / LESSONS.length) * 100}%`;
    p.querySelector('.tut-step').textContent = `${S.lesson + 1} / ${LESSONS.length} 단계`;
    p.querySelector('.tut-title').textContent = L.title;
    p.querySelector('.tut-text').innerHTML = L.text;
    const cards = p.querySelector('.tut-cards');
    cards.innerHTML = '';
    if (L.cards) {
      for (const t of ['k', 'q', 'r', 'b', 'n', 'p']) {
        const info = PIECE_INFO[t];
        const c = document.createElement('div');
        c.className = 'piece-card';
        c.innerHTML = `<span class="piece w">${glyph('w' + t)}</span>
          <b>${info.name}</b><small>(${info.alias}) × ${info.count}</small><em>${info.move}</em>`;
        cards.appendChild(c);
      }
    }
    const task = p.querySelector('.tut-task');
    task.textContent = L.task ? `🎯 ${L.task}` : '';
    task.hidden = !L.task;
    if (!keepFeedback) setFeedback('', '');
    $('#tutPrev').disabled = S.lesson === 0;
    const next = $('#tutNext');
    next.textContent = L.final ? '🎮 게임하러 가기!' : '다음 ▶';
    next.classList.toggle('glow', S.lessonDone);
  }

  function setFeedback(msg, kind) {
    const f = $('#tutorialPanel .tut-feedback');
    f.textContent = msg;
    f.className = `tut-feedback ${kind}`;
  }

  function lessonComplete(msg) {
    S.lessonDone = true;
    setFeedback(`🎉 ${msg}`, 'good');
    $('#tutNext').classList.add('glow');
    Sound.win();
    confetti();
    render();
  }

  function lessonRetry(msg) {
    setFeedback(`🤔 ${msg}`, 'bad');
    Sound.oops();
    S.busy = true;
    setTimeout(() => { if (S.mode === 'tutorial') loadLesson(S.lesson, true); }, 1800);
  }

  function passTurn() {
    // 튜토리얼에서는 검은 팀이 움직이지 않으므로 다시 하얀 팀 차례로 돌린다
    S.state = Object.assign({}, S.state, { turn: 'w', ep: -1 });
  }

  function afterTutorialMove(m, next, check) {
    const g = lesson().goal;
    switch (g.type) {
      case 'info':
        if (check) Sound.check();
        break;
      case 'stars': {
        passTurn();
        if (S.stars.delete(m.to)) { Sound.star(); sparkleAt(m.to, '⭐'); }
        if (!S.stars.size) lessonComplete('별을 모두 모았어요! 최고예요!');
        else setFeedback(`⭐ 남은 별: ${S.stars.size}개`, 'info');
        break;
      }
      case 'captureAll': {
        passTurn();
        const left = S.state.board.filter((p) => p && p[0] === 'b').length;
        if (!left) lessonComplete('검은 말을 모두 물리쳤어요! 용감한 마법사!');
        else setFeedback(`⚔️ 남은 검은 말: ${left}개`, 'info');
        break;
      }
      case 'check':
        if (check) { Sound.check(); lessonComplete('체크! 검은 킹이 깜짝 놀랐어요!'); }
        else lessonRetry('아직 체크가 아니에요. 룩이 검은 킹과 같은 줄(가로나 세로)에 서도록 해 보세요!');
        break;
      case 'mate': {
        const st = Chess.gameStatus(next);
        if (st.result === 'checkmate') lessonComplete('체크메이트! 검은 킹이 꼼짝 못 해요. 승리!');
        else lessonRetry(check ? '체크는 맞지만 킹이 도망갈 수 있어요. 다시 해 볼까요?' : '아직 체크메이트가 아니에요. 킹의 뒷줄을 노려 보세요!');
        break;
      }
      case 'castle':
        if (m.flag === 'castleK' || m.flag === 'castleQ') lessonComplete('캐슬링 성공! 킹이 안전한 성 안으로 쏙 들어갔어요.');
        else lessonRetry('캐슬링은 킹을 룩 쪽으로 두 칸 움직이는 거예요. 킹을 눌러 보세요!');
        break;
      case 'promote':
        if (m.promo) lessonComplete(`짜잔! 폰이 ${josa(NAME[m.promo], '으로', '로')} 변신했어요!`);
        else lessonRetry('폰을 맨 끝 줄까지 보내 보세요!');
        break;
      case 'ep':
        if (m.flag === 'ep') lessonComplete('앙파상 성공! 이제 체스 고수예요.');
        else lessonRetry('하얀 폰을 눌러서 검은 폰 뒤쪽 대각선 칸(d6)으로 가 보세요!');
        break;
    }
    render();
  }

  /* ---------- 메뉴 / 오버레이 ---------- */
  function closeAll() {
    for (const id of ['#menu', '#result', '#promo', '#confirm']) $(id).classList.add('hidden');
  }

  function showMenu() {
    closeAll();
    S.mode = 'menu';
    S.state = Chess.newGame();
    S.history = []; S.selected = -1; S.legal = []; S.lastMove = null; S.hint = null; S.over = null; S.flipped = false;
    render();
    $('#menu').classList.remove('hidden');
  }

  function segValue(id) { return $(`${id} .on`).dataset.v; }
  for (const id of ['#aiLevel', '#aiColor']) {
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      $(id).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      Sound.unlock(); Sound.select();
    });
  }

  $('#menuTutorial').onclick = () => { Sound.unlock(); startTutorial(0); };
  $('#menuTwo').onclick = () => { Sound.unlock(); startGame('human'); };
  $('#menuAI').onclick = () => {
    Sound.unlock();
    startGame('ai', { level: parseInt(segValue('#aiLevel'), 10), humanColor: segValue('#aiColor') });
  };
  $('#btnHome').onclick = async () => {
    if (gameInProgress() && !(await askConfirm('지금 게임을 그만두고 처음 화면으로 갈까요?'))) return;
    showMenu();
  };
  function askConfirm(msg) {
    return new Promise((resolve) => {
      const ov = $('#confirm');
      ov.querySelector('.confirm-text').textContent = msg;
      ov.classList.remove('hidden');
      const done = (v) => { ov.classList.add('hidden'); resolve(v); };
      $('#confirmYes').onclick = () => done(true);
      $('#confirmNo').onclick = () => done(false);
    });
  }
  const gameInProgress = () => S.mode === 'game' && S.history.length && !S.over;

  $('#btnNew').onclick = async () => {
    if (gameInProgress() && !(await askConfirm('지금 게임을 그만두고 새로 시작할까요?'))) return;
    showMenu();
  };
  $('#btnUndo').onclick = undo;
  $('#btnHint').onclick = hint;
  $('#btnToTutorial').onclick = async () => {
    if (gameInProgress() && !(await askConfirm('지금 게임을 그만두고 튜토리얼로 갈까요?'))) return;
    startTutorial(0);
  };

  $('#tutPrev').onclick = () => loadLesson(S.lesson - 1);
  $('#tutReset').onclick = () => loadLesson(S.lesson);
  $('#tutNext').onclick = () => {
    if (lesson().final) { showMenu(); return; }
    loadLesson(S.lesson + 1);
  };
  $('#tutExit').onclick = showMenu;

  $('#resAgain').onclick = () => startGame(S.vs, { level: S.aiLevel, humanColor: S.aiColor === 'w' ? 'b' : 'w' });
  $('#resView').onclick = () => $('#result').classList.add('hidden');
  $('#resHome').onclick = showMenu;

  const opts = { optMoves: 'moves', optDuel: 'duel', optSound: 'sound' };
  for (const [id, key] of Object.entries(opts)) {
    const input = document.getElementById(id);
    input.addEventListener('change', () => {
      S.settings[key] = input.checked;
      Sound.setEnabled(S.settings.sound);
      store.save();
      render();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.selected >= 0) deselect();
  });

  window.addEventListener('resize', () => render());

  /* ---------- 시작 ---------- */
  store.load();
  for (const [id, key] of Object.entries(opts)) document.getElementById(id).checked = S.settings[key];
  Sound.setEnabled(S.settings.sound);
  showMenu();
})();
