// scripts/utils/scrollUtils.js

/**
 * Returns the set of elements that actually scroll inside a modal.
 * - Prefers common scroll containers (.pm-body / .modal-body / etc)
 * - Includes the modal itself if it scrolls
 * - Falls back to any descendants that are scrollable
 */
export function getScrollContainers(modal) {
  if (!modal) return [];

  const candidates = modal.querySelectorAll(
    ".pm-body, .modal-body, .modal-content, [data-scroll-container]"
  );
  const set = new Set();

  // 1) explicit candidates
  candidates.forEach((el) => set.add(el));

  // 2) the modal itself if it scrolls
  const mcs = getComputedStyle(modal);
  if (
    (mcs.overflowY === "auto" || mcs.overflowY === "scroll") &&
    modal.scrollHeight > modal.clientHeight
  ) {
    set.add(modal);
  }

  // 3) fallback: any descendant that actually scrolls
  modal.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    if (
      (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      set.add(el);
    }
  });

  return Array.from(set);
}

/** Instant, non-smooth reset to top-left for all scroll containers. */
export function resetScroll(modal) {
  getScrollContainers(modal).forEach((el) =>
    el.scrollTo({ top: 0, left: 0, behavior: "auto" })
  );
}

/**
 * Reset after the next layout frame. Use this when you just toggled
 * display/hidden or swapped DOM and want to ensure layout is valid.
 */
export function resetScrollAfterLayout(modal) {
  requestAnimationFrame(() => resetScroll(modal));
}
