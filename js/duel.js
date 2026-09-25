/* 결투 장면 — 말이 잡힐 때 두 말이 맞서 싸우고 잡힌 말이 부서지는 연출 */
(function (root) {
  'use strict';

  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const NAME = { k: '킹', q: '퀸', r: '룩', b: '비숍', n: '나이트', p: '폰' };
  const TEAM = { w: '하얀', b: '검은' };
  const ATTACK = {
    p: { how: '창으로 힘껏 찔러서', fx: '🗡️' },
    n: { how: '말발굽으로 뻥 걷어차서', fx: '🐎' },
    b: { how: '지팡이 마법을 휘둘러서', fx: '🪄' },
    r: { how: '성벽처럼 쿵쾅 돌진해서', fx: '🏰' },
    q: { how: '번개 마법을 날려서', fx: '⚡' },
    k: { how: '왕의 검을 휘둘러서', fx: '👑' },
  };

  // 받침 유무로 조사 선택 (이/가, 을/를)
  function josa(word, withFinal, withoutFinal) {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
    return word + (hasFinal ? withFinal : withoutFinal);
  }

  const glyph = (p) => GLYPH[p[1]] + '︎';

  function describe(attacker, defender) {
    const a = NAME[attacker[1]], d = NAME[defender[1]];
    return `${TEAM[attacker[0]]} ${josa(a, '이', '가')} ${ATTACK[attacker[1]].how} ${TEAM[defender[0]]} ${josa(d, '을', '를')} 부숴 버렸어요!`;
  }

  let el = null;
  function build() {
    el = document.getElementById('duel');
    el.addEventListener('click', () => { if (el._skip) el._skip(); });
  }

  function play(attacker, defender) {
    if (!el) build();
    return new Promise((resolve) => {
      const timers = [];
      const at = (ms, fn) => timers.push(setTimeout(fn, ms));
      const atkEl = el.querySelector('.fighter.attacker');
      const defEl = el.querySelector('.fighter.defender');
      const shards = el.querySelector('.shards');
      const text = el.querySelector('.duel-text');
      const fx = el.querySelector('.duel-fx');

      el.className = 'overlay duel';
      atkEl.className = `fighter attacker ${attacker[0]}`;
      defEl.className = `fighter defender ${defender[0]}`;
      atkEl.querySelector('.glyph').textContent = glyph(attacker);
      defEl.querySelector('.glyph').textContent = glyph(defender);
      atkEl.querySelector('.label').textContent = `${TEAM[attacker[0]]} ${NAME[attacker[1]]}`;
      defEl.querySelector('.label').textContent = `${TEAM[defender[0]]} ${NAME[defender[1]]}`;
      fx.textContent = ATTACK[attacker[1]].fx;
      text.textContent = '';
      shards.innerHTML = '';

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        el._skip = null;
        el.classList.add('closing');
        setTimeout(() => { el.className = 'overlay duel hidden'; resolve(); }, 250);
      };
      el._skip = finish;

      requestAnimationFrame(() => el.classList.add('enter'));
      at(150, () => Sound.swoosh());
      at(750, () => { el.classList.add('strike'); Sound.clash(); });
      at(1000, () => {
        el.classList.add('shatter');
        Sound.crumble();
        const color = defender[0];
        for (let i = 0; i < 18; i++) {
          const s = document.createElement('span');
          s.className = `shard ${color}`;
          const angle = Math.random() * Math.PI * 2;
          const dist = 80 + Math.random() * 160;
          s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
          s.style.setProperty('--dy', `${Math.sin(angle) * dist - 40}px`);
          s.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`);
          s.style.setProperty('--size', `${8 + Math.random() * 18}px`);
          shards.appendChild(s);
        }
        text.textContent = describe(attacker, defender);
      });
      at(2600, finish);
    });
  }

  root.Duel = { play, describe, GLYPH, NAME, TEAM, josa, glyph };
})(window);
