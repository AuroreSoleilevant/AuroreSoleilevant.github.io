# 加载体系与前端分层说明

这份文档面向未来维护者。它记录目前的加载事实，并规定新增功能时的放置方式；它不是一次重构计划。网站仍是原生 HTML、CSS、JavaScript 的静态站点，公开 URL、完整页面导航、现有视觉与交互都是优先约束。

## 先读这一节

- 页面不是 SPA。站内跳转最终仍是完整文档导航。
- 普通页面入口是 `/js/common-head.js`；`HHXLOYDCS` 特殊主题入口是 `/js/special/common-head-peur.js`。
- 不要为了“现代化”把加载器改成框架、ES module 或 fetch 替换页面；这类变更必须单独设计和验证。
- 不要把一个功能简单塞进全站加载器。先判断它是否真的需要所有页面。
- 任何改变加载顺序、`main.loaded`、页眉、页脚、章节 URL 或导航关系的改动，都要先做人工视觉回归。

## 当前页面加载流程

### 普通页面

HTML 在 `<head>` 解析到经典脚本 `/js/common-head.js` 时立即执行。加载器当前按以下顺序工作：

1. 先安装正文可见性降级保护，再由 Loader 创建经典外链脚本 `/js/fade.js`；它只在 `fade.js` 未正常把正文显示出来时生效。
2. 由 Loader 创建经典外链脚本 `/js/img.js`；该 IIFE 自行判断 DOM 状态并登记图片任务，实际处理会在 DOMContentLoaded 后的 idle/timeout 阶段开始。
3. 动态插入字体 preload、全局样式、吉祥物样式和站点图标。
4. 动态插入共享功能脚本：`mots.js`、`backtop.js`、`blink.js`、`headtran.js`、`mascot.js`。
5. DOM 就绪后，Loader 只在页面同时存在 `[data-progress-start]` 与 `[data-progress-end]` 时，先加载 `progression.css`，再加载 `progression.js`。
6. HTML 继续解析；各功能脚本自行等待 DOM、header、footer 或图片等条件。

普通加载器中“按数组插入”的顺序是脚本标签插入顺序。它们是动态创建的经典脚本，默认按下载完成异步执行；给这类脚本设置 `defer` 不会获得解析器发现的 `<script defer>` 顺序语义，故 Loader 不设置该属性。功能脚本也不再在紧邻 script 注入前插入 preload：同一段同步代码没有可利用的解析器抢跑窗口，且额外高优先级请求会与更早的基础资源竞争。未来代码不能把数组位置当成浏览器一定按完成顺序执行的承诺。若两个功能存在严格先后依赖，应在代码中明确等待 `load`、事件或 Promise，而不是依赖数组位置。

当前这组功能脚本没有彼此的严格执行顺序契约：`mots.js` 只检查 main/可选 `#count`；`backtop.js` 可等待晚到 footer；`blink.js` 与 `headtran.js` 等待 `header:inserted`；`mascot.js` 只依赖自身 DOM 与资源。因此保持并行动态注入，不增加串行 Loader。

### 全局 CSS 与字体资源

两个 Loader 都在解析器执行入口脚本期间、body 解析前动态插入 link：先是 latin/cjk 两个字体 preload，再是 `/css/style.css?v=191025.1`，随后普通页插入 `/css/mascot.css`，特殊页插入 `/css/special/style_peur.css`，最后是图标。特殊覆盖在全局样式之后进入 DOM，故 CSS 级联顺序稳定；普通 Loader 不插入特殊 CSS，特殊 Loader 不插入 mascot CSS。页面自身后续的组件 CSS 仍由 HTML 或页面专属 Loader 另行插入。

`style.css` 的三个 `@font-face` 都使用 `LXGWWenKai`：latin 与 cjk 的 WOFF2 URL、`font/woff2` 类型和匿名 CORS preload 配置完全对应，且这两类字形由全站排版使用；ext WOFF2 仅在 CSS unicode-range 命中扩展汉字时请求，故不作全站 preload。当前没有重复、失配或页面族误加载的 link。由于基础样式 link 会在 body 出现前插入，且 stylesheet 本身已有浏览器的样式优先级，没有静态证据支持改变顺序或额外提权；冷缓存 FOUC/字体切换仍应以浏览器人工检查确认。

### `HHXLOYDCS` 特殊主题页面

特殊页面用 `/js/special/common-head-peur.js`，流程与普通入口的基础部分相同：先安装正文可见性保护，再由 Loader 加载 `fade.js` 和 `img.js`，动态插入字体与基础样式，然后动态插入 `mots.js`、`backtop.js`、`blink.js`、`headtran.js`。只有同时具备两个阅读进度锚点的页面才会额外加载 progression；当前 `HHXLOYDCS` 页面没有完整锚点，故不会请求该资源。

它额外载入 `/css/special/style_peur.css`，但不载入 `mascot.js` 或 mascot CSS。特殊页面还在各自 HTML 中直接载入 `giscus-peur.js`；这不是特殊加载器的延迟脚本。

### `fade.js` 的生命周期

`fade.js` 是共享的生命周期脚本：

- 在 DOM 就绪后，给 `main` 加上 `loaded`，触发现有正文淡入。
- 通过 fetch 把 `outil/header.inc/index.html` 和 `outil/footer.inc/index.html` 填入静态占位节点。
- 页眉插入后派发 `header:inserted`；`blink.js` 依赖它。
- 拦截符合条件的同源链接：移除 `main.loaded`、触发页脚离场，再以 `location.href` 完整导航。
- 在 `pageshow`（包括 BFCache 恢复）时重新同步正文和页脚状态。

它不是业务功能放置处。不要在 `fade.js` 增加文章、故事、评论、组件或页面专属规则。

## 文字版依赖图

```text
普通 HTML（经典 common-head.js）
├── Loader 外链脚本：fade.js ──┬── main.loaded / 完整页面导航
│                  ├── fetch header.inc ──> header:inserted ──> blink.js
│                  └── fetch footer.inc ──> backtop.js 可计算页脚偏移
├── Loader 外链脚本：img.js ─> DOMContentLoaded / idle 后处理 img 与 .bg-image
├── 动态共享功能
│   ├── mots.js ───────> main、可选 #count
│   ├── backtop.js ────> main/body、可选 footer、可选 giscus 容器
│   ├── blink.js ──────> header:inserted 或已有 .nav-item
│   ├── headtran.js ───> .site-header、滚动、完整导航
│   └── mascot.js ─────> 普通桌面页面、body/main 挂载点、吉祥物资源
├── DOM 能力检测（同时有 start/end 锚点）
│   └── progression.css load/error ──> progression.js
└── 普通故事 HTML（额外 common-his.js）
    ├── 动态 CSS：intro.css、chapters-sidebar.css、chapter-nav.css
    └── 串行动态 JS：chapters-sidebar.js → chapter-nav.js
        ├── sidebar：URL、/json/histoire/<作品 ID>.json、main/body
        └── nav：URL、同一 JSON、#chapter-nav-root、章节侧栏按钮
            └── 两组件通过页面级 `window.__chapterJsonRequests` 复用进行中或已完成的原始 JSON 请求

HHXLOYDCS HTML（special/common-head-peur.js）
├── 与上方共享：Loader 外链 fade.js、Loader 外链 img.js、mots.js、backtop.js、blink.js、headtran.js
├── 阅读进度：只有完整 start/end 锚点时加载；当前特殊页面全部跳过
├── 特殊覆盖：css/special/style_peur.css
└── 页面专属：giscus-peur.js、分支 HTML、图片与音频
```

### 依赖关系速查

| 脚本 | 主要依赖 | 不依赖 / 不应依赖 |
| --- | --- | --- |
| `fade.js` | `main`、header/footer 占位、同源链接 | 作品 JSON、章节 DOM、吉祥物 |
| `img.js` | 启动时快照中的 `document.images`；当前 `.resp-img` 会获得 `loaded` 入场类 | header、footer、章节 JSON、其他脚本 API |
| `headtran.js` | 已有 `.site-header` 或 `header:inserted`、滚动状态 | footer、故事数据 |
| `blink.js` | 已有 `.nav-item` 或 `header:inserted`；重插入时重新绑定新节点 | footer、章节系统 |
| `backtop.js` | main/body、可选 footer、可选评论容器 | header、章节 JSON |
| `progression.js` | 同时存在起点与终点 data 属性；Loader 先加载对应 CSS，脚本立即单次初始化 | header、footer、作品 JSON |
| `mots.js` | main、可选 `#count`；DOM 就绪后单次统计，无目标时安静退出 | header、footer |
| `chapters-sidebar.js` | 故事 URL、作品章节 JSON、main/body | header、footer |
| `chapter-nav.js` | 故事 URL、作品章节 JSON、`#chapter-nav-root` 或 body、侧栏切换按钮 | header、footer |

## JavaScript 分层规范

### Loader 层

文件：`common-head.js`、`special/common-head-peur.js`、`common-his.js`。

负责：加载共享资源、选择页面族所需资源、建立最小的启动/降级边界。

禁止负责：业务数据处理、章节顺序计算、评论逻辑、具体组件 DOM、视觉细节，或隐含地修复其他脚本的竞态。

规则：

- 普通与特殊入口必须维持为不同页面族的明确入口。
- 新脚本只有在“所有该入口覆盖的页面都需要它”时才可加入入口。
- 有严格依赖的动态脚本必须明确等待前一个脚本完成；不要只靠数组顺序。
- 加载器不能重复注入同一资源；任何新增 fallback 必须可清理且有唯一 guard。
- 新增 Loader 级脚本默认使用外链脚本，不得以同步 XHR 取回后以内联脚本执行。应声明失败后的降级边界；首屏可见性等关键状态应通过明确状态/事件协作，而不是叠加任意延迟。
- 页面专属功能优先以明确 DOM 能力标记按需加载；禁止在 Loader 维护 URL 页面名单。

### Lifecycle 层

文件：`fade.js`。

负责：正文进入/离开、完整页面导航、header/footer 片段插入、`pageshow` 恢复和对应可靠性边界。

禁止：页面业务、章节 JSON、评论、卡片、标签、吉祥物和特殊主题内容。

新需求若同时影响普通与特殊页面的“页面何时可见、何时离开”，才可能属于这一层；否则优先放到功能或组件层。

### Feature 层

文件示例：`img.js`、`mots.js`、`progression.js`、`chapter-nav.js`、`chapters-sidebar.js`、`list.js`、`catalogue.js`、`tag.js`、`page-number.js`、`tagflow.js`。

负责：明确的页面能力与对应数据/DOM，例如图片增强、字数、阅读进度、列表、标签、章节目录和章节前后导航。

`list.js` 暴露当前唯一跨脚本业务 API `window.CoreList`：`mountList` 供 `catalogue.js` 使用；`_loadDatabases`、`_sortEntries`、`_paginate` 与 `_createTile` 供 `tag.js` 组合标签筛选结果。`page-number.js` 只根据 URL 和固定页数配置创建分页控件，不参与数据加载；`tagflow.js` 独立服务首页标签流。

规则：

- 章节功能继续放在章节专属脚本与 `common-his.js` 链路中，不放入全站加载器。
- 功能脚本应先检查自己所需的根节点或 data 属性；不存在时安静退出。
- 涉及故事章节时，以作品 ID、URL 和 `/json/histoire/<作品 ID>.json` 为唯一数据契约，不自行猜测章节。
- `chapter-nav.js` 当前按连续数字 ID 使用 `currentId ± 1`；校验工具保证现有常规章节 JSON 的 ID 连续。若未来允许跳号或重排，应另行改为按 JSON 相邻项导航并独立验证。

### Widget 层

文件示例：`backtop.js`、`mascot.js`，以及未来的小型浮动组件。

负责：自带 DOM、交互、状态和样式的可选组件。

规则：

- Widget 必须有唯一根节点或全局 guard，重复执行不能创建重复 ID、重复监听器或重复动画。
- Widget 应允许“目标节点不存在”时安全退出。
- 只有所有普通页面都需要的 widget 才进入普通加载器；特殊主题要显式决定是否启用，不能被普通入口副作用带入。
- Widget 不得控制 `main.loaded`、页眉或页脚生命周期。

### Special 层

文件示例：`special/common-head-peur.js`、`css/special/style_peur.css`、`special/giscus-peur.js`。

负责：特殊主题的视觉覆盖和特殊页面专属能力。

必须继续共享：`fade.js`、`img.js`、正文可见性保护、header/footer 机制、基础导航、返回顶部、文字统计和进度能力（若页面具备相应 DOM）。

禁止：复制一套普通生命周期脚本、改变公开 URL/分支关系，或把普通页面组件未经确认地带入特殊主题。

## CSS 分层规范

| 位置 | 职责 | 何时扩充 |
| --- | --- | --- |
| `css/style.css` | 字体、根变量、body、main、共享 header/footer、全站基础排版与共同交互 | 仅当规则确实适用于全站且不是独立组件时 |
| `css/tuile.css` | 通用磁贴/条目布局 | 新增同一套磁贴变体时 |
| `css/morceau.css` | 文章磁贴模块 | 文章列表卡片变化时 |
| `css/intro.css` | 故事/作品页标题、标签与介绍性布局 | 普通作品介绍页面的共同行为时 |
| `css/chapter-nav.css`、`css/chapters-sidebar.css` | 常规章节导航与目录侧栏 | 章节 UI 本身变化时 |
| `css/progression.css`、`css/mascot.css` | 单一 widget 的样式 | 对应 widget 的视觉变化时 |
| `css/page-number.css`、`css/tagflow.css` | 分页、标签流等明确功能 | 对应功能变化时 |
| `css/special/` | 特殊主题覆盖 | 仅特殊主题且不会反向影响普通页面时 |

正文水平尺寸由 `style.css` 的 `--content-gutter` 与 `--reading-gutter` 流式变量统一提供：前者用于 `main` 水平 padding，后者用于正文、标题、列表与直接阅读块的水平对齐。它们不改变字体、颜色、动画或垂直间距；移动端仍保留既有的 header/footer 等结构断点。超宽屏约束继续以 `min-width: 2000px` 的独立覆盖规则处理：`style.css` 限制 `main` 的直接正文元素至 1280px；`tuile.css` 限制 `.tiles` 至 1856px；`morceau.css` 限制 `.mt-container` 至 1856px。三者均居中，不约束 header、footer、吉祥物或章节侧栏。

禁止做法：

- 不要把仅一个页面、一个组件或一个特殊主题的规则继续堆入 `style.css`。
- 不要用特殊主题 CSS 覆盖普通功能的结构契约；特殊覆盖应以颜色、氛围、局部视觉为主。
- 不要因临时修复把相同选择器散落在多个无关 CSS 文件。

新 CSS 的判断：全站基础放 `style.css`；有清晰组件边界则建/扩充组件文件；仅特殊主题才放 `special/`。若不能明确回答影响范围，不要先写全局选择器。

## 新增功能前的必答问题

### 新增 JavaScript

先回答：

1. 它属于 Loader、Lifecycle、Feature、Widget 还是 Special？
2. 它依赖哪些 DOM、事件、JSON、样式或其他脚本？
3. 哪些页面需要它，哪些页面不应加载它？
4. 谁依赖它；是否存在严格的执行先后关系？
5. 应在解析期、DOMContentLoaded、header/footer 插入后、页面专属 loader，还是用户交互时接入？
6. 它是否属于特殊主题，是否需要普通页面也具备？

回答不清楚时，先补设计，不要直接把脚本加入 `common-head.js`。

若功能只适用于具备特定 DOM 的页面，应以该 DOM 能力判断并按需加载，而不是按 URL 维护人工白名单。阅读进度的契约就是同时存在 `data-progress-start` 与 `data-progress-end`；新增需要进度条的页面应提供完整锚点。

### 新增 CSS

先回答：

1. 它是基础样式、功能样式、widget 样式还是特殊主题覆盖？
2. 是否影响全站？是否会碰到 header、footer、main 或既有 URL 页面？
3. 是否已有职责相同的 CSS 文件？
4. 是否需要新文件，还是扩充同一组件文件？
5. 它是否必须由某个 loader 加载，还是只应由页面专属 HTML/loader 加载？

### 新增页面功能的推荐流程

```text
需求
  ↓
确定页面族与所属层级
  ↓
写出 DOM / 数据 / URL 契约
  ↓
创建 JS（如需要）与对应 CSS（如需要）
  ↓
选择最窄的接入点：页面专属 > 页面族 > 全站
  ↓
人工测试直接访问、刷新、站内跳转、后退/前进
  ↓
node tools/verify-content.mjs
  ↓
更新本文件、开发说明和视觉回归清单
```

## 为下一阶段准备：加载分类

### 当前确实需要尽早建立的能力

- `fade.js`：它登记正文进入/离开、同源导航拦截以及 header/footer 生命周期。当前页面视觉与导航直接依赖这些早期注册。
- 两个入口加载器本身：它们决定普通与特殊页面各自的基础样式和启动边界。

这不等于“永远只能同步 XHR”；它只说明在改变方式前必须保留同等早期注册与失败降级行为。

### 很可能可以延后评估的候选（本阶段不修改）

- `img.js`：实际重活已在 DOMContentLoaded 后的 idle/timeout 执行；它不依赖 header/footer，也没有对外 API。它仍会驱动现有 `.resp-img` 的入场动画，因此延后方案必须做该页面的视觉验证。
- `mots.js`：只依赖 main 与可选 `#count`。
- `backtop.js`：初始化后可观察晚到 footer。
- `blink.js`：可等待 `header:inserted`。
- `headtran.js`：以 `header:inserted` 处理动态 header，并在 DOM/scroll/pageshow 同步。
- `progression.js`：当前已按需加载，只依赖同时存在的阅读进度起止锚点；没有完整锚点的普通页和特殊页不请求 CSS 或 JS。
- `mascot.js`：普通页面的独立 widget。

这些是未来的设计候选，不是本轮授权的优化清单。任何改动都要先验证动态脚本的真实执行顺序、冷缓存、BFCache 与视觉基准。

### 可按需加载的候选

- `common-his.js`、`chapters-sidebar.js`、`chapter-nav.js`：仅常规作品/章节页需要；当前已由故事页面专属的 `common-his.js` 处理。
- `giscus.js` / `special/giscus-peur.js`：仅有评论容器的页面需要。
- `list.js`、`catalogue.js`、`tag.js`、`page-number.js`、`tagflow.js`：仅各自首页、列表、标签或分页页面需要。
- `mascot.js`：仅普通桌面页面需要，特殊主题不加载。
- `special/common-head-peur.js` 与 `css/special/style_peur.css`：仅 `HHXLOYDCS` 页面需要。

### Loader 中的同步 XHR

两个入口不再通过同步 XHR 取得 Loader 管理的脚本：`fade.js` 与 `img.js` 都由 Loader 各创建一次经典外链 script。`fade.js` 在正文可见性 fallback 安装之后插入；若请求失败，fallback 仍会在约 1.2 秒后显示正文，但 header/footer、离场动画和导航拦截属于预期降级。

`img.js` 不被其他脚本调用；自身会根据 `document.readyState` 注册或安排图片处理，当前作用是为启动时存在的图片加入 `loaded`，并为未来 `.bg-image` 标记提供处理逻辑。header/footer 片段、故事 JSON、章节 JSON、评论、图片和音频仍由后续 fetch、页面资源或功能脚本处理。

## 下一阶段建议

1. 先用本说明为新增功能设定接入边界，不改加载时序。
2. 单独审计动态脚本的真实下载/执行顺序与冷缓存表现。
3. 单独确认特殊页面的阅读进度锚点是否完整；这属于功能数据/DOM 审计，不应和加载器改动混在一起。
4. 后续若调整 Loader 外链脚本的下载或执行顺序，先写兼容设计、浏览器故障测试和可回滚小步骤，再实施。
