/* 方案三：虚拟滚动 —— 只渲染可视区 ± 缓冲行，DOM 节点池复用。
   滚动事件 passive + rAF 节流，防止滚动抖动造成掉帧。 */
(function (global) {
  'use strict';

  var OVERSCAN = 6;

  function createVirtualRenderer(ctx) {
    var LINE_H = global.RenderCommon.LINE_H;
    var box = null;       // 滚动容器
    var spacer = null;    // 撑高元素
    var win = null;       // 平移窗口
    var pool = [];        // 复用的行元素
    var poolStart = -1;   // 当前池对应的起始行
    var rafPending = false;
    var mounted = false;

    function visibleCount() {
      return Math.ceil(box.clientHeight / LINE_H);
    }

    function ensurePool() {
      var need = visibleCount() + OVERSCAN * 2;
      while (pool.length < need) {
        var el = document.createElement('div');
        el.className = 'line';
        win.appendChild(el);
        pool.push(el);
      }
    }

    function render() {
      if (!mounted) return;
      rafPending = false;
      ensurePool();
      var start = Math.max(0, Math.floor(box.scrollTop / LINE_H) - OVERSCAN);
      if (start === poolStart && !render.force) return;
      render.force = false;
      poolStart = start;
      win.style.transform = 'translateY(' + start * LINE_H + 'px)';
      var query = ctx.getQuery();
      var active = ctx.getActiveLine();
      for (var k = 0; k < pool.length; k++) {
        var idx = start + k;
        var el = pool[k];
        if (idx < ctx.lines.length) {
          el.style.display = '';
          global.RenderCommon.fillLineEl(el, idx, ctx.lines[idx], query);
          el.classList.toggle('active', idx === active);
        } else {
          el.style.display = 'none';
        }
      }
    }
    render.force = false;

    function onScroll() {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(render);
      }
    }

    function onResize() {
      poolStart = -1;
      onScroll();
    }

    return {
      mount: function () {
        mounted = true;
        poolStart = -1;
        pool = [];
        box = document.createElement('div');
        box.className = 'scroll-box';
        spacer = document.createElement('div');
        spacer.className = 'spacer';
        spacer.style.height = ctx.lines.length * LINE_H + 'px';
        win = document.createElement('div');
        win.className = 'virtual-window';
        spacer.appendChild(win);
        box.appendChild(spacer);
        ctx.viewport.appendChild(box);
        box.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);
        var t0 = performance.now();
        render();
        ctx.onRenderDone(performance.now() - t0);
      },
      unmount: function () {
        mounted = false;
        if (box) {
          box.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onResize);
          if (box.parentNode) box.parentNode.removeChild(box);
        }
        box = null;
        pool = [];
      },
      refresh: function () {
        render.force = true;
        onScroll();
      },
      scrollToLine: function (i) {
        if (!box) return;
        box.scrollTop = Math.max(0, i * LINE_H - box.clientHeight / 2);
        render.force = true;
        onScroll();
      },
      domCount: function () {
        return box ? box.getElementsByTagName('*').length : 0;
      }
    };
  }

  global.VirtualRenderer = createVirtualRenderer;
})(window);
