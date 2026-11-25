export function createFeature() {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const animations = new WeakMap();

  function animateContent(element, distance = 6) {
    if (!element) return;
    animations.get(element)?.cancel();
    if (reduced.matches || !element.animate) return;
    const animation = element.animate(
      [{ opacity: 0, translate: `0 ${distance}px` }, { opacity: 1, translate: "0 0" }],
      { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
    animation.id = "workspace-content";
    animations.set(element, animation);
  }

  function animateStatus(element, message) {
    if (!element || element.textContent === message) return;
    element.textContent = message;
    animateContent(element, 0);
  }

  function updateTabIndicator(container) {
    const tab = container?.querySelector('[role="tab"][aria-selected="true"]');
    if (!tab || !container.getClientRects().length) return;
    container.classList.add("motion-tabs");
    container.style.setProperty("--tab-left", tab.offsetLeft + "px");
    container.style.setProperty("--tab-width", tab.offsetWidth + "px");
  }

  function bindMotion() {
    window.addEventListener("resize", () => {
      document.querySelectorAll(".motion-tabs").forEach(updateTabIndicator);
    });
    reduced.addEventListener("change", () => {
      if (reduced.matches)
        document.getAnimations().filter((animation) => animation.id === "workspace-content")
          .forEach((animation) => animation.cancel());
    });
  }

  return { animateContent, animateStatus, updateTabIndicator, bindMotion };
}
