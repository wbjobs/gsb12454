/**
 * 主控：文本加载、方案切换、搜索调度（防抖 + 过期结果丢弃）、
 * 高亮状态管理、匹配跳转、渲染耗时打点。
 */
(() => {
  const LINE_HEIGHT = 26;

  const viewport = document.getElementById('viewport');
  const statusBar = document.getElementById('statusBar');
  const searchInput = document.getElementById('searchInput');
  const searchInfo = document.getElementById('searchInfo');
  const tabs = document.getElementById('schemeTabs');

  function setStatus(msg) { statusBar.textContent = msg; }

  /* ---------- 1. 生成文本 ---------- */
  setStatus('正在生成 100 万字文本…');
  const t0 = performance.now();
  const { lines, totalChars } = TextSource.generate();
  const texts = lines.map(l => l.text);
  document.getElementById('textInfo').textContent =
    totalChars.toLocaleString() + ' 字 / ' + lines.length.toLocaleString() + ' 行';
  setStatus('文本生成完成，耗时 ' + (performance.now() - t0).toFixed(0) + ' ms');

  /* ---------- 2. 高亮状态（跨方案共享） ---------- */
  const highlights = {
    byLine: null,        // Map<lineIdx, [{start, length}]>
    baseOf: null,        // Map<lineIdx, 该行之前的匹配数>
    flat: [],            // [[lineIdx, start], ...] 收集到的匹配（有上限）
    total: 0,
    capped: false,
    current: -1,         // 当前聚焦匹配在 flat 中的全局下标
    globalBaseOf(lineIdx) {
      return this.baseOf && this.baseOf.has(lineIdx) ? this.baseOf.get(lineIdx) : 0;
    },
  };

  function clearHighlights() {
    highlights.byLine = null;
    highlights.baseOf = null;
    highlights.flat = [];
    highlights.total = 0;
    highlights.capped = false;
    highlights.current = -1;
  }

  /* ---------- 3. 搜索 Worker ---------- */
  const worker = new Worker('js/search-worker.js');
  let searchSeq = 0;
  let searchBaseInfo = '';

  worker.postMessage({ type: 'init', lines: texts });

  worker.onmessage = (e) => {
    const data = e.data;
    if (data.type === 'ready') {
      setStatus('搜索 Worker 就绪（' + data.count.toLocaleString() + ' 行已索引）');
      return;
    }
    if (data.type !== 'result') return;
    if (data.id !== searchSeq) return; // 高频输入：丢弃过期结果

    clearHighlights();
    highlights.total = data.total;
    highlights.capped = data.capped;

    if (data.total > 0) {
      const byLine = new Map();
      const baseOf = new Map();
      const flat = highlights.flat;
      const raw = data.matches;
      const qLen = currentQuery.length;
      for (let k = 0; k < raw.length; k += 2) {
        const lineIdx = raw[k];
        const start = raw[k + 1];
        flat.push([lineIdx, start]);
        if (!byLine.has(lineIdx)) {
          baseOf.set(lineIdx, flat.length - 1);
          byLine.set(lineIdx, []);
        }
        byLine.get(lineIdx).push({ start, length: qLen });
      }
      highlights.byLine = byLine;
      highlights.baseOf = baseOf;
      highlights.current = 0;
    }

    searchBaseInfo = data.total === 0
      ? '无结果（' + data.elapsed.toFixed(1) + ' ms）'
      : '共 ' + data.total.toLocaleString() + ' 处，搜索耗时 ' + data.elapsed.toFixed(1) + ' ms' +
        (data.capped ? '，命中过多，仅高亮前 ' + (data.matches.length / 2) + ' 处' : '');
    searchInfo.textContent = searchBaseInfo;

    applyHighlights();
    if (highlights.flat.length > 0) jumpToMatch(0);
  };

  worker.onerror = (err) => setStatus('搜索 Worker 出错：' + err.message);

  let currentQuery = '';
  const doSearch = Util.debounce((query) => {
    currentQuery = query;
    if (!query) {
      searchSeq++;
      clearHighlights();
      searchInfo.textContent = '';
      applyHighlights();
      return;
    }
    searchSeq++;
    worker.postMessage({ type: 'search', id: searchSeq, query });
  }, 200);

  searchInput.addEventListener('input', () => doSearch(searchInput.value.trim()));

  /* ---------- 4. 方案切换 ---------- */
  const env = {
    lines,
    lineHeight: LINE_HEIGHT,
    getHighlights: () => highlights,
  };

  let renderer = null;
  let currentScheme = null;

  function switchScheme(name) {
    if (name === currentScheme) return;
    try {
      if (renderer) renderer.destroy(); // 先彻底 teardown，保证切换不崩
      viewport.innerHTML = '';

      performance.mark('render-start');
      renderer = Renderers[name].create(viewport, env);
      currentScheme = name;

      renderer.ready.then(() => {
        // 等一帧，把首次布局/绘制也算进耗时
        requestAnimationFrame(() => {
          performance.mark('render-end');
          performance.measure('scheme-render', 'render-start', 'render-end');
          setStatus('已切换到「' + name + '」方案');
        });
      });

      applyHighlights(); // 切换后恢复既有搜索高亮
    } catch (err) {
      setStatus('方案切换失败：' + err.message);
      currentScheme = null;
    }
  }

  function applyHighlights() {
    if (renderer && renderer.setHighlights) renderer.setHighlights();
  }

  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-scheme]');
    if (!btn) return;
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    Metrics.resetLongtask();
    switchScheme(btn.dataset.scheme);
  });

  /* ---------- 5. 匹配跳转 ---------- */
  function jumpToMatch(idx) {
    if (highlights.flat.length === 0) return;
    const n = highlights.flat.length;
    highlights.current = ((idx % n) + n) % n;
    const lineIdx = highlights.flat[highlights.current][0];
    applyHighlights(); // 更新 current 样式
    renderer.scrollToLine(lineIdx);
    searchInfo.textContent = searchBaseInfo +
      '　▸ 第 ' + (highlights.current + 1) + '/' +
      (highlights.capped ? highlights.flat.length + '+' : highlights.total) + ' 处';
  }

  document.getElementById('prevMatch').addEventListener('click', () => jumpToMatch(highlights.current - 1));
  document.getElementById('nextMatch').addEventListener('click', () => jumpToMatch(highlights.current + 1));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') jumpToMatch(highlights.current + (e.shiftKey ? -1 : 1));
  });

  /* ---------- 6. 启动 ---------- */
  Metrics.init();
  Metrics.start();
  switchScheme('virtual');
})();
