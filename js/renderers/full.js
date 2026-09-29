/**
 * 方案一：整段渲染（对照组 / 反面基线）
 * 把全部行一次性塞进 DOM。为避免页面完全卡死，按 rAF 分块追加，
 * 但所有节点最终都常驻内存 —— 用来直观展示 DOM 节点数与内存的失控增长。
 */
window.Renderers = window.Renderers || {};

window.Renderers.full = {
  create(container, env) {
    const CHUNK = 800;
    let aborted = false;
    let highlightTimer = 0;

    const scroller = document.createElement('div');
    scroller.className = 'full-scroller';
    const progress = document.createElement('div');
    progress.className = 'render-progress';
    const linesWrap = document.createElement('div');
    scroller.appendChild(progress);
    scroller.appendChild(linesWrap);
    container.appendChild(scroller);

    const lines = env.lines;
    const total = lines.length;
    let lastHighlighted = []; // 上次写入高亮的行号，用于清除时还原

    function plainHTML(rec) {
      return '<span class="ln">[' + rec.no + ']</span> ' + Util.escapeHtml(rec.text);
    }

    function applyHighlights() {
      // 分块写入高亮，避免一次性 innerHTML 重写阻塞主线程
      const hl = env.getHighlights();
      const entries = hl.byLine ? Array.from(hl.byLine.entries()) : [];
      const toRestore = lastHighlighted;
      lastHighlighted = entries.map(e => e[0]);
      let k = 0;
      let r = 0;
      cancelAnimationFrame(highlightTimer);
      function step() {
        if (aborted) return;
        // 先还原旧高亮（搜索词变化/清空时）
        const rEnd = Math.min(r + 150, toRestore.length);
        for (; r < rEnd; r++) {
          const el = linesWrap.children[toRestore[r]];
          if (el) el.innerHTML = plainHTML(lines[toRestore[r]]);
        }
        if (r < toRestore.length) {
          highlightTimer = requestAnimationFrame(step);
          return;
        }
        const end = Math.min(k + 150, entries.length);
        for (; k < end; k++) {
          const entry = entries[k];
          const lineIdx = entry[0];
          const matches = entry[1];
          const el = linesWrap.children[lineIdx];
          if (!el) continue;
          const rec = lines[lineIdx];
          el.innerHTML = '<span class="ln">[' + rec.no + ']</span> ' +
            Util.buildHighlightedHTML(rec.text, matches, hl.current, hl.globalBaseOf(lineIdx));
        }
        if (k < entries.length) highlightTimer = requestAnimationFrame(step);
      }
      step();
    }

    const ready = new Promise((resolve) => {
      let i = 0;
      function step() {
        if (aborted) { resolve(); return; }
        const frag = document.createDocumentFragment();
        const end = Math.min(i + CHUNK, total);
        for (; i < end; i++) {
          const div = document.createElement('div');
          div.className = 'line';
          div.innerHTML = plainHTML(lines[i]);
          frag.appendChild(div);
        }
        linesWrap.appendChild(frag);
        progress.textContent = '整段渲染中… ' + (i / total * 100).toFixed(0) + '%（' + i + '/' + total + ' 行）';
        if (i < total) {
          requestAnimationFrame(step);
        } else {
          progress.remove();
          applyHighlights(); // 初始渲染期间到达的搜索结果，补一次高亮
          resolve();
        }
      }
      requestAnimationFrame(step);
    });

    return {
      ready,
      setHighlights: applyHighlights,
      scrollToLine(i) {
        const el = linesWrap.children[i];
        if (el) el.scrollIntoView({ block: 'center' });
      },
      destroy() {
        aborted = true;
        cancelAnimationFrame(highlightTimer);
        container.innerHTML = '';
      },
    };
  },
};
