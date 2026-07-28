# 全站资源使用审计基线

审计日期：2026-07-28。本文是只读基线，不授权删除、移动、压缩或重写任何资源。结论只覆盖当前仓库；仓库外书签、旧部署快照或人工输入 URL 不在静态搜索范围内。

## 方法与范围

- 扫描 286 个 HTML 文件、11 个 CSS 文件、20 个 JS 文件，以及 HTML/CSS/JS/JSON 中的资源路径文本。
- “引用次数”是运行时源文件中的路径文本次数，不等于浏览器请求次数。Loader 的一次引用可覆盖大量页面。
- CSS selector 数量按逗号拆分后的 selector 分支统计；`!important`、`@media`、`animation` 属性与 `@keyframes` 均为文本计数。
- class 对照包含外部 CSS 与 HTML 内嵌 `<style>`。HTML 中不存在而 JS 有 classList、selector 或模板字符串证据的 class 标为“由 JS 创建/切换”。
- 资源“无静态证据”表示：在非文档的 HTML、CSS、JS、JSON 中，既没有根绝对路径，也没有文件名文本。它是强候选，不是仓库外依赖不存在的证明。

## 总览

| 类型 | 数量 |
| --- | ---: |
| HTML | 286（其中 284 个公开页面，另有 header/footer 片段） |
| CSS | 11 |
| JavaScript | 20 |
| PNG / JPG / WebP / SVG / GIF | 6 / 11 / 52 / 13 / 0 |
| TTF / WOFF / WOFF2 | 1 / 0 / 3 |
| MP3 / WAV / OGG | 8 / 0 / 0 |

公开页面入口为普通 Loader 225 页和 `HHXLOYDCS` 特殊 Loader 59 页。两类相加为 284 页。

## CSS

### 引用关系

下表的 HTML、JS 列表示运行时路径文本出现的源文件数。

| 文件 | HTML | JS | 主要加载者 / 页面 |
| --- | ---: | ---: | --- |
| `css/style.css` | 0 | 2 | 两个 Loader 的全站基础样式 |
| `css/progression.css` | 0 | 2 | 两个 Loader |
| `css/mascot.css` | 0 | 1 | 普通 Loader；特殊 Loader 不加载 |
| `css/special/style_peur.css` | 0 | 1 | 特殊 Loader；仅 HHXLOYDCS |
| `css/intro.css` | 76 | 1 | 作品/文章页面直接引用，常规 histoire 也由 `common-his.js` 加载 |
| `css/chapters-sidebar.css` | 0 | 1 | `common-his.js` |
| `css/chapter-nav.css` | 4 | 1 | `common-his.js`；4 个 HMDX 页面另有直接 link |
| `css/morceau.css` | 36 | 0 | 首页、列表、标签和分页页面 |
| `css/page-number.css` | 34 | 0 | 文章/故事列表和标签分页 |
| `css/tagflow.css` | 1 | 0 | 首页 |
| `css/tuile.css` | 3 | 0 | 首页、实验室、HTK |

**没有路径零引用的 CSS 文件。** 单个 JS 引用不表示低覆盖：例如 `style.css` 由两个入口 Loader 注入，`chapters-sidebar.css` 则由 164 个页面共同引用的 `common-his.js` 注入。

### 复杂度基线

| 文件 | selector 分支 | `!important` | `@media` | `animation` | `@keyframes` |
| --- | ---: | ---: | ---: | ---: |
| `chapter-nav.css` | 17 | 0 | 3 | 0 | 0 |
| `chapters-sidebar.css` | 23 | 0 | 2 | 0 | 0 |
| `intro.css` | 15 | 13 | 4 | 0 | 0 |
| `mascot.css` | 13 | 1 | 1 | 0 | 0 |
| `morceau.css` | 60 | 20 | 6 | 1 | 0 |
| `page-number.css` | 65 | 5 | 3 | 1 | 1 |
| `progression.css` | 2 | 0 | 1 | 0 | 0 |
| `special/style_peur.css` | 56 | 18 | 0 | 0 | 1 |
| `style.css` | 218 | 2 | 9 | 4 | 3 |
| `tagflow.css` | 29 | 0 | 4 | 0 | 0 |
| `tuile.css` | 140 | 68 | 10 | 1 | 0 |

这只是比较基线；高 `!important` 或 selector 数量本身不构成删除或重构授权。

### class 覆盖率

- 外部 CSS 中识别到 102 个 class token；HTML 中识别到 89 个 class token，HTML 内嵌样式另定义 45 个 class token。
- 54 个外部 CSS class 没有出现在静态 HTML；其中 47 个有 JS 创建、查询或切换证据，例如 `reading-progress`（`progression.js`）、`back-to-top`（`backtop.js`）、`mw-*`（`mascot.js`）、`pg2-*`（`page-number.js`）、`chapter-*`（`chapters-sidebar.js`）和 `mt-*`（`list.js`）。这些不是死 CSS。
- 其余 7 个目前没有 HTML 或 JS 的 class 使用证据：`.clickable`、`#chapter-sidebar.dark` 的 `dark` 状态、`.ratio-box`、`.ratio-box > .inner`、`.mt-tile.is-lifted`、`.site-content`、`.story-content`。它们只在相应 CSS 中出现，见“死代码候选”。
- HTML 中只有 `no-comments` 和 `preload` 不在外部或内嵌 CSS selector 中。`no-comments` 由 `backtop.js` 查询以禁用评论跳转按钮；`preload` 只在 `autre/moi/index.html` 两张 `.resp-img` 上出现，未发现 CSS selector 或 JS class API 对它的使用。

## JavaScript

### 文件、加载者与依赖

“全局”只记录主动暴露的 API/状态，不把 `window.scrollY` 这类浏览器 API 使用误写为导出。层级遵循 `architecture.md`。

| 文件 | 层级 | 加载者 / 覆盖 | 依赖或被依赖关系 | 全局导出 / 状态 |
| --- | --- | --- | --- | --- |
| `common-head.js` | Loader | HTML 225 页 | 加载共享脚本、样式；普通页面入口 | fallback guard `__mainVisibilityFallbackInstalled` |
| `special/common-head-peur.js` | Special + Loader | HHXLOYDCS 59 页 | 特殊主题共享入口 | 同一 fallback guard |
| `fade.js` | Lifecycle / 同步启动 | 两个 Loader | 提供正文、header/footer、导航生命周期；被 Loader 先执行 | `__fetchAndInsertFooter`、`__fetchAndInsertHeader` |
| `img.js` | Feature | 两个 Loader | 无其他运行时调用者；处理静态图片快照 | 无 |
| `mots.js` | Feature | 两个 Loader | 依赖 main、可选 `#count` | `mots`、`motsRefresh` |
| `backtop.js` | Widget | 两个 Loader | 依赖 main/body、可选 footer 与评论容器 | 无 |
| `blink.js` | Feature | 两个 Loader | 等待 `.nav-item` 或 `header:inserted` | 无 |
| `headtran.js` | Feature | 两个 Loader | 依赖动态 header、滚动和 pageshow | 安装 guard `__headtran_installed` |
| `progression.js` | Feature | 两个 Loader | 必须同时有两个 progress data 属性 | 无 |
| `mascot.js` | Widget | 普通 Loader | 普通桌面页的吉祥物 | `MASCOT_CONFIG`、`__MASCOT_*`、`__MASCOT_WIDGET` |
| `common-his.js` | Loader | HTML 164 页 | 串行加载章节侧栏/导航及其 CSS | 无 |
| `chapters-sidebar.js` | Feature | `common-his.js` | 作品 URL、章节 JSON、main/body | 无 |
| `chapter-nav.js` | Feature | `common-his.js` | 作品 URL、章节 JSON、导航 root、侧栏 toggle | 无 |
| `giscus.js` | Feature | HTML 184 页 | 向 `#giscus-container` 或 body 插入评论脚本 | 无 |
| `special/giscus-peur.js` | Special | HHXLOYDCS 59 页 | 同上，特殊评论配置 | 无 |
| `list.js` | Feature | HTML 36 页 | 提供列表能力，必须先于 catalogue/tag | `CoreList` |
| `catalogue.js` | Feature | HTML 7 页 | 消费 `CoreList.mountList` | 无 |
| `tag.js` | Feature | HTML 28 页 | 消费 `CoreList` 的列表、排序、分页 API | 无 |
| `page-number.js` | Feature | HTML 34 页 | 分页容器 | 无 |
| `tagflow.js` | Feature | 首页 1 页 | 首页标签流 DOM | 无 |

`list.js` 的 `CoreList` 是当前唯一明确的跨脚本业务 API；`catalogue.js` 与 `tag.js` 都在 DOMContentLoaded 时检查它是否已存在。章节侧栏和章节导航由 `common-his.js` 依次插入，故不依赖 HTML 中的直接 script tag。

### 浏览器 API 使用基线

缩写：MO=MutationObserver、RO=ResizeObserver、IO=IntersectionObserver、rAF=requestAnimationFrame、rIC=requestIdleCallback、TO=setTimeout、TI=setInterval、F=fetch、XHR=XMLHttpRequest、DCL=DOMContentLoaded。

| 文件 | 使用的 API（出现次数） | DCL |
| --- | --- | ---: |
| `backtop.js` | MO×1、RO×5、rAF×1、TO×4 | 1 |
| `blink.js` | rAF×2、TI×1 | 1 |
| `catalogue.js` | 无上述异步/观察 API | 1 |
| `chapter-nav.js` | F×1 | 1 |
| `chapters-sidebar.js` | rAF×2、F×1 | 1 |
| `common-head.js` | TO×1、XHR×1 | 2 |
| `common-his.js` | 无 | 0 |
| `fade.js` | MO×2、rAF×7、TO×13、F×2 | 1 |
| `giscus.js` | 无 | 0 |
| `headtran.js` | MO×2、TO×3、TI×1 | 2 |
| `img.js` | rIC×4、TO×3 | 2 |
| `list.js` | F×2 | 0 |
| `mascot.js` | rAF×2、TO×5、F×2 | 1 |
| `mots.js` | MO×3、TO×1、TI×1 | 4 |
| `page-number.js` | TO×1 | 1 |
| `progression.js` | MO×1、rAF×1、TO×5 | 1 |
| `special/common-head-peur.js` | TO×1、XHR×1 | 2 |
| `special/giscus-peur.js` | 无 | 0 |
| `tag.js` | 无上述 API | 1 |
| `tagflow.js` | TO×2 | 1 |

没有文件使用 IntersectionObserver。本表是源码文本计数，不等同于每次页面浏览实际创建的对象数量。

## 组件覆盖率

| 组件 | 加载页面 | 实际条件 / 当前结果 |
| --- | ---: | --- |
| fade | 284 | 两个 Loader 都同步启动；依赖 main 和 header/footer 占位 |
| img | 284 | 两个 Loader 都创建一次外链 script；处理执行时存在的图片快照 |
| backtop | 284 | 两个 Loader 都加载；组件再按页面高度、footer/评论条件决定显示 |
| mots | 284 | 两个 Loader 都加载；`#count` 是可选目标 |
| blink | 284 | 动态 header 插入后或已有 nav-item 时初始化 |
| headtran | 284 | 动态 header 与滚动条件满足时生效 |
| progression | 284 | 只有 186 个普通页同时具备 start/end；59 个 HHXLOYDCS 页只有 start，脚本在 `progression.js:4-8` 直接返回；其余 39 个普通页也没有完整锚点 |
| mascot | 225 | 仅普通 Loader；移动宽度会隐藏，特殊页不加载 |
| chapters-sidebar | 164 | 仅 `common-his.js` 页面；读取章节 JSON 并动态创建 UI |
| chapter-nav | 164 | 仅 `common-his.js` 页面；164 页均有 `#chapter-nav-root` |
| giscus | 243 | 普通 `giscus.js` 184 页，特殊版本 59 页；242 页有显式容器，另 1 页按脚本设计回退到 body |
| list / catalogue | 36 / 7 | `catalogue.js` 依赖先加载的 `CoreList` |
| tag | 28 | 依赖先加载的 `CoreList` |
| page-number | 34 | 列表/标签分页页 |
| tagflow | 1 | 仅首页 |

## 死代码与无触发候选

以下均为候选，不是删除结论。

1. **`img.js` 的 `.bg-image` 分支。** `handleBgImages()` 在 `js/img.js:72-151` 会查询 `.bg-image` 和可选 `data-bg-src`；全仓库（排除本文档）只有 `img.js` 与 `style.css` 出现这两个标记，没有 HTML 或其他 JS 创建它们。因此该分支当前没有页面输入。
2. **特殊页的阅读进度。** `progression.js:4-8` 要求同时存在 `data-progress-start`、`data-progress-end`。59 个 HHXLOYDCS 页均只有 start、没有 end，故每页加载脚本和 CSS，但不创建进度条。
3. **章节目录按钮的 `openSidebar()` 直调分支。** `chapter-nav.js:108` 在独立 IIFE 内检查 `typeof openSidebar`；`chapters-sidebar.js:198` 的同名函数位于另一个 IIFE，未赋给 `window`。当前该直调条件不可满足，实际走 `#chapter-toggle` click 回退（第 109-111 行）。回退是现有功能路径，不能删除。
4. **无 HTML/JS 证据的 CSS 状态/布局规则。** `.clickable`、`#chapter-sidebar.dark`、`.ratio-box` / `.inner`、`.mt-tile.is-lifted`、`.site-content`、`.story-content` 只在 CSS selector 中出现。它们可能是预留样式，也可能是遗留，尚未做浏览器行为验证。
5. **HTML class `preload`。** 仅出现在 `autre/moi/index.html` 的两张 `.resp-img` 上；未找到 `.preload` CSS selector、JS selector 或 classList 操作。它不影响 `img.js` 的 `.loaded` 动画逻辑，但在移除前仍应人工验证该页。

## 静态资源审计

所有 8 个 MP3、全部 11 个 JPG、全部 6 个 PNG、52 个 WebP 中的 51 个、13 个 SVG 中的 12 个，以及全部 3 个 WOFF2，都在非文档源文件中有路径或文件名引用证据。WOFF2 由 `style.css` 的 `@font-face` 引用；latin/cjk 两份还由两个 Loader preload。

下列 3 项在 HTML、CSS、JS、JSON 中均没有根绝对路径或文件名文本：

| 资源 | 静态证据 | 说明 |
| --- | --- | --- |
| `fonts/LXGWWenKai.ttf` | 0 | 当前字体声明只引用三个 WOFF2；不能据此排除仓库外下载链接或未来人工用途 |
| `icons/icon-test.svg` | 0 | 没有页面、CSS、JS 或 JSON 文本引用 |
| `images/histoire/魔法之末的往事.webp` | 0 | 同名作品的 intro 图片有引用，但这个非 intro 文件没有 |

## 可清理候选优先级

| 优先级 | 候选 | 为什么进入队列 | 本轮结论 |
| --- | --- | --- | --- |
| P0 | 无 | 未发现需要立刻删除才能恢复正确性的资源 | 不动作 |
| P1 | 3 个无静态路径证据资源 | 对每个资源都完成了路径与文件名搜索，结果均为 0 | 后续单独确认仓库外用途、视觉和历史回退后再决定 |
| P2 | `.bg-image` 分支、特殊页 progression、7 组 CSS selector、`preload` class、章节 `openSidebar()` 直调分支 | 有明确“当前无页面触发”或“当前不可达”的源码证据，但可能涉及视觉、交互或未来内容 | 分别设计小范围验证，不能合并成一次清理 |

## 暂不建议动

- `style.css`、`progression.css`、`mascot.css`、`chapters-sidebar.css` 和特殊主题 CSS 虽然直接路径引用数很少，但都由 Loader 或 `common-his.js` 覆盖多页。
- 所有由 JS 创建的 class（特别是 `mw-*`、`pg2-*`、`chapter-*`、`mt-*`、`reading-progress`、`back-to-top`）没有静态 HTML 是正常现象。
- `fade.js`、两个 Loader、`common-his.js`、`list.js`/`catalogue.js`/`tag.js` 存在顺序或全局 API 关系；引用次数不能单独证明可删除。
- 除上表 3 项外的资源均已有静态引用证据；不能仅因未在某个 HTML 页面出现就判断为无用，因为 CSS、JS、JSON 和共享片段也会引用资源。

## 后续审计建议

下一轮若要处理任一候选，应一次只验证一个候选，保留 URL、视觉基准和回滚路径；先做搜索、相关页面人工测试与 `node tools/verify-content.mjs`，再做独立修改。本文不提供自动修复或删除命令。
