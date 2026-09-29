/**
 * 性能采样：
 *  - FPS：rAF 计数，按可调采样间隔聚合
 *  - 内存：performance.memory（仅 Chromium），其它浏览器显示 "—"
 *  - DOM 节点数：视口容器内元素总数
 *  - 长任务：PerformanceObserver('longtask')
 *  - 渲染耗时：PerformanceObserver('measure')，主流程用 performance.measure 打点
 */
window.Metrics = (() => {
  const els = {};
  let sampleMs = 500;
  let frames = 0;
  let windowStart = 0;
  let longtaskCount = 0;
  let viewportEl = null;
  let running = false;

  function init() {
    els.render = document.getElementById('mRender');
    els.fps = document.getElementById('mFps');
    els.mem = document.getElementById('mMem');
    els.dom = document.getElementById('mDom');
    els.longtask = document.getElementById('mLongtask');
    viewportEl = document.getElementById('viewport');

    document.getElementById('sampleRate').addEventListener('change', (e) => {
      sampleMs = Number(e.target.value) || 500;
      frames = 0;
      windowStart = performance.now();
    });

    // 渲染耗时：主流程 performance.measure('scheme-render') 触发
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'scheme-render') {
            els.render.textContent = entry.duration.toFixed(1) + ' ms';
          }
        }
      }).observe({ entryTypes: ['measure'] });
    } catch (_) { /* 忽略不支持的环境 */ }

    // 长任务监控（掉帧/卡顿的间接指标）
    try {
      new PerformanceObserver((list) => {
        longtaskCount += list.getEntries().length;
        els.longtask.textContent = String(longtaskCount);
      }).observe({ entryTypes: ['longtask'] });
    } catch (_) { /* Safari 等不支持 longtask */ }
  }

  function tick(now) {
    frames++;
    const elapsed = now - windowStart;
    if (elapsed >= sampleMs) {
      els.fps.textContent = Math.round(frames * 1000 / elapsed);
      frames = 0;
      windowStart = now;

      if (performance.memory) {
        els.mem.textContent = (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + ' MB';
      } else {
        els.mem.textContent = '—（仅 Chromium 支持）';
      }
      els.dom.textContent = String(viewportEl.getElementsByTagName('*').length);
    }
    if (running) requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    windowStart = performance.now();
    requestAnimationFrame(tick);
  }

  function resetLongtask() {
    longtaskCount = 0;
    if (els.longtask) els.longtask.textContent = '0';
  }

  return { init, start, resetLongtask };
})();
