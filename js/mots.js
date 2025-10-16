//字数统计
function mots() {
  const main = document.querySelector("main");
  if (!main) return 0;

  // 获取 main 的纯文本
  const text = main.innerText || main.textContent || "";

  // 匹配所有中文字符（含汉字标点的区）
  const matches = text.match(/[\u4e00-\u9fa5]/g);

  // 返回数量
  return matches ? matches.length : 0;
}
