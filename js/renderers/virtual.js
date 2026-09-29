/**
 * 方案三：虚拟滚动
 * 只渲染视口附近的行（OVERSCAN 缓冲），容器内垫一个总高度的占位元素。
 * DOM 节点数恒定，滚动事件用 rAF 节流，起始行不变时不重绘。
 */
window.Renderers = window.Renderers || {};

window.Renderers.virtual = {
  create(container, env) {
    const OVERSCAN = 12;
    const LH = env.lineHeight;
    const lines = env.lines;

    const scroller = document.createElement('div');
    scroller.className = 'vs-scroller';
    const spacer = document.createElement('div');
    spacer.className = 'vs-spacer';
    spacer.style.height = (lines.length * LH) + 'px';
    const win = document.createElement('div');
    win.className = 'vs-window';
    spacer.appendChild(win);
    scroller.appendChild(spacer);
    container.appendChild(scroller);

    let renderedStart = -1;
    let destroyed = false;

    function lineHTML(i) {
      const rec = lines[i];
      const hl = env.getHighlights();
      const matches = hl.byLine ? hl.byLine.get(i) : null;
      const text = matches
        ? Util.buildHighlightedHTML(rec.text, matches, hl.current, hl.globalBaseOf(i))
        : Util.escapeHtml(rec.text);
      return '<div class="line"><span class="ln">[' + rec.no + ']</span> ' + text + '</div>';
    }

    function renderWindow() {
      if (destroyed) return;
      const viewH = scroller.clientHeight;
      const start = Math.max(0, Math.floor(scroller.scrollTop / LH) - OVERSCAN);
      const count = Math.ceil(viewH / LH) + OVERSCAN * 2;
      if (start === renderedStart) return;
      renderedStart = start;

      const end = Math.min(start + count, lines.length);
      let html = '';
      for (let i = start; i < end; i++) html += lineHTML(i);
      win.innerHTML = html;
      win.style.transform = 'translateY(' + (start * LH) + 'px)';
    }

    const onScroll = Util.rafThrottle(renderWindow);
    scroller.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(onScroll);
    ro.observe(scroller);

    renderWindow();

    return {
      ready: Promise.resolve(),
      setHighlights() {
        renderedStart = -1; // 强制重绘当前窗口
        renderWindow();
      },
      scrollToLine(i) {
        scroller.scrollTop = i * LH - scroller.clientHeight / 2;
        renderWindow();
      },
      destroy() {
        destroyed = true;
        scroller.removeEventListener('scroll', onScroll);
        ro.disconnect();
        container.innerHTML = '';
      },
    };
  },
};
