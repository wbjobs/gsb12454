/* 通用工具：HTML 转义与高亮片段拼接 */
window.Util = (() => {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, c => ESC[c]);
  }

  /**
   * 把一行文本按匹配位置拼成带 <mark> 的 HTML。
   * matches: [{start, length}]，需按 start 升序、互不重叠。
   * currentIndex: 当前聚焦匹配在该行 matches 中的下标（全局序号由调用方保证），-1 表示无。
   */
  function buildHighlightedHTML(line, matches, currentGlobalIdx, globalBase) {
    if (!matches || matches.length === 0) return escapeHtml(line);
    let html = '';
    let cursor = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      html += escapeHtml(line.slice(cursor, m.start));
      const cls = (globalBase + i === currentGlobalIdx) ? ' class="current"' : '';
      html += '<mark' + cls + '>' + escapeHtml(line.substr(m.start, m.length)) + '</mark>';
      cursor = m.start + m.length;
    }
    html += escapeHtml(line.slice(cursor));
    return html;
  }

  /** rAF 节流：把高频事件（滚动/输入）合并到每帧最多一次 */
  function rafThrottle(fn) {
    let ticking = false;
    let lastArgs = null;
    return function (...args) {
      lastArgs = args;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        fn.apply(this, lastArgs);
      });
    };
  }

  function debounce(fn, ms) {
    let timer = 0;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  return { escapeHtml, buildHighlightedHTML, rafThrottle, debounce };
})();
