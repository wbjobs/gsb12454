/* 主控：语料生成、方案切换、搜索调度（防抖 + Worker）、跳转、指标上报 */
(function () {
  'use strict';

  var TARGET_CHARS = 1000000;
  var SEARCH_DEBOUNCE = 250;

  var SCHEME_NOTES = {
    full: '整段渲染：全部行进入 DOM（分帧挂载防卡死）；高亮限前 300 行防阻塞',
    paged: '分页渲染：每页 300 行，DOM 规模恒定',
    virtual: '虚拟滚动：仅渲染可视区 ± 缓冲行，节点池复用，内存不随滚动增长',
    canvas: 'Canvas 绘制：DOM 仅 1 个画布，文本逐帧绘制'
  };
  var SCHEME_NAMES = {
    full: '整段渲染',
    paged: '分页渲染',
    virtual: '虚拟滚动',
    canvas: 'Canvas 绘制'
  };

  // ---------- DOM ----------
  var viewport = document.getElementById('viewport');
  var searchInput = document.getElementById('searchInput');
  var matchInfo = document.getElementById('matchInfo');
  var jumpInput = document.getElementById('jumpInput');
  var textInfo = document.getElementById('textInfo');
  var schemeNote = document.getElementById('schemeNote');
  var mScheme = document.getElementById('mScheme');
  var mRender = document.getElementById('mRender');
  var mFps = document.getElementById('mFps');
  var mMem = document.getElementById('mMem');
  var mDom = document.getElementById('mDom');
  var mLongtask = document.getElementById('mLongtask');
  var mSearch = document.getElementById('mSearch');

  // ---------- 状态 ----------
  var lines = [];
  var current = null;
  var currentName = '';
  var renderers = {};
  var query = '';
  var matchLines = new Uint32Array(0);
  var matchSet = new Set();
  var matchCount = 0;
  var activeIdx = -1;
  var activeLine = -1;
  var searchJobId = 0;
  var searchSentAt = 0;

  // ---------- 指标 ----------
  var metrics = Metrics.create({
    fpsWindow: 500,
    onSample: function (s) {
      if (s.type === 'fps') {
        mFps.textContent = s.value.toFixed(0);
        mFps.style.color = s.value >= 50 ? '#6fce6f' : (s.value >= 30 ? '#e0b34f' : '#e06c5a');
      } else if (s.type === 'memory') {
        mMem.textContent = Metrics.formatBytes(s.value);
      } else if (s.type === 'longtask') {
        mLongtask.textContent = String(s.value);
      }
    }
  });
  metrics.start();

  document.getElementById('fpsWindow').addEventListener('change', function (e) {
    metrics.setFpsWindow(Number(e.target.value));
  });

  function updateDomCount() {
    if (!current) return;
    setTimeout(function () {
      if (current) mDom.textContent = String(current.domCount());
    }, 0);
  }

  // ---------- 渲染器上下文 ----------
  var ctx = {
    lines: lines,
    viewport: viewport,
    getQuery: function () { return query; },
    getMatchSet: function () { return matchSet; },
    getActiveLine: function () { return activeLine; },
    onRenderDone: function (ms) {
      mRender.textContent = ms.toFixed(1) + ' ms';
      updateDomCount();
    }
  };

  // ---------- 方案切换 ----------
  function switchScheme(name) {
    if (current) current.unmount();
    viewport.textContent = '';
    metrics.resetLongtasks();
    mRender.textContent = '渲染中…';
    mDom.textContent = '-';
    if (!renderers[name]) {
      var factory = {
        full: FullRenderer,
        paged: PagedRenderer,
        virtual: VirtualRenderer,
        canvas: CanvasRenderer
      }[name];
      renderers[name] = factory(ctx);
    }
    current = renderers[name];
    currentName = name;
    current.mount();
    mScheme.textContent = SCHEME_NAMES[name];
    schemeNote.textContent = SCHEME_NOTES[name];
    var tabs = document.getElementById('schemeTabs').children;
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].dataset.scheme === name);
    }
  }

  document.getElementById('schemeTabs').addEventListener('click', function (e) {
    var name = e.target.dataset && e.target.dataset.scheme;
    if (name && name !== currentName) switchScheme(name);
  });

  // ---------- 搜索（Web Worker + 防抖 + 过期任务丢弃） ----------
  var worker = new Worker('js/search-worker.js');
  var workerReady = false;

  worker.onmessage = function (e) {
    var data = e.data;
    if (data.type === 'ready') {
      workerReady = true;
      return;
    }
    if (data.type === 'result') {
      if (data.jobId !== searchJobId) return; // 过期结果丢弃
      var elapsed = performance.now() - searchSentAt;
      mSearch.textContent = elapsed.toFixed(1) + ' ms';
      mSearch.style.color = elapsed <= 1000 ? '#6fce6f' : '#e06c5a';
      matchLines = data.lines;
      matchCount = data.count;
      matchSet = new Set(matchLines);
      activeIdx = matchLines.length > 0 ? 0 : -1;
      activeLine = activeIdx >= 0 ? matchLines[0] : -1;
      updateMatchInfo();
      if (current) current.refresh();
      if (activeLine >= 0 && current) current.scrollToLine(activeLine);
      updateDomCount();
    }
  };

  function updateMatchInfo() {
    if (!query) {
      matchInfo.textContent = '未搜索';
    } else if (matchCount === 0) {
      matchInfo.textContent = '无匹配';
    } else {
      matchInfo.textContent = '共 ' + matchCount + ' 处 / ' + matchLines.length +
        ' 行，第 ' + (activeIdx + 1) + ' 行命中';
    }
  }

  var debounceTimer = 0;
  searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, SEARCH_DEBOUNCE);
  });

  function runSearch() {
    query = searchInput.value.trim();
    if (!workerReady) return;
    searchJobId++;
    searchSentAt = performance.now();
    if (!query) {
      matchLines = new Uint32Array(0);
      matchSet = new Set();
      matchCount = 0;
      activeIdx = -1;
      activeLine = -1;
      mSearch.textContent = '-';
      updateMatchInfo();
      if (current) current.refresh();
      updateDomCount();
      return;
    }
    worker.postMessage({ type: 'search', jobId: searchJobId, query: query });
  }

  function gotoMatch(idx) {
    if (matchLines.length === 0) return;
    activeIdx = ((idx % matchLines.length) + matchLines.length) % matchLines.length;
    activeLine = matchLines[activeIdx];
    updateMatchInfo();
    if (current) {
      current.refresh();
      current.scrollToLine(activeLine);
    }
  }

  document.getElementById('prevMatch').addEventListener('click', function () {
    gotoMatch(activeIdx - 1);
  });
  document.getElementById('nextMatch').addEventListener('click', function () {
    gotoMatch(activeIdx + 1);
  });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') gotoMatch(activeIdx < 0 ? 0 : activeIdx + 1);
  });

  // ---------- 行号跳转 ----------
  function jumpToLine() {
    var n = Number(jumpInput.value);
    if (!Number.isFinite(n)) return;
    var idx = Math.max(0, Math.min(lines.length - 1, Math.round(n) - 1));
    activeLine = idx;
    if (current) {
      current.refresh();
      current.scrollToLine(idx);
    }
  }
  document.getElementById('jumpBtn').addEventListener('click', jumpToLine);
  jumpInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') jumpToLine();
  });

  // ---------- 启动 ----------
  var t0 = performance.now();
  var corpus = TextGen.generate(TARGET_CHARS);
  lines = corpus.lines;
  ctx.lines = lines;
  textInfo.textContent = '语料：' + corpus.charCount.toLocaleString() + ' 字 / ' +
    lines.length.toLocaleString() + ' 行（生成耗时 ' +
    (performance.now() - t0).toFixed(0) + ' ms）';
  worker.postMessage({ type: 'init', lines: lines });
  switchScheme('virtual');
})();
