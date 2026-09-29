/**
 * 确定性伪随机文本生成器。
 * 生成约 100 万字符的中文+英文混合文本，按"逻辑行"切分（每行 30~90 字符）。
 * 行高固定，便于虚拟滚动 / Canvas 做 O(1) 位置换算。
 */
window.TextSource = (() => {
  const TARGET_CHARS = 1000000;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const ZH = ['性能', '渲染', '滚动', '虚拟', '分页', '画布', '文本', '搜索', '高亮', '内存', '掉帧',
    '采样', '浏览器', '方案', '对比', '长文本', '段落', '主线程', '工作者', '绘制', '流畅', '卡顿',
    '优化', '指标', '耗时', '监控', '交互', '体验', '数据', '结构', '算法', '界面', '用户', '阅读',
    '检索', '跳转', '标记', '缓存', '回收', '压力', '边界', '异常', '输入', '抖动', '切换', '布局',
    '合成', '图层', '帧率', '任务', '队列', '事件', '回调', '空闲', '调度', '视口', '溢出', '节点'];
  const EN = ['render', 'scroll', 'canvas', 'virtual', 'paging', 'search', 'highlight', 'memory',
    'fps', 'worker', 'dom', 'frame', 'layout', 'paint', 'async', 'cache', 'viewport', 'metrics',
    'sample', 'jank', 'idle', 'chunk', 'observer', 'throttle', 'debounce'];
  const PUNCT = ['，', '。', '；', '：', '、', '！', '？'];

  function generate() {
    const rand = mulberry32(20260930);
    const lines = [];
    let total = 0;
    let lineNo = 0;

    while (total < TARGET_CHARS) {
      const sentenceCount = 2 + Math.floor(rand() * 3); // 2~4 句
      let line = '';
      for (let s = 0; s < sentenceCount; s++) {
        const wordCount = 4 + Math.floor(rand() * 7); // 4~10 词
        let sentence = '';
        for (let w = 0; w < wordCount; w++) {
          if (rand() < 0.22) {
            sentence += (sentence && !/[a-z]$/.test(sentence) ? ' ' : '') +
              EN[Math.floor(rand() * EN.length)] + ' ';
          } else {
            sentence += ZH[Math.floor(rand() * ZH.length)];
          }
        }
        sentence = sentence.trim();
        line += sentence + PUNCT[Math.floor(rand() * PUNCT.length)];
        // 行宽控制在 ~85 字符内，配合 nowrap 保证行高恒定且内容基本可见
        if (line.length > 55) break;
      }
      const no = String(lineNo).padStart(6, '0');
      const record = { no, text: line };
      lines.push(record);
      total += line.length + no.length + 2;
      lineNo++;
    }
    return { lines, totalChars: total };
  }

  return { generate, TARGET_CHARS };
})();
