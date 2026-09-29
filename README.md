# 百万字长文本渲染方案对比

纯原生 Web 技术（DOM / Canvas / Web Worker / requestAnimationFrame / PerformanceObserver），
无任何框架与构建步骤，对比四种超大文本渲染方案的实际性能。

## 运行

Web Worker 要求 HTTP 环境，不能直接双击打开：

```bash
cd 本目录
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 四种方案

| 方案 | 原理 | 预期表现 |
|---|---|---|
| 整段渲染 | 全部 1 万+ 行进入 DOM（分帧挂载防卡死） | 渲染最慢、DOM 节点爆炸、内存最高 |
| 分页渲染 | 每页 300 行，翻页切换 | DOM 恒定，但无法连续滚动、搜索跳转要翻页 |
| 虚拟滚动 | 只渲染可视区 ± 缓冲行，节点池复用 | 渲染快、滚动流畅、内存不随滚动增长 |
| Canvas 绘制 | DOM 仅 1 个 `<canvas>`，文本逐帧绘制 | DOM 开销为零，但失去原生选择/无障碍能力 |

## 功能

- **搜索**：Web Worker 执行（语料 init 时传入一次，之后只传关键词），
  输入防抖 250ms，过期任务自动丢弃，返回总匹配数与命中行号（Uint32Array 零拷贝）。
- **高亮**：DOM 方案仅高亮已渲染的行；整段渲染截断为前 300 行，防止阻塞；
  Canvas 仅对可视行做 `measureText` 定位。
- **跳转**：上一个/下一个匹配（↑↓ 按钮或回车）、行号跳转。
- **指标**：渲染耗时、FPS（rAF 采样，窗口 250/500/1000/2000ms 可调）、
  JS 堆内存（`performance.memory`，仅 Chromium）、DOM 节点数、
  长任务计数（`PerformanceObserver` longtask）、搜索耗时。

## 关键约束的实现方式

- 100 万字不一次性进 DOM：整段渲染按 400 行/帧分批挂载，其余方案天然只渲染局部。
- 搜索 < 1s：Worker 离线程执行，实测 100 万字全量扫描约 1~2ms。
- 滚动不掉帧：滚动监听全部 `passive` + rAF 节流，虚拟滚动用 `transform` 平移。
- 内存不随滚动增长：虚拟滚动节点池复用，Canvas 只有 1 个 DOM 节点。
- 高亮不阻塞：只处理可视行，整段渲染硬上限 300 行。
- 方案切换不崩：每个渲染器实现 `mount/unmount`，卸载时移除全部监听器并清空容器。

## 目录

```
index.html              页面骨架
css/style.css           样式
js/textgen.js           确定性伪随机语料生成（约 100 万字 / 1 万余行）
js/metrics.js           FPS / 内存 / 长任务采样
js/search-worker.js     搜索 Worker
js/renderers/common.js  行内高亮等共享工具
js/renderers/full.js    方案一：整段渲染
js/renderers/paged.js   方案二：分页渲染
js/renderers/virtual.js 方案三：虚拟滚动
js/renderers/canvas.js  方案四：Canvas 绘制
js/app.js               主控：切换、搜索调度、跳转、指标上报
```
