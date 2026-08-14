(() => {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let pendingFrame = 0;

  const readViewportHeight = () => Math.max(
    window.innerHeight || 0,
    root.clientHeight || 0,
    viewport?.height || 0,
  );

  const applyViewportHeight = () => {
    pendingFrame = 0;
    const height = Math.round(readViewportHeight());
    if (height > 0) {
      root.style.setProperty("--app-viewport-height", `${height}px`);
    }
  };

  const queueViewportUpdate = () => {
    if (pendingFrame) {
      cancelAnimationFrame(pendingFrame);
    }
    pendingFrame = requestAnimationFrame(applyViewportHeight);
  };

  queueViewportUpdate();
  window.addEventListener("resize", queueViewportUpdate, { passive: true });
  window.addEventListener("orientationchange", queueViewportUpdate, { passive: true });
  window.addEventListener("pageshow", queueViewportUpdate, { passive: true });
  viewport?.addEventListener("resize", queueViewportUpdate, { passive: true });
  viewport?.addEventListener("scroll", queueViewportUpdate, { passive: true });
})();
