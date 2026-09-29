/* 搜索 Worker：语料只在 init 时传入一次，之后每次搜索仅传关键词。
   返回：总匹配次数 + 命中行号数组（Uint32Array， transferable，零拷贝）。 */
'use strict';

var lines = [];
var lowerLines = [];

self.onmessage = function (e) {
  var data = e.data;

  if (data.type === 'init') {
    lines = data.lines;
    lowerLines = new Array(lines.length);
    for (var i = 0; i < lines.length; i++) {
      lowerLines[i] = lines[i].toLowerCase();
    }
    self.postMessage({ type: 'ready' });
    return;
  }

  if (data.type === 'search') {
    var jobId = data.jobId;
    var query = (data.query || '').toLowerCase();
    if (!query) {
      self.postMessage({ type: 'result', jobId: jobId, count: 0, lines: new Uint32Array(0) });
      return;
    }
    var matched = [];
    var count = 0;
    for (var i = 0; i < lowerLines.length; i++) {
      var s = lowerLines[i];
      var idx = s.indexOf(query);
      if (idx === -1) continue;
      matched.push(i);
      while (idx !== -1) {
        count++;
        idx = s.indexOf(query, idx + query.length);
      }
    }
    var arr = new Uint32Array(matched);
    self.postMessage(
      { type: 'result', jobId: jobId, count: count, lines: arr },
      [arr.buffer]
    );
  }
};
