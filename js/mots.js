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

  // 暴露一个手动刷新接口
  window.motsRefresh = function () {
    try {
      updateCount();
    } catch (e) {
      console.error(e);
    }
  };

  // #count 只存在于静态 HTML；脚本晚于 DOMContentLoaded 时直接初始化。
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateCount, { once: true });
  } else {
    updateCount();
  }
})();
