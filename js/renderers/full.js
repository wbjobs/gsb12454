/* 方案一：整段渲染 —— 全部行进入 DOM。
   为防页面完全卡死，按帧分批挂载（每帧 400 行），
   真实暴露其问题：渲染慢、DOM 节点多、内存高、高亮需截断。 */
(function (global) {
  'use strict';

  var CHUNK = 400;
  var MAX_HIGHLIGHT_LINES = 300; // 高亮不能阻塞渲染：截断

  function createFullRenderer(ctx) {
    var box = null;
    var lineEls = [];
    var cancelled = false;
    var rafId = 0;
    var highlightedLines = [];
    var lastActiveEl = null;

    function renderChunk(start, t0) {
      if (cancelled) return;
      var frag = document.createDocumentFragment();
      var end = Math.min(start + CHUNK, ctx.lines.length);
      for (var i = start; i < end; i++) {
        var el = document.createElement('div');
        el.className = 'line';
        global.RenderCommon.fillLineEl(el, i, ctx.lines[i], '');
        lineEls.push(el);
        frag.appendChild(el);
      }
      box.appendChild(frag);
      if (end < ctx.lines.length) {
        rafId = requestAnimationFrame(function () { renderChunk(end, t0); });
      } else {
        ctx.onRenderDone(performance.now() - t0);
        applyHighlights();
      }
    }

    function applyHighlights() {
      var query = ctx.getQuery();
      var active = ctx.getActiveLine();
      // 先清除上一轮高亮与激活态，避免残留
      for (var k = 0; k < highlightedLines.length; k++) {
        var li = highlightedLines[k];
        if (lineEls[li]) {
          global.RenderCommon.fillLineEl(lineEls[li], li, ctx.lines[li], '');
        }
      }
      highlightedLines = [];
      if (lastActiveEl) {
        lastActiveEl.classList.remove('active');
        lastActiveEl = null;
      }
      if (!query) return;
      var matchSet = ctx.getMatchSet();
      var n = 0;
      matchSet.forEach(function (lineIdx) {
        if (n >= MAX_HIGHLIGHT_LINES) return;
        var el = lineEls[lineIdx];
        if (el) {
          global.RenderCommon.fillLineEl(el, lineIdx, ctx.lines[lineIdx], query);
          highlightedLines.push(lineIdx);
          n++;
        }
      });
      if (active >= 0 && lineEls[active]) {
        lineEls[active].classList.add('active');
        lastActiveEl = lineEls[active];
      }
    }

    return {
      mount: function () {
        cancelled = false;
        lineEls = [];
        box = document.createElement('div');
        box.className = 'dom-page';
        ctx.viewport.appendChild(box);
        var t0 = performance.now();
        rafId = requestAnimationFrame(function () { renderChunk(0, t0); });
      },
      unmount: function () {
        cancelled = true;
        cancelAnimationFrame(rafId);
        if (box && box.parentNode) box.parentNode.removeChild(box);
        box = null;
        lineEls = [];
      },
      refresh: function () {
        if (!box) return;
        applyHighlights();
      },
      scrollToLine: function (i) {
        var el = lineEls[i];
        if (!el || !box) return;
        box.scrollTop = el.offsetTop - box.clientHeight / 2;
      },
      domCount: function () {
        return box ? box.getElementsByTagName('*').length : 0;
      }
    };
  }

  global.FullRenderer = createFullRenderer;
})(window);
