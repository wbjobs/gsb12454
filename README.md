# 百万字长文本渲染方案对比

纯原生 Web 技术（无框架）实现的超大文本渲染性能对比 Demo。
加载约 100 万字（~1.45 万行）文本，横向对比四种渲染方案，并实时量化性能指标。

## 运行

Web Worker 要求通过 HTTP 访问，不能直接双击打开 `index.html`：

```bash
cd 本目录
python3 -m http.server 8000
# 打开 http://localhost:8000 （内存指标仅 Chromium 系浏览器提供）
```

## 四种方案

| 方案 | 原理 | DOM 规模 | 优点 | 代价 |
|------|------|----------|------|------|
| 整段渲染 | 全部行一次性进 DOM（rAF 分块防卡死） | ~1.5 万节点，常驻 | 实现简单、可原生 Ctrl+F | 内存/节点数失控，滚动掉帧（反面基线） |
| 分页渲染 | 每页 200 行，翻页切换 | 恒定 ~200 节点 | 内存最省、实现简单 | 无法连续滚动，跳转需翻页 |
| 虚拟滚动 | 只渲染视口 ±overscan 的行，占位元素撑高度 | 恒定 ~50 节点 | 滚动流畅、可选中复制 | 实现较复杂，依赖固定行高 |
| Canvas 绘制 | 1 个 sticky canvas，按 scrollTop 重绘可见行 | 恒定 3 节点 | DOM 最少、绘制快 | 文本不可选中、无障碍差 |

## 性能指标（实时采样，间隔可调 250/500/1000/2000ms）

- **渲染耗时**：`performance.mark/measure` + `PerformanceObserver('measure')`
- **FPS**：`requestAnimationFrame` 计数，按采样间隔聚合
- **JS 堆内存**：`performance.memory`（仅 Chromium）
- **DOM 节点数**：视口容器内元素总数
- **长任务**：`PerformanceObserver('longtask')`，>50ms 的主线程任务计数

## 搜索与高亮

- 搜索在 **Web Worker** 中执行（`indexOf` 全量扫描，实测 <10ms），不阻塞主线程
- 输入 200ms **防抖** + 过期结果按序号丢弃，应对高频输入
- 高亮上限 2000 处（超出仅统计总数），防止高亮过多拖垮渲染
- 整段渲染方案的高亮按 rAF 分块写入，不阻塞渲染
- `↑`/`↓` 按钮或 Enter / Shift+Enter 在匹配间跳转，当前匹配红色高亮

## 关键设计

- **固定行高（26px）+ 逻辑行模型**：虚拟滚动与 Canvas 的位置换算为 O(1)
- **rAF 节流**：滚动事件每帧最多触发一次重绘；起始行未变时虚拟滚动直接跳过重绘
- **方案切换**：先 `destroy()`（移除监听、断开 ResizeObserver、中止分块任务）再重建，切换不崩
- **内存可控**：分页/虚拟滚动/Canvas 的 DOM 规模与滚动位置无关，不随滚动线性增长

## 文件结构

```
index.html            页面骨架（方案切换 / 搜索 / 指标面板）
css/style.css         样式
js/text-source.js     确定性伪随机文本生成（100 万字）
js/search-worker.js   搜索 Worker
js/metrics.js         FPS / 内存 / 长任务 / 渲染耗时采样
js/util.js            转义、高亮拼接、防抖、rAF 节流
js/renderers/full.js      整段渲染
js/renderers/paged.js     分页渲染
js/renderers/virtual.js   虚拟滚动
js/renderers/canvas.js    Canvas 绘制
js/main.js            主控（方案切换、搜索调度、跳转）
```
