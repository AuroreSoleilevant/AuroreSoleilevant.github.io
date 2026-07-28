# `fade.js` 外链加载与可见性协议记录

审计与实施日期：2026-07-28。本文记录代码事实、已实现的可见性兼容协议和当前外链加载边界；没有改变 HTML、CSS、`fade.js` 内容或完整页面导航模型。

## 结论先行

两个 Loader 现在先安装正文可见性 fallback，再创建一次经典外链脚本 `/js/fade.js`。代码不显式设置 `async`、`defer` 或 preload，也不再以 XHR 取回脚本文本；动态创建的经典脚本采用浏览器默认的异步下载/执行语义。`fade.js` 自身的 `document.readyState` 分支使它无论在 DOMContentLoaded 前后到达，都能登记或直接运行初始化。

但从 `fade.js` 自身的 `document.readyState` 分支可证明：**header/footer fetch、main 淡入、页脚动画和大多数初始化并不要求脚本一定在 DOMContentLoaded 前执行；晚到后仍会主动运行初始化。**

真正需要“同步或极早”保证的是体验而非这些函数的可调用性：

1. CSS 将 `main` 初始设为 `opacity: 0`；若没有极早的可见性路径，冷缓存时会出现更长白屏。
2. 若希望用户第一次可点击的同源链接也有离场淡出，捕获阶段 click 监听应尽早注册。晚到不会破坏导航，只会让极早的一次点击走浏览器默认完整导航。
3. 页面进入时，须让 `fade.js` 与两个 Loader 的 1.2 秒正文 fallback 协调，避免 fallback 先显示正文后，晚到的 `fadeInMain()` 又移除 `loaded` 并触发第二次淡入。

为避免慢网时的二次淡入，本轮先前建立的可见性状态协议保持不变：fallback 已显示正文后，晚到的 `fade.js` 只接管完整生命周期，不再移除 `loaded`。这使 Loader 外链加载可以保持故障降级，而不改变正常淡入时长。

## 已实现的共享状态协议

两个 Loader 和 `fade.js` 共同使用每个文档新建的 `window.__mainVisibilityState`：

| 字段 | 写入者 | 含义 |
| --- | --- | --- |
| `fallbackShown` | Loader fallback | 仅当 1.2 秒 timer 实际为未显示的 main 添加 `loaded` 时设为 `true` |
| `leaving` | `fade.js` | 同源离场开始或 beforeunload 时设为 `true`，阻止 fallback、rAF 与 retry 重新显示正文 |

Loader 只有在真正强制显示正文时才记录 `fallbackShown`，并沿用 `main:visible` 事件。若正常 `fade.js` 先完成，既有 `main:visible` 会取消 timer，状态不会被误标。`fadeInMain()` 发现 `fallbackShown` 且 main 已有 `loaded` 时直接返回，不再 remove/add class；header/footer、点击拦截、pageshow 和其他入口已在同一脚本初始化时照常继续运行。

在离场路径，`notifyMainLeaving()` 和 beforeunload 都标记 `leaving`；`fadeInMain()` 的入口、双 rAF 与两层 retry 都检查它。BFCache 的 persisted pageshow 会清除此文档旧的 `fallbackShown`，让离场前移除的 main 可以按现有恢复路径重新进入；普通初次 pageshow 保留该状态，避免晚到 fade 在 fallback 后再次淡入。

## 当前职责分区

| 区域 | 代码位置 | 注册时机 | 执行时机与 DOM | 是否必须解析期间存在 |
| --- | --- | --- | --- | --- |
| 配置、状态、导航缓存 | `fade.js:2-26` | 脚本执行时 | 无 DOM；服务后续函数 | 否 |
| footer 进入/退出工具 | `28-35`、`80-113` | 脚本执行时定义 | 需要 `.site-footer`；使用 rAF、强制重排、transition | 否；footer 本身由 fetch 后才存在 |
| transition 时长 | `37-58` | 按导航请求 | 需要 main/footer 的计算样式 | 否 |
| DOM 查询与自定义事件 | `60-78` | 函数定义时 | main/header/footer；派发 `main:visible`、`main:leaving` | 函数定义不需要；首次 `main:visible` 要早于 Loader fallback 计时器 |
| main 淡入与内部重试 | `115-175` | DOM 就绪回调、pageshow | 需要 `main`；双 rAF 后加 `loaded`，120ms 验证、一次 20ms 重试和最终强制显示 | 不要求在解析期执行；但应尽量紧邻 DOM 就绪以避免 CSS 初始透明过久 |
| 导航清理与等待 | `177-221` | 点击后 | 需要 main 的 `transitionend`；480ms 左右的 timeout 兜底（当前主过渡 400ms + 80ms） | 否；只需在用户点击前注册 |
| 同源链接识别与拦截 | `223-272`，监听注册 `493-495` | 脚本执行时注册 capture listener | 需要被点击的 `<a>`、main、可选 footer | 不是功能正确性的同步要求；晚到的窗口只会失去一次离场动画 |
| footer 图片等待和事件 | `274-328` | footer 插入后 | 需要 footer；等图片 load/error 或 2 秒 timeout，派发 `footer:inserted` | 否 |
| footer fetch/插入/重试 | `330-380` | `onDOMReadyInit()` | 需要 `#footer-placeholder`；fetch 后插入，MutationObserver 监听被清空 | 否；占位在 body，DOM 就绪后才可靠存在 |
| header fetch/插入/重试 | `382-444` | `onDOMReadyInit()` | 需要 `#header-placeholder`；fetch 后派发 `header:inserted` | 否；同上 |
| DOM 生命周期入口 | `446-464` | 脚本执行时依据 readyState 选择监听或直接调用 | DOM 就绪后准备 footer、启动 main、发起两个 fetch | 仅“想在 DCL 时立即开始”时需要提前登记；晚到有直接调用路径 |
| BFCache / pageshow | `466-491` | 脚本执行时注册 | 恢复 main、footer，清理悬挂导航 | 应在未来 pageshow 前注册；不是初始解析的硬要求 |
| beforeunload / 外部接口 | `493-513` | 脚本执行时注册/导出 | 清理导航等待；导出 header/footer 重取函数 | 应在未来卸载前注册；未发现仓库内消费者使用导出函数 |

两个共享占位在全部 284 个公开页面中均存在。header/footer 的 fetch 只会在 `onDOMReadyInit()` 中开始（`446-458`），不是同步 XHR 的一部分。

## 五种生命周期时间线

### 1. 冷缓存地址栏直接进入

```text
HTML 解析到 Loader（head）
  -> Loader 初始化可见性状态并登记 DOMContentLoaded fallback
  -> Loader 创建一次外链 fade.js script
  -> fade.js 若已下载且 readyState=loading，则登记 DOMContentLoaded、capture click、pageshow、beforeunload
HTML 继续解析，body/main/header/footer 占位出现
DOMContentLoaded
  -> Loader fallback 开始 1.2s 计时
  -> 若 fade.js 已到达，其 onDOMReadyInit 运行
  -> 准备 footer 初态；下一帧安排 fadeInMain
  -> 开始 header/footer 两个异步 fetch（cache: no-cache）
两次 rAF
  -> fadeInMain 添加 main.loaded，派发 main:visible，取消 Loader fallback
header fetch 完成 -> 插入 header -> 下一任务派发 header:inserted
footer fetch 完成 -> 插入 footer -> 等图片 load/error 或 2s -> footer enter / footer:inserted
```

DOM 可交互不必等待 header/footer fetch；它们是后续异步片段。`main.loaded` 的正常进入路径是 DOMContentLoaded 后双 rAF，而不是 `load`。

### 2. 温缓存进入

源码流程不变：两个 fragment fetch 仍带 `cache: no-cache`。温缓存可能让外链 fade.js、fragment、连接和图片 `complete` 状态更快完成；代码没有单独的“温缓存分支”。若 footer 图片已 `complete`，`notifyFooterInserted()` 立即得到 resolved Promise；header 事件仍经 `setTimeout(..., 0)` 派发。

### 3. 站内链接跳转

```text
用户点击同源、非 hash、非 _blank、非 download 链接
  -> document capture click 监听器（493-495）先检查 URL（223-250）
  -> preventDefault()
  -> 派发 main:leaving（267）
  -> 移除 main.loaded（268），正文按 CSS 0.4s 淡出
  -> footerExit() 加 slide-down（269），footer 向下离场
  -> 按 main/footer 最大 transition 时长登记 transitionend
  -> 同时登记 wait + 80ms timeout（199-221）
  -> 任一有效 main transitionend 或 timeout 先到达
  -> 清理 listener/timer，并以 window.location.href 完整导航（179-197）
```

顶栏不属于 main，也没有在此等待或离场；旧文档会一直显示到浏览器切换文档。

### 4. 后退、前进与 BFCache

- 若浏览器重新加载文档：走上面的地址栏流程。
- 若 BFCache 恢复：既有 JS 堆与 DOM 恢复，`pageshow` 监听（466-491）执行。它不检查 `ev.persisted`，所以初次 pageshow 和 BFCache pageshow 都会执行同一恢复序列：清 `isTransitioning`、再次 `fadeInMain()`、清理导航 timer/listener，并恢复/重触发 footer enter。
- `pageshow` 不重新调用 `fetchAndInsertHeader()` 或 `fetchAndInsertFooter()`；这符合 BFCache 中 DOM 已保留的假设。

### 5. fade.js 完全加载失败

若外链 fade.js 请求失败，Loader 的 error 监听会记录错误，已安装的正文 fallback 仍会在 DOMContentLoaded 后约 1.2 秒给未加载的 main 添加 `loaded`，故正文最终可见。

仍会损失：header/footer fetch 与插入、页脚进出场、同源链接离场动画、`main:visible`/`main:leaving`/header/footer 自定义事件、BFCache 恢复与导出的重取函数。fallback 本身不派发 `main:visible`。

## 同步依赖证明

### 必须在 DOMContentLoaded 前注册的内容

严格来说，没有一个 `fade.js` 函数因为“错过 DOMContentLoaded 就无法运行”：`460-464` 在 DOM 已完成时会直接调用 `onDOMReadyInit()`。

若要维持当前首帧体验，则以下需要**极早**而非逻辑上绝对同步：

1. 正文进入调度：`main` 初始为 `opacity: 0`（`style.css:381-392`）。晚到会延长空白；现有 1.2 秒 fallback 只保证最终可见，不保证当前进入时机或动画。
2. 点击捕获：用户在监听器登记前点击同源链接时，浏览器执行默认完整导航。URL 与功能仍正确，但该次没有正文/页脚离场动画。因为 main 的透明不阻止指针事件、且 header/正文可在脚本晚到前出现，所以这个窗口理论上存在。
3. 未来 `pageshow`、`beforeunload`：必须在相应事件发生前登记；常规页面生命周期有足够时间，但这不是 DCL 专属要求。

### 可以在 DOMContentLoaded 后执行的内容

- `onDOMReadyInit()`：readyState else 分支直接调用。
- `fadeInMain()`：需要 main，DOM 完成后更可靠；其内部已有重试与最终加 class。
- header/footer fetch、插入、图片等待、MutationObserver 和事件派发：均依赖 body 内占位，放在 DOM 就绪后正合适。
- footer enter/exit 工具、transition 时长读取、导航 timer：只在相应元素或用户点击存在时需要。
- 导出的 `__fetchAndInsertFooter` / `__fetchAndInsertHeader`：未发现仓库内调用者。

## 最小同步启动核心（设计建议）

这不是新的文件划分；本轮已在两个 Loader 与 `fade.js` 中实现其中的状态握手，尚未拆出独立启动文件。

```text
必须同步 / 极早执行
------------------
- 监听 DOMContentLoaded 或在已完成时立即运行的 main 首次可见性调度。
- 一个共享、可读取的“main 已由 fallback 显示”状态，避免晚到生命周期脚本重新移除 loaded。
- 若要保证首个可点击同源链接有动画：capture click 注册。

可以普通加载
------------
- header/footer fetch、插入、图片等待、footer 动画。
- URL 判定、transition 时长计算、导航 timer 的具体实现。
- header/footer 的 MutationObserver、全局重取接口。

可以 DOM 就绪后初始化
---------------------
- main 查询、footer 初态、fadeInMain 的 rAF 序列。
- header/footer DOM 操作与自定义事件。
```

建议边界仍不是立刻新增 `startup-visibility.js`。若未来拆分，应让极早核心只保存 main 生命周期状态并派发稳定信号；完整 `fade.js` 消费该状态而不得重复淡入。当前协议已避免把 Loader fallback 与 fade.js 变成两套互相覆盖的可见性逻辑。

## 路线比较

| 路线 | 优点 | 风险 / 结论 |
| --- | --- | --- |
| A. 保持整体同步（历史方案） | 脚本解析期立即执行 | 同步 XHR 阻塞解析，且不再是当前实现 |
| B. Loader 动态外链（当前方案） | 不改 284 个 HTML，header/footer 的 readyState 路径仍可工作，不再阻塞 HTML 解析 | 慢网可能使 main 在 fallback 前保持透明；状态协议已阻止 fallback 后二次淡入；脚本到达前的首次点击仍可能走浏览器默认导航 |
| C. 解析器管理的 defer | 浏览器提供 DCL 前的稳定执行语义 | 当前 HTML 没有直接引用 fade.js；若逐页加 script，涉及 284 页并扩大 URL/模板维护范围，不推荐作为第一步 |
| D. 最小启动核心 + 生命周期脚本 | 可把“首帧可见性”与 header/footer/导航实现分开；可测试和回滚 | 需明确状态握手，避免与现有 Loader fallback 重复；可能新增请求或重复代码。最有前景，但先做幂等准备实验 |
| E. header/footer 从 fade.js 分离 | 未来可降低 fade 文件职责 | 不是让同步 XHR 退休的前提；header/footer 本来就在 DCL 后 fetch，应在可见性路线验证后独立评估 |

## fallback 关系

两个 Loader 的 fallback 在 `DOMContentLoaded` 后启动 1.2 秒 timer；正常 `fade.js` 在双 rAF 后通过 `main:visible` 取消它。离场时 `main:leaving` 也会取消它。

若未来 `fade.js` 动态外链且晚于 1.2 秒：

1. fallback 会先直接添加 `loaded`，正文可见；
2. fallback 记录 `fallbackShown`、派发 `main:visible`，再清理短生命周期监听器；
3. 晚到的 `fadeInMain()` 识别 `fallbackShown` 且 main 已可见时不会 remove `loaded`，不会再触发一次淡入；
4. `leaving` 同时阻止 fallback、rAF 与 retry 在离场时重新显示正文。

因此，当前 fallback 能与晚到的外链 fade 协作；冷缓存、慢网、阻断脚本和 BFCache 的浏览器验证仍是保留或简化机制前的前提。任何删除 fallback 的讨论都必须等这些验证通过后再进行。

## 冗余与保留审计

### 必须保留（当前证据）

- main 的 transitionend + timeout 双通道：transition 事件可能不触发，timeout 保证 `location.href` 最终执行。
- header/footer 插入前后的存在性检查：避免重复插入，且支持占位被外部清空后的重取。
- footer 图片 load/error 与 2 秒 timeout：避免 footer 因资源失败永久停在初始态。
- pageshow 的导航 timer/listener 清理：BFCache 恢复需要取消旧导航状态。
- Loader 的 1.2 秒 fallback：这是 fade 完全失败时唯一已验证的正文可见性保护。

### 可能冗余，需独立验证

- 初始加载同样会触发 pageshow，但 `466-491` 不检查 `ev.persisted`，所以正常 DCL 进入后仍会再次 `fadeInMain()`；这可能重复 main/footer 进入序列，但也可能掩盖某些浏览器恢复时序。
- footer 成功插入时先 `ensureFooterVisible()`（`356-359`），随后 `notifyFooterInserted()` 又置 pre-enter 并调用 `footerEnter()`；其双保险意图明确，是否可合并需视觉测试。
- `notifyFooterInserted()` 的 20ms 成功路径与 40ms catch 路径有相似的 class 清理、进入和事件派发；catch 仍可能承接 then 回调内部异常，不能直接删。
- header/footer 的 MutationObserver 在成功插入后持续观察占位，直到占位被清空才 disconnect；这是恢复保护，也可能是长寿命观察器。

### 明显无仓库消费者但仍需单独验证

- `window.__fetchAndInsertFooter` 与 `window.__fetchAndInsertHeader` 在仓库内没有引用。它们可能供开发者控制台或仓库外页面使用，不能仅凭本仓库搜索删除。

## 下一轮唯一推荐实验

本轮实施后应验证：普通首页、`/autre/moi/`、普通文章、长章节、HHXLOYDCS 入口和 M4R12；各做冷缓存、温缓存、阻断 fade、慢网、地址栏进入、刷新、五次站内跳转、后退/前进与 BFCache。重点观察 main 是否闪回、header/footer 是否仍插入、顶栏、footer、阅读进度与控制台。

下一步不应立即继续改动运行时代码，而应先记录这些浏览器验证结果。若失败，只需回滚两个 Loader 中创建 `/js/fade.js` 外链 script 的独立 diff；不需要改动 HTML、CSS、header/footer 或 `fade.js`。

## 暂不处理

- 不拆分 header/footer。
- 不删除 pageshow、observer、retry 或 timeout。
- 不修改 284 个 HTML 以引入 defer。
- 不因导出函数缺少仓库内引用而删除全局接口。
