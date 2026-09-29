/* 方案二：分页渲染 —— 每页固定 300 行，DOM 规模恒定 */
(function (global) {
  'use strict';

  var PAGE_SIZE = 300;

  function createPagedRenderer(ctx) {
    var box = null;
    var listEl = null;
    var infoEl = null;
    var page = 0;
    var pageCount = Math.ceil(ctx.lines.length / PAGE_SIZE);
    var lineEls = [];

    function renderPage() {
      var t0 = performance.now();
      listEl.textContent = '';
      lineEls = [];
      var start = page * PAGE_SIZE;
      var end = Math.min(start + PAGE_SIZE, ctx.lines.length);
      var query = ctx.getQuery();
      var active = ctx.getActiveLine();
      var frag = document.createDocumentFragment();
      for (var i = start; i < end; i++) {
        var el = document.createElement('div');
        el.className = 'line';
        if (i === active) el.classList.add('active');
        global.RenderCommon.fillLineEl(el, i, ctx.lines[i], query);
        lineEls.push(el);
        frag.appendChild(el);
      }
      listEl.appendChild(frag);
      infoEl.textContent = '第 ' + (page + 1) + ' / ' + pageCount + ' 页（每页 ' + PAGE_SIZE + ' 行）';
      ctx.onRenderDone(performance.now() - t0);
    }

    function gotoPage(p) {
      page = Math.max(0, Math.min(pageCount - 1, p));
      renderPage();
    }

    return {
      mount: function () {
        box = document.createElement('div');
        box.className = 'dom-page';

        var bar = document.createElement('div');
        bar.className = 'pager-bar';
        var prev = document.createElement('button');
        prev.textContent = '上一页';
        prev.addEventListener('click', function () { gotoPage(page - 1); });
        var next = document.createElement('button');
        next.textContent = '下一页';
        next.addEventListener('click', function () { gotoPage(page + 1); });
        infoEl = document.createElement('span');
        bar.appendChild(prev);
        bar.appendChild(infoEl);
        bar.appendChild(next);

        listEl = document.createElement('div');
        box.appendChild(bar);
        box.appendChild(listEl);
        ctx.viewport.appendChild(box);
        renderPage();
      },
      unmount: function () {
        if (box && box.parentNode) box.parentNode.removeChild(box);
        box = null;
        listEl = null;
        lineEls = [];
      },
      refresh: function () {
        if (box) renderPage();
      },
      scrollToLine: function (i) {
        var target = Math.floor(i / PAGE_SIZE);
        if (target !== page) {
          gotoPage(target);
        } else {
          renderPage();
        }
        var el = lineEls[i - page * PAGE_SIZE];
        if (el && box) box.scrollTop = el.offsetTop - box.clientHeight / 2;
      },
      domCount: function () {
        return box ? box.getElementsByTagName('*').length : 0;
      }
    };
  }

  global.PagedRenderer = createPagedRenderer;
})(window);
