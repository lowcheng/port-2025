/**
 * AppState.js – Centralised application state
 * Holds references to 3D core, UI hooks, shared managers, and feature flags.
 */

import * as THREE from "three";

class AppState {
  constructor() {
    /* ───────────────────────────────────
     * DEBUGGING STATE
     * - Manually toggle this property to enable/disable debug features.
     * ─────────────────────────────────── */
    //this.isDebugMode = false; // <-- SET TO `true` to debug, `false` for production
    this.isDebugMode = true; // <-- SET TO `true` to debug, `false` for production

    if (this.isDebugMode) {
      console.log(
        "%c 🐛 DEBUG MODE ACTIVATED ",
        "background: #ff4500; color: #ffffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;",
      );
      document.body.classList.add("debug-mode");
    }

    /* ───────────────────────────────────
     * Raycasting state
     * Use these flags + references to globally freeze input when modals open, etc.
     * ─────────────────────────────────── */
    this.isRaycastEnabled = true;
    this.currentIntersects = [];
    this.raycasterController = null;

    /* ───────────────────────────────────
     * Scene object handles (filled after GLTF load / setup)
     * Keep them nullable to gate logic.
     * ─────────────────────────────────── */
    this.pigObject = null;
    this.steamMesh = null;
    this.whiteboard = null;
    this.environment = null;
    this.environmentShaderController = null;
    this.particleTrail = null; // <-- ADD THIS LINE

    /* ───────────────────────────────────
     * Collections
     * Group objects by behaviour so systems can loop efficiently.
     * ─────────────────────────────────── */
    this.animatedObjects = {
      spin: [],
      scale: [],
      scaleLights: [],
      keycaps: [],
      lights: [],
    };
    this.raycasterObjects = [];

    /* ───────────────────────────────────
     * Three.js core references
     * Set once during bootstrap; used by sub-systems.
     * ─────────────────────────────────── */
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.pointer = null;
    this.raycaster = null;
    this.loadingManager = null;
    this.textureLoader = null;
    this.gltfLoader = null;
    this.composer = null;
    this.outlinePass = null;
    this.mixers = []; // holds AnimationMixers

    /* ───────────────────────────────────
     * Managers
     * e.g. for camera transitions, iFrame/monitor, , etc.
     * ─────────────────────────────────── */
    this.cameraManager = null;
    this.innerWeb = null;

    /* ───────────────────────────────────
     * UI hooks (DOM elements / callbacks)
     * Injected by UI initializer so scene code doesn’t touch DOM.
     * ─────────────────────────────────── */
    this.overlay = null;
    this.modals = null;
    this.showModal = null;
    this.hideModal = null;
    this.showImageOverlay = null;
    this.hideImageOverlay = null;

    /* ───────────────────────────────────
     * Canvas / sizing
     * ─────────────────────────────────── */
    this.canvas = null;
    this.sizes = { width: window.innerWidth, height: window.innerHeight };
    this.clock = new THREE.Clock();
  }

  /* ===== Debugging Helpers ======================================== */
  /**
   * Checks if the application is currently in debug mode.
   * @returns {boolean}
   */
  isInDebugMode() {
    return this.isDebugMode;
  }
  addMixer(m) {
    if (m) this.mixers.push(m);
  }

  /* ===== Ray-casting helpers ======================================= */
  /** Inject the RaycasterController instance once created. */
  setRaycasterController(controller) {
    this.raycasterController = controller;
  }

  /** Globally enable raycast input */
  enableRaycast() {
    console.log("Enabling raycast");
    this.isRaycastEnabled = true;
    this.raycasterController?.enable();
  }

  /** Globally disable raycast input and clear UX affordances */
  disableRaycast() {
    console.log("Disabling raycast");
    this.isRaycastEnabled = false;
    this.raycasterController?.disable();
    this.resetCursor();
    this.clearHoverEffects();
  }

  /** Reset cursor style across common layers */
  resetCursor() {
    document.body.style.cursor = "default";
    document.documentElement.style.cursor = "default";
    if (this.canvas) this.canvas.style.cursor = "default";
    if (this.overlay) this.overlay.style.cursor = "default";
  }

  setCurrentIntersects(intersects) {
    this.currentIntersects = intersects;
  }
  clearIntersects() {
    this.currentIntersects = [];
  }

  /* ===== Scene-object setters ====================================== */

  setPigObject(obj) {
    this.pigObject = obj;
  }

  setSteamMesh(mesh) {
    this.steamMesh = mesh;
  }
  setWhiteboard(whiteboard) {
    this.whiteboard = whiteboard;
  }

  /* ===== Core Three.js components ================================== */

  setThreeJSComponents(c) {
    this.scene = c.scene;
    this.camera = c.camera;
    this.renderer = c.renderer;
    this.pointer = c.pointer;
    this.raycaster = c.raycaster;
    this.loadingManager = c.loadingManager;
    this.textureLoader = c.textureLoader;
    this.gltfLoader = c.gltfLoader;
  }

  /** Post-processing setup */

  setPostProcessing(composer, outlinePass) {
    this.composer = composer;
    this.outlinePass = outlinePass;
  }

  /* ===== Managers =================================================== */

  setCameraManager(mgr) {
    this.cameraManager = mgr;
  }
  setInnerWeb(iw) {
    this.innerWeb = iw;
  }

  /* ===== UI components ============================================= */

  setModalSystem(overlay, modals, showModal, hideModal) {
    this.overlay = overlay;
    this.modals = modals;
    this.showModal = showModal;
    this.hideModal = hideModal;
  }

  setImageOverlay(show, hide) {
    this.showImageOverlay = show;
    this.hideImageOverlay = hide;
  }

  /* ===== Canvas / sizing =========================================== */

  setCanvas(canvas) {
    this.canvas = canvas;
  }
  updateSizes(w, h) {
    this.sizes.width = w;
    this.sizes.height = h;
  }

  /* ===== Collections ============================================== */

  addAnimatedObject(type, obj) {
    if (this.animatedObjects[type]) this.animatedObjects[type].push(obj);
  }

  addRaycasterObject(obj) {
    this.raycasterObjects.push(obj);
  }

  /* ===== Utility =================================================== */
  /** Clear hover visuals (e.g., outline pass) and cached hits */
  clearHoverEffects() {
    this.currentIntersects = [];
    if (this.outlinePass) this.outlinePass.selectedObjects = [];
  }

  /** Shared clock – useful for time-based animations */
  getElapsedTime() {
    return this.clock.getElapsedTime();
  }
}

/*  Export a singleton instance  */
export default new AppState();
