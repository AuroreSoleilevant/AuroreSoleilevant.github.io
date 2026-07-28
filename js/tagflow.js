//滚动tag
class TagFlowManager {
  constructor() {
    this.tracks = [];
    this.animationFrameId = null;
    this.init();
  }

  init() {
    this.setupTracks();
    this.setupResizeHandler();
    this.setupPerformanceOptimization();
  }

  setupTracks() {
    const tracks = document.querySelectorAll(".flow-track");

    tracks.forEach((track, index) => {
      const tags = track.querySelectorAll(".flow-tag");
      const originalTags = Math.floor(tags.length / 2);

      // 计算精确的移动距离
      const trackData = {
        element: track,
        originalCount: originalTags,
        totalCount: tags.length,
        direction: index === 0 ? "right" : "left",
      };

      this.tracks.push(trackData);
      this.setupTrackAnimation(trackData);
      this.addTagInteractions(track);
    });
  }

  setupTrackAnimation(trackData) {
    const { element, originalCount, totalCount, direction } = trackData;

    // 移动距离 = (原始标签数量 / 总标签数量) * 100%
    const movePercentage = (originalCount / totalCount) * 100;

    // 创建动态关键帧
    const animationName = `scroll${
      direction.charAt(0).toUpperCase() + direction.slice(1)
    }_${trackData.element.id}`;

    // 移除已存在的样式
    const existingStyle = document.getElementById(animationName);
    if (existingStyle) existingStyle.remove();

    // 创建新的关键帧
    const style = document.createElement("style");
    style.id = animationName;

    if (direction === "right") {
      style.textContent = `
        @keyframes ${animationName} {
          0% { transform: translateX(0); }
          100% { transform: translateX(-${movePercentage}%); }
        }
      `;
    } else {
      style.textContent = `
        @keyframes ${animationName} {
          0% { transform: translateX(-${movePercentage}%); }
          100% { transform: translateX(0); }
        }
      `;
    }

    document.head.appendChild(style);

    // 应用动画
    const baseDuration = direction === "right" ? 40 : 45;
    const adjustedDuration = this.calculateAdjustedDuration(
      element,
      baseDuration
    );

    element.style.animation = `${animationName} ${adjustedDuration}s linear infinite`;
    element.style.willChange = "transform"; // 性能优化
  }

  calculateAdjustedDuration(element, baseDuration) {
    const container = document.querySelector(".category-flow-wrapper");
    if (!container) return baseDuration;

    const containerWidth = container.offsetWidth;
    const trackWidth = element.scrollWidth / 2;

    // 根据内容长度调整速度
    const speedFactor = Math.max(
      0.8,
      Math.min(1.5, trackWidth / containerWidth)
    );

    // 根据屏幕宽度调整速度（移动端更快）
    let deviceSpeedMultiplier = 1;
    const screenWidth = window.innerWidth;

    if (screenWidth <= 480) {
      deviceSpeedMultiplier = 2.5; // 小手机加速60%
    } else if (screenWidth <= 768) {
      deviceSpeedMultiplier = 1.9; // 平板/大手机加速40%
    } else if (screenWidth <= 1024) {
      deviceSpeedMultiplier = 1.4; // 小桌面加速20%
    }
    // PC端保持原速 (1.0)

    return (baseDuration * speedFactor) / deviceSpeedMultiplier;
  }

  addTagInteractions(track) {
    const tags = track.querySelectorAll(".flow-tag");

    tags.forEach((tag) => {
      // 点击效果
      tag.addEventListener("click", (e) => {
        e.preventDefault();

        // 简洁的点击反馈
        const originalBg = tag.style.background;
        tag.style.background = "#4a5568";

        setTimeout(() => {
          tag.style.background = originalBg;
        }, 200);

        console.log("点击分类:", tag.textContent);
      });
    });
  }

  setupResizeHandler() {
    let resizeTimeout;
    const resizeHandler = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.updateAllAnimations();
      }, 250); // 防抖处理
    };

    window.addEventListener("resize", resizeHandler);
  }

  setupPerformanceOptimization() {
    // 使用 will-change 提前告知浏览器优化
    document.querySelectorAll(".flow-track").forEach((track) => {
      track.style.willChange = "transform";
    });
  }

  updateAllAnimations() {
    this.tracks.forEach((trackData) => {
      this.setupTrackAnimation(trackData);
    });
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

// 初始化
let tagFlowManager;

document.addEventListener("DOMContentLoaded", () => {
  tagFlowManager = new TagFlowManager();
});

// 响应式更新
window.addEventListener("resize", () => {
  if (tagFlowManager) {
    tagFlowManager.updateAllAnimations();
  }
});

// 扫地
window.addEventListener("beforeunload", () => {
  if (tagFlowManager) {
    tagFlowManager.destroy();
  }
});
