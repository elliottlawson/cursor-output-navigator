// ==UserScript==
// @name        Cursor Agents — Output Navigator
// @description Timeline rail with one dot per agent output + a "jump to latest output" button, for cursor.com/agents conversations.
// @match       https://cursor.com/agents*
// @version     1.1.1
// @run-at      document-idle
// ==/UserScript==

(() => {
  // teardown previous (idempotent re-injection)
  window.__caxDestroy?.();
  document.getElementById('cax-rail')?.remove();
  document.getElementById('cax-jump')?.remove();
  document.getElementById('cax-style')?.remove();

  const SEL_CONTAINER = '[data-component=agent-main-content-scroll-container]';
  const getContainer = () => document.querySelector(SEL_CONTAINER);
  const getTurns = () => {
    const c = getContainer();
    if (!c) return [];
    return [...c.querySelectorAll('.human-message-card')]
      .map(h => h.closest('.sticky')?.parentElement)
      .filter(Boolean);
  };
  const turnTop = (t, c) =>
    t.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop;
  const turnPreview = (t) => {
    const prose = t.querySelector('.portal-markdown-root');
    const txt = (prose ? prose.textContent : '').replace(/\s+/g, ' ').trim();
    return txt || '(output pending…)';
  };

  // ---------- styles ----------
  const style = document.createElement('style');
  style.id = 'cax-style';
  style.textContent = `
    #cax-rail {
      position: fixed; right: 6px; top: 18vh; height: 64vh; width: 26px;
      z-index: 99999; pointer-events: none;
    }
    #cax-rail .cax-line {
      position: absolute; left: 12px; top: 0; bottom: 0; width: 2px;
      background: var(--border-primary, rgba(128,128,128,.35)); border-radius: 1px;
    }
    #cax-rail .cax-dot {
      position: absolute; left: 2px; width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
      background: none; border: none; padding: 0; cursor: pointer;
      pointer-events: auto;
    }
    #cax-rail .cax-dot .cax-dot-circle {
      width: 11px; height: 11px; border-radius: 50%;
      background: var(--text-tertiary, rgba(128,128,128,.55));
      border: 2px solid var(--bg-chrome, #fff);
      box-shadow: 0 0 0 1px var(--border-primary, rgba(128,128,128,.4));
      transition: transform .12s ease, background .12s ease;
      display: flex; align-items: center; justify-content: center;
    }
    #cax-rail .cax-dot:hover .cax-dot-circle { transform: scale(1.35); }
    #cax-rail .cax-dot.cax-active .cax-dot-circle {
      background: var(--accent, #2778c1);
      box-shadow: 0 0 0 1px var(--accent, #2778c1);
      transform: scale(1.25);
    }
    #cax-rail .cax-tip {
      display: none;
      position: absolute; right: 26px; top: 50%;
      transform: translateY(-50%);
      width: 240px; padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--border-primary, rgba(128,128,128,.4));
      background: var(--bg-chrome, #fff); color: var(--text-primary, #141414);
      box-shadow: 0 4px 16px rgba(0,0,0,.14);
      font: 400 11px/1.45 system-ui, sans-serif;
      text-align: left; white-space: normal; cursor: default;
    }
    #cax-rail .cax-dot:hover .cax-tip { display: block; }
    #cax-rail .cax-tip .cax-tip-label {
      display: block; font-weight: 600; font-size: 10px; letter-spacing: .02em;
      color: var(--text-secondary, rgba(128,128,128,.8));
      margin-bottom: 3px;
    }
    #cax-rail .cax-tip .cax-tip-text {
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    #cax-jump {
      position: fixed; right: 34px; bottom: 96px; z-index: 99999;
      padding: 7px 12px; font: 500 12px/1 system-ui, sans-serif;
      border-radius: 999px; cursor: pointer;
      border: 1px solid var(--border-primary, rgba(128,128,128,.4));
      background: var(--bg-chrome, #fff); color: var(--text-primary, #141414);
      box-shadow: 0 2px 10px rgba(0,0,0,.12);
      opacity: .92; transition: opacity .12s ease, transform .12s ease;
    }
    #cax-jump:hover { opacity: 1; transform: translateY(-1px); }
  `;
  document.head.appendChild(style);

  // ---------- DOM ----------
  const rail = document.createElement('div');
  rail.id = 'cax-rail';
  const line = document.createElement('div');
  line.className = 'cax-line';
  rail.appendChild(line);
  document.body.appendChild(rail);

  const btn = document.createElement('button');
  btn.id = 'cax-jump';
  btn.textContent = '↑ Latest';
  document.body.appendChild(btn);

  // ---------- state ----------
  let observer = null;
  let observedContainer = null;
  let rafPending = false;

  const scrollToTurn = (t) => {
    const c = getContainer();
    if (c && t) c.scrollTo({ top: turnTop(t, c), behavior: 'smooth' });
  };

  btn.onclick = () => {
    const turns = getTurns();
    scrollToTurn(turns[turns.length - 1]);
  };

  const render = () => {
    rafPending = false;
    const c = getContainer();
    const turns = getTurns();
    const show = !!(c && turns.length);
    rail.style.display = show ? '' : 'none';
    btn.style.display = show ? '' : 'none';
    if (!show) { rail.querySelectorAll('.cax-dot').forEach(d => d.remove()); return; }

    const H = c.scrollHeight;
    const railH = rail.clientHeight;
    const MIN_GAP = 20; // px between dot centers

    // fractional positions with min-gap enforcement (top to bottom)
    let lastY = -Infinity;
    const tops = turns.map(t => turnTop(t, c));
    // active = last turn whose top is above current scroll position (+slack)
    const st = c.scrollTop;
    let activeIdx = 0;
    tops.forEach((top, i) => { if (top <= st + 120) activeIdx = i; });

    const ys = tops.map(top => {
      let y = Math.min(railH - 11, Math.max(11, (top / H) * railH));
      if (y - lastY < MIN_GAP) y = lastY + MIN_GAP;
      lastY = y;
      return y;
    });

    const labelFor = (i) =>
      'Output ' + (i + 1) + (i === turns.length - 1 ? ' · latest' : '');

    let dots = rail.querySelectorAll('.cax-dot');
    if (dots.length === turns.length) {
      // update in place — keeps hover state alive during streaming re-renders
      dots.forEach((dot, i) => {
        dot.style.top = (ys[i] - 11) + 'px';
        dot.classList.toggle('cax-active', i === activeIdx);
        dot.querySelector('.cax-tip-label').textContent = labelFor(i);
        dot.querySelector('.cax-tip-text').textContent = turnPreview(turns[i]);
      });
      return;
    }

    rail.querySelectorAll('.cax-dot').forEach(d => d.remove());
    turns.forEach((t, i) => {
      const dot = document.createElement('button');
      dot.className = 'cax-dot' + (i === activeIdx ? ' cax-active' : '');
      dot.style.top = (ys[i] - 11) + 'px';
      const circle = document.createElement('span');
      circle.className = 'cax-dot-circle';
      dot.appendChild(circle);
      const tip = document.createElement('span');
      tip.className = 'cax-tip';
      const tipLabel = document.createElement('span');
      tipLabel.className = 'cax-tip-label';
      tipLabel.textContent = labelFor(i);
      const tipText = document.createElement('span');
      tipText.className = 'cax-tip-text';
      tipText.textContent = turnPreview(t);
      tip.appendChild(tipLabel);
      tip.appendChild(tipText);
      dot.appendChild(tip);
      dot.onclick = () => scrollToTurn(t);
      rail.appendChild(dot);
    });
  };

  const scheduleRender = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(render);
  };

  const attach = () => {
    const c = getContainer();
    if (c === observedContainer) return;
    observer?.disconnect();
    observedContainer = c;
    if (c) {
      observer = new MutationObserver(scheduleRender);
      observer.observe(c, { childList: true, subtree: true, characterData: true });
      c.addEventListener('scroll', scheduleRender, { passive: true });
    }
    scheduleRender();
  };

  const poll = setInterval(attach, 800);
  window.addEventListener('resize', scheduleRender);
  attach();

  window.__caxDestroy = () => {
    clearInterval(poll);
    observer?.disconnect();
    window.removeEventListener('resize', scheduleRender);
    rail.remove(); btn.remove(); style.remove();
    delete window.__caxDestroy;
  };
})();
