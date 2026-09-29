/**
 * 搜索 Worker：文本只初始化一次，搜索在后台线程执行，不阻塞主线程渲染。
 * 结果上限 MAX_COLLECT 条（防止高亮过多拖垮渲染），但 total 会统计全部命中数。
 */
let lines = [];

const MAX_COLLECT = 2000;

self.onmessage = (e) => {
  const data = e.data;

  if (data.type === 'init') {
    lines = data.lines;
    self.postMessage({ type: 'ready', count: lines.length });
    return;
  }

  if (data.type === 'search') {
    const t0 = performance.now();
    const query = data.query;
    const matches = []; // [lineIndex, start] 扁平数组，减少结构化克隆开销
    let total = 0;

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      let idx = 0;
      while ((idx = text.indexOf(query, idx)) !== -1) {
        total++;
        if (matches.length < MAX_COLLECT * 2) {
          matches.push(i, idx);
        }
        idx += query.length;
      }
    }

    self.postMessage({
      type: 'result',
      id: data.id,
      total,
      capped: total > MAX_COLLECT,
      matches,
      elapsed: performance.now() - t0,
    });
  }
};
