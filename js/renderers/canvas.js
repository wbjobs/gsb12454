/**
 * 方案四：Canvas 绘制
 * 视口内只有 1 个 <canvas>（position: sticky 固定在可视区），
 * 滚动时按 scrollTop 重绘可见行；高亮用 fillRect 画底色。
 * DOM 节点最少，文本不可选中是主要代价。
 */
window.Renderers = window.Renderers || {};

window.Renderers.canvas = {
  create(container, env) {
    const LH = env.lineHeight;
    const lines = env.lines;
    const FONT = '14px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

    const scroller = document.createElement('div');
    scroller.className = 'cv-scroller';
    const spacer = document.createElement('div');
    spacer.className = 'cv-spacer';
    spacer.style.height = (lines.length * LH) + 'px';
    const canvas = document.createElement('canvas');
    canvas.className = 'cv-canvas';
    spacer.appendChild(canvas);
    scroller.appendChild(spacer);
    container.appendChild(scroller);

    const ctx = canvas.getContext('2d');
    let destroyed = false;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = scroller.clientWidth;
      const h = scroller.clientHeight;
      canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      if (destroyed || canvas.width === 0) return;
      const w = scroller.clientWidth;
      const h = scroller.clientHeight;
      const scrollTop = scroller.scrollTop;
      const startLine = Math.floor(scrollTop / LH);
      const endLine = Math.min(lines.length - 1, Math.ceil((scrollTop + h) / LH));
      const hl = env.getHighlights();

      ctx.clearRect(0, 0, w, h);
      ctx.font = FONT;
      ctx.textBaseline = 'alphabetic';

      for (let i = startLine; i <= endLine; i++) {
        const y = i * LH - scrollTop;
        const rec = lines[i];
        const label = '[' + rec.no + '] ' + rec.text;

        // 高亮底色（先画背景再画字）
        const matches = hl.byLine ? hl.byLine.get(i) : null;
        if (matches) {
          const prefix = '[' + rec.no + '] ';
          const prefixW = ctx.measureText(prefix).width;
          const base = hl.globalBaseOf(i);
          for (let k = 0; k < matches.length; k++) {
            const m = matches[k];
            const x = 10 + prefixW + ctx.measureText(rec.text.slice(0, m.start)).width;
            const mw = ctx.measureText(rec.text.substr(m.start, m.length)).width;
            ctx.fillStyle = (base + k === hl.current)
              ? 'rgba(255,95,86,0.85)' : 'rgba(185,138,29,0.55)';
            ctx.fillRect(x, y + 4, mw, LH - 8);
          }
        }

        ctx.fillStyle = '#5c6274';
        ctx.fillText('[' + rec.no + ']', 10, y + LH - 8);
        ctx.fillStyle = '#e6e6e6';
        ctx.fillText(rec.text, 10 + ctx.measureText('[' + rec.no + '] ').width, y + LH - 8);
      }
    }

    const onScroll = Util.rafThrottle(draw);
    scroller.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(resize);
    ro.observe(scroller);

    resize();

    return {
      ready: Promise.resolve(),
      setHighlights: draw,
      scrollToLine(i) {
        scroller.scrollTop = i * LH - scroller.clientHeight / 2;
        draw();
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
