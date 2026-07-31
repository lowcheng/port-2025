// IntroTutorial.js -
import * as THREE from "three";
import gsap from "gsap";
import appState from "../core/AppState.js"; // adjust path if needed

export class IntroTutorial {
  constructor(options = {}) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.renderer = options.renderer;
    this.raycasterController = options.raycasterController;
    this.cameraControls = options.cameraControls;

    this.isActive = false;
    this.currentStep = 0;
    this.tutorialSteps = [];

    this.cursorSize = options.cursorSize || 32; // Default to 32px
    this.cursorOffset = this.cursorSize / 2; // Calculate offset automatically

    this.ui = {
      overlay: null,
      cursor: null,
      bubble: null,
      bubbleContent: null,
      skipButton: null,
      prevButton: null,
      nextButton: null,
      currentStepIndicator: null,
      totalStepsIndicator: null,
    };

    this.currentHighlightedElement = null;

    this.animationSpeed = 1;
    this.glowPulseSpeed = 1.5;
    this.pulseAnimation = null;
    this.currentHighlightedObjects = null;
    this.originalOutlineValues = null;
    this.originalCameraControlsEnabled = true;

    this.init();
  }

  init() {
    this.createUI();
    this.createAnchorObjects();
    this.setupTutorialSteps();
  }

  createAnchorObjects() {
    const welcomeAnchor = new THREE.Object3D();
    welcomeAnchor.name = "tutorial-welcome-anchor";
    welcomeAnchor.position.set(0, 1.5, 3);
    this.scene.add(welcomeAnchor);

    const conclusionAnchor = new THREE.Object3D();
    conclusionAnchor.name = "tutorial-conclusion-anchor";
    conclusionAnchor.position.set(0, 1.5, 3);
    this.scene.add(conclusionAnchor);
  }

  createUI() {
    const template = document.getElementById("tutorial-template");
    if (!template) {
      console.error("Tutorial template not found in HTML!");
      return;
    }
    const tutorialFragment = template.content.cloneNode(true);
    this.ui.overlay = tutorialFragment.querySelector(".tutorial-overlay");
    document.body.appendChild(tutorialFragment);

    this.ui.cursor = this.ui.overlay.querySelector(".tutorial-cursor");
    if (this.ui.cursor) {
      this.ui.cursor.style.width = `${this.cursorSize}px`;
      this.ui.cursor.style.height = `${this.cursorSize}px`;
    }

    this.ui.bubble = this.ui.overlay.querySelector(".speech-bubble");
    this.ui.bubbleContent = this.ui.overlay.querySelector(".bubble-content");
    this.ui.skipButton = this.ui.overlay.querySelector(".tutorial-skip");
    this.ui.prevButton = this.ui.overlay.querySelector("#prevBtn");
    this.ui.nextButton = this.ui.overlay.querySelector("#nextBtn");
    this.ui.currentStepIndicator =
      this.ui.overlay.querySelector(".current-step");
    this.ui.totalStepsIndicator = this.ui.overlay.querySelector(".total-steps");

    this.ui.skipButton.addEventListener("click", () => this.skip());
    this.ui.prevButton.addEventListener("click", () => this.previousStep());
    this.ui.nextButton.addEventListener("click", () => this.nextStep());
  }

  setupTutorialSteps() {
    this.tutorialSteps = [
      {
        target: "tutorial-welcome-anchor",
        message:
          "Welcome! This is my interactive 3D portfolio (built with three.js). Still a work-in-progress—here’s all you need to know.",
        placement: "top",
      },
      {
        target: "tutorial-welcome-anchor",
        message:
          "Objects you can interact with will glow when you hover them. Move your cursor around anytime to discover things.",
        placement: "top",
        massPreview: true,
        outline: {
          strength: 2.2,
          thickness: 1.6,
          pulse: true,
          color: 0xffffff,
        }, // ↓ softer
      },

      {
        domTarget: "#theme-toggle",
        message: "Try toggling night mode here!",
        placement: "right",
        offsetCursor: true,
      },
      {
        domTarget: "#sound-toggle",
        message: "Sound on/off here.",
        placement: "right",
        offsetCursor: true,
      },
      {
        target: "tutorial-conclusion-anchor",
        message:
          "That’s it—hover = discover, click = interact. Explore freely.",
        placement: "top",
      },
    ];

    if (this.ui.totalStepsIndicator) {
      this.ui.totalStepsIndicator.textContent = this.tutorialSteps.length;
    }
  }

  // IntroTutorial.js
  start() {
    if (this.isActive) return;

    // 🔧 Skip tutorial completely in debug mode
    if (appState.isInDebugMode && appState.isInDebugMode()) {
      console.log("[IntroTutorial] Skipped (debug mode)");
      this.skip();
      return;
    }

    this.isActive = true;
    this.currentStep = 0;

    this.disableCameraControls();

    this.ui.overlay.classList.add("active");
    gsap.to(this.ui.skipButton, { opacity: 1, duration: 0.5, delay: 0.5 });
    setTimeout(() => this.showStep(0), 500);
  }

  update() {
    if (!this.isActive) return;
    const step = this.tutorialSteps[this.currentStep];
    if (step) {
      this.updateUIPositions(step);
    }
  }

  showStep(stepIndex) {
    if (stepIndex >= this.tutorialSteps.length || stepIndex < 0) return;

    // if we’re leaving a massPreview step, end it now
    const wasPreviewing = !!this._massPreviewActive;

    this.currentStep = stepIndex;
    const step = this.tutorialSteps[stepIndex];

    if (wasPreviewing && !step.massPreview) {
      this._endMassPreview();
    }

    this.ui.currentStepIndicator.textContent = stepIndex + 1;
    this.ui.prevButton.disabled = stepIndex === 0;
    this.ui.nextButton.textContent =
      stepIndex === this.tutorialSteps.length - 1 ? "Finish" : "Next";
    this.ui.bubbleContent.textContent = step.message;

    this.removeOutlineEffect();
    this.removeDomHighlight();

    if (step.highlightObject) {
      this.highlightObject(step.target);
    } else if (step.domTarget) {
      this.highlightDomElement(step.domTarget);
    }

    // start the mass preview when entering that step
    if (step.massPreview && !this._massPreviewActive) {
      this._startMassPreview({
        outline: step.outline || {
          strength: 3.2,
          thickness: 2.2,
          pulse: true,
          color: 0xffffff,
        },
      });
    }

    gsap.fromTo(
      this.ui.bubble,
      { "--bubble-scale": 0.5 },
      { "--bubble-scale": 1, duration: 0.4, ease: "back.out(1.7)" }
    );
    gsap.to(this.ui.cursor, { opacity: 1, duration: 0.4 });
  }

  updateUIPositions(step) {
    let targetScreenPos;
    let cursorTargetPos;

    if (step.domTarget) {
      const element = document.querySelector(step.domTarget);
      if (!element) {
        this.ui.bubble.style.opacity = "0";
        this.ui.cursor.style.opacity = "0";
        return;
      }
      const rect = element.getBoundingClientRect();
      targetScreenPos = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        isOffScreen: false,
      };

      cursorTargetPos = { ...targetScreenPos };

      if (step.offsetCursor) {
        // Added a vertical offset to move the cursor down slightly.
        const horizontalOffset = 15; // Moves cursor to the right
        const verticalOffset = 15; // Moves cursor down

        cursorTargetPos.x += horizontalOffset;
        cursorTargetPos.y += verticalOffset;
      }
    } else if (step.target) {
      const targetObject = this.scene.getObjectByName(step.target);
      if (!targetObject) {
        this.ui.bubble.style.opacity = "0";
        this.ui.cursor.style.opacity = "0";
        return;
      }
      targetScreenPos = this.worldToScreen(
        targetObject.getWorldPosition(new THREE.Vector3())
      );
      cursorTargetPos = { ...targetScreenPos };
    } else {
      return;
    } // The rest of the function remains the same...

    const bubbleRect = this.ui.bubble.getBoundingClientRect();
    if (targetScreenPos.isOffScreen || bubbleRect.width === 0) {
      this.ui.bubble.style.opacity = "0";
      this.ui.cursor.style.opacity = "0";
      return;
    }

    this.ui.bubble.style.opacity = "1";
    this.ui.cursor.style.opacity =
      step.domTarget || step.highlightObject ? "1" : "0";

    const bubblePos = this.getBubblePosition(
      targetScreenPos,
      bubbleRect,
      step.placement || "top"
    );

    this.ui.bubble.style.setProperty(
      "--bubble-x",
      `${bubblePos.x - bubbleRect.width / 2}px`
    );
    this.ui.bubble.style.setProperty(
      "--bubble-y",
      `${bubblePos.y - bubbleRect.height / 2}px`
    );
    this.ui.cursor.style.setProperty(
      "--cursor-x",
      `${cursorTargetPos.x - this.cursorOffset}px`
    );
    this.ui.cursor.style.setProperty(
      "--cursor-y",
      `${cursorTargetPos.y - this.cursorOffset}px`
    );
  }

  worldToScreen(worldPosition) {
    const vector = worldPosition.clone().project(this.camera);
    return {
      x: (vector.x * 0.5 + 0.5) * window.innerWidth,
      y: (vector.y * -0.5 + 0.5) * window.innerHeight,
      isOffScreen: vector.z > 1,
    };
  }

  getBubblePosition(targetPos, bubbleRect, placement) {
    const margin = 40;
    let { x, y } = targetPos;

    const step = this.tutorialSteps[this.currentStep];
    const cursorVisible = step.highlightObject || step.domTarget;
    const offset = cursorVisible ? margin : 0;

    switch (placement) {
      case "top":
        y -= bubbleRect.height / 2 + offset;
        break;
      case "bottom":
        y += bubbleRect.height / 2 + offset;
        break;
      case "left":
        x -= bubbleRect.width / 2 + offset;
        break;
      case "right":
        x += bubbleRect.width / 2 + offset;
        break;
    }

    const halfWidth = bubbleRect.width / 2;
    const halfHeight = bubbleRect.height / 2;
    x = Math.max(halfWidth, Math.min(x, window.innerWidth - halfWidth));
    y = Math.max(halfHeight, Math.min(y, window.innerHeight - halfHeight));

    return { x, y };
  }

  nextStep() {
    if (this.currentStep < this.tutorialSteps.length - 1) {
      this.showStep(this.currentStep + 1);
    } else {
      this.complete();
    }
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  complete() {
    this.isActive = false;
    if (this._massPreviewActive) this._endMassPreview();
    this.removeOutlineEffect();
    this.removeDomHighlight();
    this.enableCameraControls();

    clearTimeout(this._previewTimer);
    this._previewTimer = null;

    const tl = gsap.timeline({
      onComplete: () => this.ui.overlay.classList.remove("active"),
    });
    tl.to([this.ui.cursor, this.ui.bubble, this.ui.skipButton], {
      opacity: 0,
      duration: 0.5,
    });
    tl.to(this.ui.overlay, { opacity: 0, duration: 0.5 }, ">-0.3");
  }

  skip() {
    this.complete();
  }

  disableCameraControls() {
    if (this.cameraControls) {
      this.originalCameraControlsEnabled = this.cameraControls.enabled;
      this.cameraControls.enabled = false;
    }
  }

  enableCameraControls() {
    if (this.cameraControls) {
      this.cameraControls.enabled = this.originalCameraControlsEnabled;
    }
  }

  // ADDED: New methods to handle highlighting DOM elements
  highlightDomElement(selector) {
    this.removeDomHighlight(); // Remove any existing highlight first
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add("tutorial-highlight-dom");
      this.currentHighlightedElement = element;
    }
  }

  removeDomHighlight() {
    if (this.currentHighlightedElement) {
      this.currentHighlightedElement.classList.remove("tutorial-highlight-dom");
      this.currentHighlightedElement = null;
    }
  }

  highlightObject(targetName) {
    if (!this.scene) return;
    const objects = [];
    this.scene.traverse((child) => {
      if (child.name === targetName || child.userData.name === targetName) {
        objects.push(child);
      }
    });
    if (objects.length > 0) this.addOutlineEffect(objects);
  }

  addOutlineEffect(objects) {
    if (!this.raycasterController?.outlinePass) return;
    const outlinePass = this.raycasterController.outlinePass;
    outlinePass.selectedObjects = objects;

    if (!this.originalOutlineValues) {
      this.originalOutlineValues = {
        strength: outlinePass.edgeStrength,
        thickness: outlinePass.edgeThickness,
      };
    }

    if (this.pulseAnimation) this.pulseAnimation.kill();
    outlinePass.edgeStrength = this.originalOutlineValues.strength * 1.5;
    outlinePass.edgeThickness = this.originalOutlineValues.thickness * 1.5;

    this.pulseAnimation = gsap.to(outlinePass, {
      edgeStrength: this.originalOutlineValues.strength * 2.5,
      edgeThickness: this.originalOutlineValues.thickness * 2.0,
      duration: 1.25,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });
  }

  removeOutlineEffect() {
    if (this._massPreviewActive) return; // <- don’t fight the preview

    if (!this.raycasterController?.outlinePass) return;
    if (this.pulseAnimation) {
      this.pulseAnimation.kill();
      this.pulseAnimation = null;
    }

    const outlinePass = this.raycasterController.outlinePass;
    if (this.originalOutlineValues) {
      gsap.to(outlinePass, {
        edgeStrength: this.originalOutlineValues.strength,
        edgeThickness: this.originalOutlineValues.thickness,
        duration: 0.3,
      });
    }
    outlinePass.selectedObjects = [];
  }

  _flattenMeshes(objs) {
    const meshes = [];
    const pushMeshes = (o) => {
      if (!o) return;
      if (o.isMesh) meshes.push(o);
      if (o.children?.length) o.children.forEach(pushMeshes);
    };
    objs.forEach(pushMeshes);
    return meshes;
  }

  _collectAllInteractables() {
    // Prefer your curated list
    if (appState.raycasterObjects && appState.raycasterObjects.length) {
      return this._flattenMeshes(appState.raycasterObjects);
    }

    // Fallback: search by name containing "raycast" (case-insensitive)
    const result = [];
    this.scene.traverse((o) => {
      if (o.isMesh && typeof o.name === "string" && /raycast/i.test(o.name)) {
        result.push(o);
      }
    });
    return result;
  }

  _ensureInteractables() {
    if (!this._allInteractables || this._allInteractables.length === 0) {
      this._allInteractables = this._collectAllInteractables();
    }
  }
  previewAllInteractables(opts = {}) {
    const {
      duration = 1500, // ms
      strength = 1.0, // subtle preview so hover still "wins"
      thickness = 1.0,
      pulse = true,
    } = opts;
    this._ensureInteractables();
    console.log(
      "[TutorialDbg] interactables found:",
      this._allInteractables?.length,
      this._allInteractables?.slice(0, 5).map((o) => o.name)
    );
    if (!this._allInteractables.length) {
      console.warn("[TutorialDbg] No interactables yet; will retry in 500ms");
      clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(
        () => this.previewAllInteractables(opts),
        500
      );
      return;
    }
    const outlinePass =
      this.raycasterController?.outlinePass || appState.outlinePass;
    if (!outlinePass) {
      console.warn(
        "[IntroTutorial] No OutlinePass found; skipping mass preview."
      );
      return;
    }

    this._ensureInteractables();
    if (!this._allInteractables.length) return;

    // Save current settings
    this._prevSelected = outlinePass.selectedObjects.slice();
    if (!this.originalOutlineValues) {
      this.originalOutlineValues = {
        strength: outlinePass.edgeStrength,
        thickness: outlinePass.edgeThickness,
      };
    }

    // Show subtle outline on ALL interactables
    outlinePass.selectedObjects = this._allInteractables;
    outlinePass.edgeStrength = strength;
    outlinePass.edgeThickness = thickness;
    // ⬇️ add this line so your controller pauses the "clear to []" branch
    this.raycasterController?.holdEmptyClear(duration);
    if (pulse) {
      if (this.pulseAnimation) this.pulseAnimation.kill();
      this.pulseAnimation = gsap.to(outlinePass, {
        edgeStrength: strength * 1.4,
        edgeThickness: thickness * 1.25,
        duration: 1.0,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }

    clearTimeout(this._previewTimer);
    this._previewTimer = setTimeout(
      () => this._restoreOutlineAfterPreview(),
      duration
    );
    console.log(
      "[TutorialDbg] after assign len=",
      outlinePass.selectedObjects.length
    );
  }

  _restoreOutlineAfterPreview() {
    const outlinePass =
      this.raycasterController?.outlinePass || appState.outlinePass;
    if (!outlinePass) return;

    if (this.pulseAnimation) {
      this.pulseAnimation.kill();
      this.pulseAnimation = null;
    }

    const toStrength = this.originalOutlineValues?.strength ?? 3.0;
    const toThickness = this.originalOutlineValues?.thickness ?? 2.0;

    gsap.to(outlinePass, {
      edgeStrength: toStrength,
      edgeThickness: toThickness,
      duration: 0.25,
      onComplete: () => {
        // Hand back to normal hover (raycaster) mode
        outlinePass.selectedObjects = [];
      },
    });
  }

  __dbgLogPass(tag) {
    const fromCtrl = this.raycasterController?.outlinePass;
    const fromState = appState.outlinePass;
    const chosen = fromCtrl || fromState;
    console.log(`[TutorialDbg] ${tag}`, {
      hasCtrlPass: !!fromCtrl,
      hasStatePass: !!fromState,
      chosenIsCtrl: chosen === fromCtrl,
      chosenIsState: chosen === fromState,
      edgeStrength: chosen?.edgeStrength,
      edgeThickness: chosen?.edgeThickness,
      selectedLen: chosen?.selectedObjects?.length,
    });
  }

  __dbgWatchSelected(ms = 1000) {
    const pass = this.raycasterController?.outlinePass || appState.outlinePass;
    if (!pass) return;

    const start = performance.now();
    const tick = (t) => {
      const len = pass.selectedObjects?.length ?? -1;
      if (t - start < ms) {
        console.log(
          `[TutorialDbg] selectedObjects.len=${len} @ ${Math.round(t - start)}ms`
        );
        requestAnimationFrame(tick);
      } else {
        console.log(`[TutorialDbg] watch end, final len=${len}`);
      }
    };
    console.log("[TutorialDbg] watch begin");
    requestAnimationFrame(tick);
  }

  _startMassPreview({
    outline = { strength: 3.2, thickness: 2.2, pulse: true, color: 0xffffff },
  } = {}) {
    const pass = this.raycasterController?.outlinePass || appState.outlinePass;
    if (!pass) return;

    this._ensureInteractables();
    if (!this._allInteractables?.length) return;

    // Cache original (including colors)
    if (!this.originalOutlineValues) {
      this.originalOutlineValues = {
        strength: pass.edgeStrength,
        thickness: pass.edgeThickness,
        color: pass.visibleEdgeColor?.clone?.() ?? null,
        hiddenColor: pass.hiddenEdgeColor?.clone?.() ?? null,
        overlay: pass.overlay ?? true,
        edgeGlow: pass.edgeGlow ?? 0.0,
        pulsePeriod: pass.pulsePeriod ?? 0.0,
      };
    }

    // Stronger base
    pass.selectedObjects = this._allInteractables;
    pass.edgeStrength = outline.strength; // e.g. 3.2
    pass.edgeThickness = outline.thickness; // e.g. 2.2
    if (pass.visibleEdgeColor && outline.color != null) {
      pass.visibleEdgeColor.set(outline.color); // bright white
    }

    // Make sure the outline draws on top and blooms a bit
    if ("overlay" in pass) pass.overlay = true;
    if ("edgeGlow" in pass) pass.edgeGlow = 1.0; // adds halo
    if ("pulsePeriod" in pass) pass.pulsePeriod = 0.0;

    // Keep it on until the step changes
    this.raycasterController?.freezeOutline(this._allInteractables);
    this._massPreviewActive = true;

    if (outline.pulse) {
      if (this.pulseAnimation) this.pulseAnimation.kill();
      this.pulseAnimation = gsap.to(pass, {
        edgeStrength: outline.strength * 1.7,
        edgeThickness: outline.thickness * 1.3,
        duration: 1.0,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    }
  }

  _endMassPreview() {
    const pass = this.raycasterController?.outlinePass || appState.outlinePass;
    if (!this._massPreviewActive) return;

    if (this.pulseAnimation) {
      this.pulseAnimation.kill();
      this.pulseAnimation = null;
    }

    this.raycasterController?.thawOutline();

    if (pass) {
      const toStrength = this.originalOutlineValues?.strength ?? 3.0;
      const toThickness = this.originalOutlineValues?.thickness ?? 2.0;

      if (this.originalOutlineValues?.color && pass.visibleEdgeColor) {
        pass.visibleEdgeColor.copy(this.originalOutlineValues.color);
      }
      if (this.originalOutlineValues?.hiddenColor && pass.hiddenEdgeColor) {
        pass.hiddenEdgeColor.copy(this.originalOutlineValues.hiddenColor);
      }

      gsap.to(pass, {
        edgeStrength: toStrength,
        edgeThickness: toThickness,
        duration: 0.25,
        onComplete: () => {
          pass.selectedObjects = [];
        },
      });
    }

    this._massPreviewActive = false;
  }
}
