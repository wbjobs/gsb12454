/* 性能采样：FPS（rAF，可调采样窗口）、JS 堆内存、长任务（PerformanceObserver） */
(function (global) {
  'use strict';

  function createMetrics(opts) {
    var fpsWindow = opts.fpsWindow || 500;
    var onSample = opts.onSample || function () {};

    var frames = 0;
    var windowStart = 0;
    var running = false;
    var rafId = 0;
    var memTimer = 0;
    var longtaskCount = 0;
    var observer = null;

    function loop(now) {
      if (!running) return;
      if (windowStart === 0) windowStart = now;
      frames++;
      var elapsed = now - windowStart;
      if (elapsed >= fpsWindow) {
        var fps = (frames * 1000) / elapsed;
        onSample({ type: 'fps', value: fps });
        frames = 0;
        windowStart = now;
      }
      rafId = requestAnimationFrame(loop);
    }

    function sampleMemory() {
      if (performance.memory) {
        onSample({ type: 'memory', value: performance.memory.usedJSHeapSize });
      } else {
        onSample({ type: 'memory', value: null });
      }
    }

    return {
      start: function () {
        if (running) return;
        running = true;
        frames = 0;
        windowStart = 0;
        rafId = requestAnimationFrame(loop);
        sampleMemory();
        memTimer = setInterval(sampleMemory, 1000);
        if (typeof PerformanceObserver !== 'undefined') {
          try {
            observer = new PerformanceObserver(function (list) {
              longtaskCount += list.getEntries().length;
              onSample({ type: 'longtask', value: longtaskCount });
            });
            observer.observe({ entryTypes: ['longtask'] });
          } catch (e) { observer = null; }
        }
      },
      stop: function () {
        running = false;
        cancelAnimationFrame(rafId);
        clearInterval(memTimer);
        if (observer) { observer.disconnect(); observer = null; }
      },
      resetLongtasks: function () {
        longtaskCount = 0;
        onSample({ type: 'longtask', value: 0 });
      },
      setFpsWindow: function (ms) {
        fpsWindow = ms;
        frames = 0;
        windowStart = 0;
      }
    };
  }

  function formatBytes(bytes) {
    if (bytes == null) return '不支持';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  global.Metrics = { create: createMetrics, formatBytes: formatBytes };
})(window);
