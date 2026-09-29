/* 渲染器共享工具：行内高亮构建、匹配列查找 */
(function (global) {
  'use strict';

  var LINE_H = 28; // 与 CSS --line-height 保持一致

  /* 把一行文本渲染为 DOM（行号 + 文本 + <mark> 高亮），仅处理单行，开销可控 */
  function fillLineEl(el, lineIndex, text, query) {
    el.textContent = '';
    var ln = document.createElement('span');
    ln.className = 'ln';
    ln.textContent = lineIndex + 1;
    el.appendChild(ln);

    if (!query) {
      el.appendChild(document.createTextNode(text));
      return;
    }
    var lower = text.toLowerCase();
    var q = query.toLowerCase();
    var pos = 0;
    var idx = lower.indexOf(q, pos);
    while (idx !== -1) {
      if (idx > pos) el.appendChild(document.createTextNode(text.slice(pos, idx)));
      var mark = document.createElement('mark');
      mark.textContent = text.slice(idx, idx + q.length);
      el.appendChild(mark);
      pos = idx + q.length;
      idx = lower.indexOf(q, pos);
    }
    if (pos < text.length) el.appendChild(document.createTextNode(text.slice(pos)));
  }

  /* 找出一行内所有匹配的起始列（仅用于可视行，调用方控制数量） */
  function findMatchCols(text, query) {
    var cols = [];
    if (!query) return cols;
    var lower = text.toLowerCase();
    var q = query.toLowerCase();
    var idx = lower.indexOf(q);
    while (idx !== -1) {
      cols.push(idx);
      idx = lower.indexOf(q, idx + q.length);
    }
    return cols;
  }

  global.RenderCommon = {
    LINE_H: LINE_H,
    fillLineEl: fillLineEl,
    findMatchCols: findMatchCols
  };
})(window);
