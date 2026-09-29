/**
 * 方案二：分页渲染
 * 每次只渲染一页（PAGE_SIZE 行），DOM 规模恒定；
 * 代价是无法连续滚动，跳转需要翻页。
 */
window.Renderers = window.Renderers || {};

window.Renderers.paged = {
  create(container, env) {
    const PAGE_SIZE = 200;
    const lines = env.lines;
    const totalPages = Math.ceil(lines.length / PAGE_SIZE);
    let page = 0;

    const wrap = document.createElement('div');
    wrap.className = 'paged-wrap';
    wrap.innerHTML =
      '<div class="paged-toolbar">' +
      '<button data-act="first">|&lt;</button>' +
      '<button data-act="prev">&lt; 上一页</button>' +
      '<span>第 <input type="number" min="1" value="1"> / ' + totalPages + ' 页</span>' +
      '<button data-act="next">下一页 &gt;</button>' +
      '<button data-act="last">&gt;|</button>' +
      '<span class="dim">每页 ' + PAGE_SIZE + ' 行</span>' +
      '</div>' +
      '<div class="paged-body"></div>';
    container.appendChild(wrap);

    const body = wrap.querySelector('.paged-body');
    const input = wrap.querySelector('input');

    function lineHTML(i) {
      const rec = lines[i];
      const hl = env.getHighlights();
      const matches = hl.byLine ? hl.byLine.get(i) : null;
      const text = matches
        ? Util.buildHighlightedHTML(rec.text, matches, hl.current, hl.globalBaseOf(i))
        : Util.escapeHtml(rec.text);
      return '<div class="line"><span class="ln">[' + rec.no + ']</span> ' + text + '</div>';
    }

    function render() {
      const start = page * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, lines.length);
      let html = '';
      for (let i = start; i < end; i++) html += lineHTML(i);
      body.innerHTML = html;
      body.scrollTop = 0;
      input.value = String(page + 1);
    }

    function goTo(p) {
      page = Math.max(0, Math.min(totalPages - 1, p));
      render();
    }

    wrap.querySelector('.paged-toolbar').addEventListener('click', (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (!act) return;
      if (act === 'first') goTo(0);
      else if (act === 'prev') goTo(page - 1);
      else if (act === 'next') goTo(page + 1);
      else if (act === 'last') goTo(totalPages - 1);
    });
    input.addEventListener('change', () => goTo((Number(input.value) || 1) - 1));

    render();

    return {
      ready: Promise.resolve(),
      setHighlights: render,
      scrollToLine(i) {
        const target = Math.floor(i / PAGE_SIZE);
        if (target !== page) goTo(target);
        const el = body.children[i - page * PAGE_SIZE];
        if (el) el.scrollIntoView({ block: 'center' });
      },
      destroy() {
        container.innerHTML = '';
      },
    };
  },
};
