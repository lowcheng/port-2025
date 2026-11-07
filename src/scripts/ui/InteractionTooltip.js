const ICON_CONTROL =
  "[data-tooltip], button[aria-label], a[aria-label], .modal-close-btn, .hamburger-btn, #theme-toggle, #back-button";
const UI_SURFACE =
  "dialog[open], .modal, .side-panel.active, .loading-screen, button, a, input, textarea, select, iframe";

export default class InteractionTooltip {
  constructor({ getLabel, isDarkMode }) {
    this.getLabel = getLabel;
    this.isDarkMode = isDarkMode;
    this.element = document.createElement("div");
    this.element.className = "interaction-tooltip";
    this.element.id = "scene-interaction-tooltip";
    this.element.setAttribute("role", "tooltip");
    this.element.hidden = true;
    document.body.append(this.element);
    this.hasPointer = false;
    this.source = null;
    this.dragging = false;
    this.width = this.height = 0;
    this.events = new AbortController();
    const options = { signal: this.events.signal, passive: true };
    window.addEventListener(
      "pointermove",
      (event) => {
        if (this.source === "focus") this.clear();
        this.hasPointer = event.pointerType !== "touch";
        this.dragging = event.buttons !== 0;
        this.x = event.clientX;
        this.y = event.clientY;
        if (!this.hasPointer || this.dragging) {
          this.clear();
          return;
        }
        const label = this.domLabel(document.elementFromPoint(this.x, this.y));
        if (label) this.show(label, "dom");
        else if (this.source === "dom") this.clear();
      },
      options,
    );
    window.addEventListener(
      "pointerdown",
      () => {
        this.dragging = true;
        this.clear();
      },
      options,
    );
    window.addEventListener(
      "pointerup",
      () => {
        this.dragging = false;
      },
      options,
    );
    window.addEventListener(
      "pointerout",
      (event) => {
        if (!event.relatedTarget) this.reset();
      },
      options,
    );
    window.addEventListener("blur", () => this.reset(), options);
    window.addEventListener(
      "resize",
      () => {
        this.width = 0;
        this.clear();
      },
      options,
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.reset();
      },
      options,
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") this.reset();
      },
      { signal: this.events.signal },
    );
    document.addEventListener(
      "focusin",
      (event) => {
        // Pointer users keep the tooltip beside their pointer. Keyboard users get
        // a label beside the focused icon when its focus ring is visible.
        if (!event.target.matches?.(":focus-visible")) return;
        const label = this.domLabel(event.target);
        if (!label) return;
        const rect = event.target.getBoundingClientRect();
        this.x = rect.right;
        this.y = rect.top;
        this.show(label, "focus");
      },
      { signal: this.events.signal },
    );
    document.addEventListener(
      "focusout",
      () => {
        if (this.source === "focus") this.clear();
      },
      { signal: this.events.signal },
    );
  }

  domLabel(element) {
    const control = element?.closest(ICON_CONTROL);
    if (!control || control.disabled) return "";
    if (control.id === "theme-toggle")
      return this.isDarkMode() ? "Turn the lights on" : "Turn the lights off";
    if (control.id === "back-button") return "Back to the room";
    if (control.classList.contains("hamburger-btn"))
      return control.classList.contains("active") ? "Close menu" : "Open menu";
    return (
      control.dataset.tooltip ||
      control.getAttribute("aria-label") ||
      "Close panel"
    );
  }

  update(object) {
    if (this.source === "focus") return;
    if (!this.hasPointer || this.dragging || document.hidden) {
      this.clearScene();
      return;
    }
    const surface = document.elementFromPoint(this.x, this.y);
    const domLabel = this.domLabel(surface);
    if (domLabel) {
      this.show(domLabel, "dom");
      return;
    }
    if (surface?.closest(UI_SURFACE) || !object) {
      this.clear();
      return;
    }
    const label = this.getLabel(object);
    if (label) this.show(label, "scene");
    else this.clearScene();
  }

  show(label, source) {
    // Native dialogs live in the top layer; their icon tooltips live there too.
    const host = document.querySelector("dialog[open]") || document.body;
    if (this.element.parentElement !== host) {
      host.append(this.element);
      this.width = 0;
    }
    this.source = source;
    const changed = this.element.textContent !== label;
    if (changed) this.element.textContent = label;
    this.element.hidden = false;
    if (changed || !this.width) {
      this.width = this.element.offsetWidth;
      this.height = this.element.offsetHeight;
    }
    const gap = 16;
    let left = this.x + gap;
    let top = this.y + gap;
    if (left + this.width > window.innerWidth - 8)
      left = this.x - this.width - gap;
    if (top + this.height > window.innerHeight - 8)
      top = this.y - this.height - gap;
    this.element.style.left = `${Math.max(8, Math.min(left, window.innerWidth - this.width - 8))}px`;
    this.element.style.top = `${Math.max(8, Math.min(top, window.innerHeight - this.height - 8))}px`;
  }

  clearScene() {
    if (this.source === "scene") this.clear();
    else if (this.source === "dom") {
      const label = this.domLabel(document.elementFromPoint(this.x, this.y));
      if (label && this.hasPointer && !this.dragging) this.show(label, "dom");
      else this.clear();
    }
  }
  clear() {
    this.element.hidden = true;
    this.source = null;
  }
  reset() {
    this.hasPointer = false;
    this.clear();
  }
  dispose() {
    this.events.abort();
    this.element.remove();
  }
}
