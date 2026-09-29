/* 方案四：Canvas 绘制 —— DOM 中只有一个 <canvas>，文本按帧绘制。
   处理 devicePixelRatio，滚动经 rAF 节流，高亮用底色矩形实现。 */
(function (global) {
  'use strict';

  function createCanvasRenderer(ctx) {
    var LINE_H = global.RenderCommon.LINE_H;
    var FONT = '13px "SF Mono", Consolas, "Courier New", monospace';
    var TEXT_X = 76;
    var box = null;
    var spacer = null;
    var canvas = null;
    var g = null;
    var dpr = 1;
    var rafPending = false;
    var mounted = false;

    function resizeCanvas() {
      dpr = window.devicePixelRatio || 1;
      var w = box.clientWidth;
      var h = box.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }

    function draw() {
      if (!mounted) return;
      rafPending = false;
      var w = canvas.width;
      var h = canvas.height;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.font = FONT;
      g.textBaseline = 'alphabetic';

      var scrollTop = box.scrollTop;
      var viewH = box.clientHeight;
      var first = Math.floor(scrollTop / LINE_H);
      var count = Math.ceil(viewH / LINE_H) + 1;
      var offsetY = -(scrollTop - first * LINE_H);
      var query = ctx.getQuery();
      var matchSet = ctx.getMatchSet();
      var active = ctx.getActiveLine();

      for (var k = 0; k < count; k++) {
        var idx = first + k;
        if (idx >= ctx.lines.length) break;
        var y = offsetY + k * LINE_H + 20;
        var text = ctx.lines[idx];

        if (idx === active) {
          g.fillStyle = 'rgba(79,140,255,0.15)';
          g.fillRect(0, offsetY + k * LINE_H, box.clientWidth, LINE_H);
        }

        // 高亮：仅可视行参与，measureText 开销可控
        if (query && matchSet.has(idx)) {
          var cols = global.RenderCommon.findMatchCols(text, query);
          g.fillStyle = '#7a5c00';
          for (var m = 0; m < cols.length; m++) {
            var preW = g.measureText(text.slice(0, cols[m])).width;
            var hitW = g.measureText(text.slice(cols[m], cols[m] + query.length)).width;
            g.fillRect(TEXT_X + preW, offsetY + k * LINE_H + 4, hitW, LINE_H - 6);
          }
        }

        g.fillStyle = '#5a5b64';
        g.fillText(String(idx + 1), 8, y);
        g.fillStyle = '#d8d9de';
        g.fillText(text, TEXT_X, y);
      }
    }

    function schedule() {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(draw);
      }
    }

    function onResize() {
      resizeCanvas();
      schedule();
    }

    return {
      mount: function () {
        mounted = true;
        box = document.createElement('div');
        box.className = 'scroll-box';
        spacer = document.createElement('div');
        spacer.className = 'spacer';
        // 绝对定位撑开滚动高度，canvas 以 sticky 停留在可视区顶部
        spacer.style.position = 'absolute';
        spacer.style.top = '0';
        spacer.style.height = ctx.lines.length * LINE_H + 'px';
        canvas = document.createElement('canvas');
        canvas.className = 'canvas-view';
        box.appendChild(spacer);
        box.appendChild(canvas);
        ctx.viewport.appendChild(box);
        g = canvas.getContext('2d');
        resizeCanvas();
        box.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', onResize);
        var t0 = performance.now();
        draw();
        ctx.onRenderDone(performance.now() - t0);
      },
      unmount: function () {
        mounted = false;
        if (box) {
          box.removeEventListener('scroll', schedule);
          window.removeEventListener('resize', onResize);
          if (box.parentNode) box.parentNode.removeChild(box);
        }
        box = null;
        canvas = null;
        g = null;
      },
      refresh: function () {
        schedule();
      },
      scrollToLine: function (i) {
        if (!box) return;
        box.scrollTop = Math.max(0, i * LINE_H - box.clientHeight / 2);
        schedule();
      },
      domCount: function () {
        return box ? box.getElementsByTagName('*').length : 0;
      }
    };
  }

  global.CanvasRenderer = createCanvasRenderer;
})(window);
