/* 确定性伪随机文本生成器：生成约 100 万字、按行切分的语料 */
(function (global) {
  'use strict';

  var ZH = [
    '性能优化', '渲染管线', '虚拟滚动', '长列表', '浏览器', '主线程', '事件循环',
    '内存泄漏', '重排重绘', '合成层', '帧率', '长任务', '用户体验', '首屏时间',
    '数据结构设计', '搜索引擎', '高亮显示', '分页加载', '画布绘制', '文本节点'
  ];
  var EN = [
    'render', 'scroll', 'canvas', 'worker', 'performance', 'memory', 'layout',
    'viewport', 'throttle', 'debounce', 'highlight', 'search', 'frame', 'dom'
  ];
  var PUNCT = ['，', '。', '；', '、', '：', '？', '！', ' '];

  /* LCG，保证每次生成的语料一致，便于对比 */
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function pick(rng, arr) {
    return arr[(rng() * arr.length) | 0];
  }

  function makeSentence(rng) {
    var parts = [];
    var n = 3 + ((rng() * 6) | 0);
    for (var i = 0; i < n; i++) {
      parts.push(rng() < 0.7 ? pick(rng, ZH) : pick(rng, EN));
      if (rng() < 0.8) parts.push(pick(rng, PUNCT));
    }
    return parts.join('');
  }

  /**
   * 生成约 targetChars 个字符的文本。
   * @returns {{ lines: string[], charCount: number }}
   */
  function generate(targetChars) {
    var rng = makeRng(20260930);
    var lines = [];
    var total = 0;
    while (total < targetChars) {
      var line = '';
      var want = 40 + ((rng() * 80) | 0); // 每行 40~120 字
      while (line.length < want) line += makeSentence(rng);
      lines.push(line);
      total += line.length;
    }
    return { lines: lines, charCount: total };
  }

  global.TextGen = { generate: generate };
})(window);
