// 加载淡入效果
// 淡入动画封装
function fadeIn() {
  const main = document.querySelector('main');
  if (main) {
    main.classList.remove('loaded'); // 清掉旧的
    void main.offsetWidth;           // 强制重绘，确保动画重启
    main.classList.add('loaded');    // 再加回去，触发淡入
  }
}

// 页面第一次加载时
document.addEventListener('DOMContentLoaded', fadeIn);

// 页面从缓存返回时（前进或后退按钮）
window.addEventListener('pageshow', fadeIn);

// 链接点击时的淡出逻辑
document.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (!href.startsWith('/') && !href.includes(window.location.host)) return;
    
    e.preventDefault();
    const main = document.querySelector('main');
    if (!main) return;
    
    main.classList.remove('loaded'); // 先移除，触发淡出
    setTimeout(() => {
      window.location.href = href;   // 等动画跑完再跳转
    }, 300); // 时间和 CSS transition 保持一致
  });
});
