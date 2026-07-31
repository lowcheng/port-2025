// ./scripts/EventHandler.js
import gsap from "gsap";
export default class EventHandler {
  constructor({
    themeButton,
    soundButton,
    themeManager,
    audioManager,
    body,
    camera,
    renderer,
    innerWeb,
    composer,
    sizes,
    cameraManager,
    whiteboard,
    loadingButton,
    pointer,
  }) {
    // buttons & managers
    this.themeButton = themeButton;
    this.soundButton = soundButton;
    this.themeManager = themeManager;
    this.audioManager = audioManager;
    this.body = body;

    // state
    this.isDarkMode = false;
    this.isMuted = false;

    this._onThemeClick = this._onThemeClick.bind(this);
    this._onSoundClick = this._onSoundClick.bind(this);

    this.camera = camera;
    this.renderer = renderer;
    this.innerWeb = innerWeb;
    this.composer = composer;
    this.sizes = sizes;
    this._onResize = this._onResize.bind(this);

    // Keyboard setup
    this.cameraManager = cameraManager;
    this.whiteboard = whiteboard;
    this.innerWeb = innerWeb;
    this.iframeEnabled = false;

    // Bind it once
    this._onKeyDown = this._onKeyDown.bind(this);

    this.loadingButton = loadingButton;
    this._onLoadingClick = this._onLoadingClick.bind(this);

    this.pointer = pointer;

    this._onPointerMove = this._onPointerMove.bind(this);
  }

  // ─── Theme Toggle ───────────────────────────────────────────────

  registerThemeToggle() {
    this.themeButton.addEventListener("click", this._onThemeClick);
  }

  unregisterThemeToggle() {
    this.themeButton.removeEventListener("click", this._onThemeClick);
  }

  _onThemeClick() {
    this.themeManager.toggleTheme();
    this.isDarkMode = this.themeManager.isDarkMode;
  }

  // ─── Sound Toggle ───────────────────────────────────────────────

  registerSoundToggle() {
    this.soundButton.addEventListener("click", this._onSoundClick);
  }

  unregisterSoundToggle() {
    this.soundButton.removeEventListener("click", this._onSoundClick);
  }

  _onSoundClick() {
    this.isMuted = !this.isMuted;

    this.soundButton.innerHTML = this.isMuted
      ? '<i class="fas fa-volume-mute"></i>'
      : '<i class="fas fa-volume-up"></i>';

    this.isMuted
      ? this.audioManager.pauseBGM()
      : this.audioManager.playBGM(0.25);
  }

  // ─── Window Resize ─────────────────────────────────────────────

  registerResize() {
    window.addEventListener("resize", this._onResize);
  }

  unregisterResize() {
    window.removeEventListener("resize", this._onResize);
  }

  _onResize() {
    // mirror your inline logic
    this.sizes.width = window.innerWidth;
    this.sizes.height = window.innerHeight;

    this.camera.aspect = this.sizes.width / this.sizes.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.innerWeb.onResize();

    this.composer.setSize(this.sizes.width, this.sizes.height);
  }

  // ─── Keyboard Shortcuts ────────────────────────────────────────

  registerKeyboard() {
    window.addEventListener("keydown", this._onKeyDown);
  }

  unregisterKeyboard() {
    window.removeEventListener("keydown", this._onKeyDown);
  }

  _onKeyDown(event) {
    const key = event.key.toLowerCase();

    switch (key) {
      case "o":
        // zoom in and enable drawing
        this.cameraManager.zoomToWhiteboard(this.whiteboard, 1.5);
        break;

      case "p":
        // leave whiteboard
        this.cameraManager.leaveWhiteboard(this.whiteboard, 1.5);
        break;

      case "i":
        // toggle inner-web iframe
        if (this.iframeEnabled) {
          this.innerWeb.disableIframe();
        } else {
          this.innerWeb.enableIframe();
        }
        this.iframeEnabled = !this.iframeEnabled;
        break;
    }
  }
  // ─── Loading-screen Button ─────────────────────────────────────────

  registerLoadingButton() {
    this.loadingButton.addEventListener("click", this._onLoadingClick);
  }

  unregisterLoadingButton() {
    this.loadingButton.removeEventListener("click", this._onLoadingClick);
  }

  _onLoadingClick() {
    if (!this.loadingButton.classList.contains("ready")) return;

    // fade out
    gsap.to(".loading-screen", {
      opacity: 0,
      duration: 1,
      onComplete: () => {
        document.querySelector(".loading-screen").style.display = "none";
      },
    });

    // sounds
    this.audioManager.playClick();
    //    this.audioManager.playBGM(0.1);
    this.audioManager.playBGM(0);
  }
  // ─── Pointer Move ───────────────────────────────────────────────

  registerPointerMove() {
    window.addEventListener("mousemove", this._onPointerMove);
  }

  unregisterPointerMove() {
    window.removeEventListener("mousemove", this._onPointerMove);
  }

  _onPointerMove(event) {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
}
