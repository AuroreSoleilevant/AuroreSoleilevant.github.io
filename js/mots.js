// mots.js 字数统计
(function () {
  "use strict";

  // 计数函数：挂到全局
  window.mots = function () {
    var main = document.querySelector("main");
    if (!main) return 0;
    var text = (main.innerText || main.textContent || "").trim();
    if (!text) return 0;
    // 字符区，汉字+常见日语/韩语
    var re = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u{20000}-\u{2EBEF}]/gu;
    var m = text.match(re);
    return m ? m.length : 0;
  };

  //如果没有 #count 返回 false
  function updateCount() {
    var el = document.getElementById("count");
    if (!el) return false;
    try {
      el.textContent = window.mots();
    } catch (e) {
      console.error("mots update error:", e);
      el.textContent = 0;
    }
    return true;
  }

  // 启动监听 / 轮询 / 兜底逻辑
  function waitForContentAndUpdate() {
    // 如果能立即设置成功就结束
    if (updateCount()) return;

    // 找 main（可能还没被插入，浏览器的抽象逻辑导致的）
    var main = document.querySelector("main");

    // 观察目标：优先 main，如果没有则观察 body（body 可能也未就绪，服了）
    var observeTarget = main || document.body || document.documentElement;
    if (!observeTarget) {
      // 如果连 document.body 都不存在，等DOMContentLoaded再试一次
      document.addEventListener(
        "DOMContentLoaded",
        function () {
          waitForContentAndUpdate();
        },
        { once: true }
      );
      return;
    }

    // 使用 MutationObserver 监听内容变化，一旦 updateCount 成功就断开 observer
    var mo = new MutationObserver(function () {
      if (updateCount()) {
        try {
          mo.disconnect();
        } catch (e) {}
      }
    });

    try {
      mo.observe(observeTarget, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } catch (e) {
      // 如果 observe 失败（极少见但天知道），继续靠轮询
      console.warn(
        "mots: MutationObserver observe failed, falling back to polling",
        e
      );
    }

    // 轮询兜底：每 300ms 检查一次，最多 12 秒（避免无限循环）
    var checks = 0;
    var maxChecks = 40; // 40 * 300ms = 12s
    var interval = setInterval(function () {
      checks++;
      if (updateCount() || checks >= maxChecks) {
        clearInterval(interval);
        try {
          mo.disconnect();
        } catch (e) {}
      }
    }, 300);
  }

  // 暴露一个手动刷新接口
  window.motsRefresh = function () {
    try {
      waitForContentAndUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  // 启动时机：如果 DOM 已经解析或完成，马上启动；否则在 DOMContentLoaded 启动
  if (
    document.readyState === "interactive" ||
    document.readyState === "complete"
  ) {
    // 延后到下一次事件循环，确保其它 defer/script 有机会运行
    setTimeout(waitForContentAndUpdate, 0);
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        waitForContentAndUpdate();
      },
      { once: true }
    );
  }
})();
