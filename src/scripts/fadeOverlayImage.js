// fadeOverlayImage.js
import gsap from "gsap";

/**
 * Initializes a fade-to-black overlay system for image previews + text.
 *
 * Usage:
 *   const { showImageOverlay, hideImageOverlay } = initImageOverlay();
 *   showImageOverlay('path/to/large.jpg', 'Some descriptive text...');
 */
export function initImageOverlay({
  overlaySelector = ".fade-overlay",
  contentSelector = ".fade-overlay-content",
  closeBtnSelector = ".fade-overlay-close-btn",
  imgSelector = ".fade-overlay-img",
  textSelector = ".fade-overlay-text",
  onOpen = () => {}, // ① new callback
  onClose = () => {},
} = {}) {
  // Grab DOM elements
  const overlay = document.querySelector(overlaySelector);
  const overlayContent = overlay.querySelector(contentSelector);
  const closeBtn = overlay.querySelector(closeBtnSelector);
  const imgEl = overlay.querySelector(imgSelector);
  const textEl = overlay.querySelector(textSelector);

  let isOpen = false;
  let isAnimating = false;

  /**
   * Show the overlay with a fade-in effect
   * @param {string} imageUrl - The big image to display
   * @param {string} description - The descriptive/context text
   */
  function showImageOverlay(imageUrl, description) {
    if (!overlay || isAnimating || isOpen) return;
    onOpen();
    isOpen = true;
    isAnimating = true;

    // Set the content (image src + text)
    imgEl.src = imageUrl;
    textEl.textContent = description;

    // Display block so GSAP can animate opacity
    overlay.style.display = "block";

    // Fade overlay from 0 to 1
    gsap.fromTo(
      overlay,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.6,
        ease: "power2.out",
        onComplete: () => {
          isAnimating = false;
        },
      }
    );
    gsap.fromTo(
      overlayContent,
      { scale: 0.8 },
      { scale: 1, duration: 0.6, ease: "back.out(1.5)" }
    );
  }

  /**
   * Hide the overlay with a fade-out effect
   */
  function hideImageOverlay() {
    if (!overlay || isAnimating || !isOpen) return;
    console.log("hidnig");

    isOpen = false;
    isAnimating = true;

    gsap.to(overlay, {
      opacity: 0,
      duration: 0.5,
      ease: "power2.in",
      onComplete: () => {
        overlay.style.display = "none";
        isAnimating = false;
        onClose();
      },
    });
  }

  // Close on button click
  closeBtn.addEventListener("click", () => {
    hideImageOverlay();
  });

  // (Optional) Close on overlay click outside the content
  overlay.addEventListener("click", (e) => {
    // If the user clicked directly on the background (not the .fade-overlay-content)
    if (e.target === overlay && isOpen) {
      hideImageOverlay();
    }
  });

  return {
    showImageOverlay,
    hideImageOverlay,
  };
}
