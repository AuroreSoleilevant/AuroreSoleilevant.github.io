// 加载淡入效果
document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main');
  if (main) main.classList.add('loaded');
});

// 点击站内链接时，先执行淡出再跳转
document.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    // 站外不管
    if (!href.startsWith('/') && !href.includes(window.location.host)) return;

    e.preventDefault();
    const main = document.querySelector('main');
    if (!main) return;

    main.classList.remove('loaded'); // 触发淡出
    setTimeout(() => {
      window.location.href = href;   // 跳转时间变量
    }, 300);
  });
});