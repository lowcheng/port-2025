import gsap from "gsap";
import appState from "../core/AppState.js";
import { LOADING_SELECTORS } from "../config/constants.js";

export function setupLoadingScreen() {
  const btn = document.querySelector(LOADING_SELECTORS.button);
  const fill = document.querySelector(LOADING_SELECTORS.barFill);

  appState.loadingManager.onStart = () => {
    gsap.to(LOADING_SELECTORS.screen, {
      opacity: 1,
      duration: 1,
      ease: "power2.out",
    });
  };

  appState.loadingManager.onProgress = (_, loaded, total) => {
    const pct = Math.floor((loaded / total) * 100);
    fill.style.width = pct + "%";
    gsap.to(fill, { scaleY: 1.05, repeat: -1, yoyo: true, duration: 0.5 });
  };

  appState.loadingManager.onLoad = () => {
    gsap.killTweensOf(fill);
    gsap.to(LOADING_SELECTORS.bar, { opacity: 0, duration: 0.5 });
    gsap.to(btn, {
      opacity: 1,
      duration: 1,
      ease: "power2.out",
      delay: 0.3,
      onComplete() {
        btn.classList.add("ready");
        btn.style.pointerEvents = "auto";
      },
    });
    gsap.fromTo(
      btn,
      { scale: 0.9 },
      { scale: 1, duration: 0.5, ease: "bounce.out", delay: 0.5 }
    );
  };
}
