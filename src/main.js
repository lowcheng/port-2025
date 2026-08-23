import * as THREE from "three";
import gsap from "gsap";

// Core imports
import EventHandler from "./scripts/core/EventHandler.js";
import { initializeAll } from "./scripts/core/Initializer.js";
import { initializeUI } from "./scripts/ui/UIInitializer.js";
import "./style.scss";
import RaycasterController from "./scripts/core/RaycasterController.js";
import createRenderLoop from "./scripts/core/RenderLoop.js";
import { setupLoadingScreen } from "./scripts/ui/LoadingManager.js";
import {
  initModalOverlay,
  initSidePanel,
  initBackButton,
} from "./scripts/ui/UIHandlers.js";
// Application State
import appState from "./scripts/core/AppState.js";
import {
  processScene,
  createGrassTerrain,
  createSceneContactShadows,
} from "./scripts/core/SceneProcessor.js"; // Singleton Managers
import themeManager from "./scripts/themeManager.js";
import audioManager from "./scripts/core/audio.js";

// Features
import { setupMailbox } from "./scripts/special-interactions/mailbox.js";
import { setupAudioSliders } from "./scripts/special-interactions/audioSliders.js";
import { setupLampSwitch } from "./scripts/special-interactions/lampSwitch.js";

import { initImageOverlay } from "./scripts/fadeOverlayImage.js";
import { createSteamEffect } from "./scripts/shaders/steamEffect.js";
import CursorOverlay from "./scripts/effects/CursorOverlay.js";
import ErhuInteraction from "./scripts/special-interactions/erhu.js";
import CalendarDate from "./scripts/utils/calenderDate.js";
import { initSkybox } from "./scripts/shaders/SkyboxShader.js";
import { setupLensFlare } from "./scripts/shaders/LensFlare.js";
import { loadEnvironment } from "./scripts/core/EnvironmentLoader.js";
// Configuration
import {
  imageData,
  socialLinks,
  CANVAS_CONFIG,
  CAMERA_CONFIG,
  WHITEBOARD_CONFIG,
  INNER_WEB_CONFIG,
  STEAM_CONFIG,
  MODAL_SELECTORS,
  IMAGE_OVERLAY_SELECTORS,
  LOADING_SELECTORS,
  SIDE_PANEL_SELECTORS,
  ANIMATION_DURATIONS,
  MODEL_PATHS,
  BUTTON_IDS,
} from "./scripts/config/constants.js";

import { IntroTutorial } from "./scripts/ui/IntroTutorial.js";
import ParticleTrail from "./scripts/unused/ParticleTrail.js";
// Add to your main initialization (around line where you setup other components)
let introTutorial = null;
/**
 * ===================================================================
 * LOADING MANAGER SETUP
 * ===================================================================
 */

/**
 * ===================================================================
 * SCENE LOADING
 * ===================================================================
 */
function loadScene(environmentReady = Promise.resolve()) {
  appState.gltfLoader.load("/models/RoomV3_export-v1.glb", (glb) => {
    const clips = glb.animations || [];

    // ─────────────────────────────────────────
    //  MUG + IDLE ANIMATIONS
    // ─────────────────────────────────────────
    const mixer = new THREE.AnimationMixer(glb.scene);

    if (!appState.mixers) appState.mixers = [];
    appState.mixers.push(mixer);

    const idleClip = THREE.AnimationClip.findByName(clips, "Idle");
    let idleAction = null;

    if (idleClip) {
      idleAction = mixer.clipAction(idleClip);
      idleAction.setLoop(THREE.LoopRepeat);
      idleAction.clampWhenFinished = false;
      idleAction.timeScale = 2; // 1.5x faster idle
      idleAction.play();

      console.log(
        "Idle action running?",
        idleAction.isRunning(),
        "weight:",
        idleAction.getEffectiveWeight(),
      );
    }
    const erhuMesh = glb.scene.getObjectByName("erhu-three-raycast");
    if (erhuMesh) {
      const erhuInteraction = new ErhuInteraction(
        appState.scene,
        erhuMesh,
        false,
      ); // true = show debug
      appState.erhuInteraction = erhuInteraction;

      // Attach to raycaster controller if it exists
      if (appState.raycasterController) {
        appState.raycasterController.erhuInteraction = erhuInteraction;
      }

      console.log("Erhu interaction setup complete");
    } else {
      console.warn("Erhu mesh not found - check object name");
    }

    appState.peashooterIdleAction = idleAction;

    // ─────────────────────────────────────────
    //  PROCESS SCENE + ADD
    // ─────────────────────────────────────────
    const { grassGround: legacyGrassGround } = processScene(glb.scene);
    environmentReady.then((environmentController) => {
      const environmentGrassGround = environmentController?.grassGround;
      const activeGrassGround = environmentGrassGround ?? legacyGrassGround;

      if (environmentGrassGround && legacyGrassGround) {
        legacyGrassGround.visible = false;
      } else if (!environmentGrassGround) {
        console.warn(
          "[Environment] ENV_Grass_Ground was not found in env.glb; using the legacy room grass plane.",
        );
      }

      appState.contactShadowGroup = createSceneContactShadows(
        appState.scene,
        {
          environmentRoot: environmentController?.root,
          roomRoot: glb.scene,
          roomGroundReference: legacyGrassGround,
          groundRoot: environmentController?.groundRoot,
          groundMesh: activeGrassGround,
        },
      );

      appState.grassMaterial = createGrassTerrain(
        appState.scene,
        activeGrassGround,
        {
          environmentRoot: environmentController?.root,
          roomRoot: glb.scene,
          roomGroundReference: legacyGrassGround,
        },
      );
    });
    appState.audioSliderController = setupAudioSliders(glb.scene);
    appState.lampSwitch = setupLampSwitch(glb.scene);
    if (appState.raycasterController) {
      appState.raycasterController.lampSwitch = appState.lampSwitch;
    }
    appState.scene.add(glb.scene);
    //  PROCESS SCENE + ADD
    // ─────────────────────────────────────────
    //  MONITOR HOVER GROUP + RAYCAST SETUP
    // ─────────────────────────────────────────
    const MONITOR_GROUP_ID = "monitorSet";

    glb.scene.traverse((obj) => {
      if (!obj.isMesh) return;

      // adjust this condition to match your monitor naming (e.g. "monitor-raycast")
      if (obj.name && obj.name.includes("monitor")) {
        // make this mesh part of the monitor hover group
        obj.userData.hoverGroup = MONITOR_GROUP_ID;

        // make sure it's in the raycaster list
        appState.addRaycasterObject(obj);
      }
    });

    // ─────────────────────────────────────────
    //  CALENDAR 3D DATE SETUP
    // ─────────────────────────────────────────
    const calAnchor = glb.scene.getObjectByName("cal-anchor");
    console.log("cal-anchor:", calAnchor);

    if (calAnchor) {
      if (calAnchor.isMesh && calAnchor.material) {
        calAnchor.material.transparent = true;
        calAnchor.material.opacity = 0;
        calAnchor.material.depthWrite = false;
      }

      const calendarDate = new CalendarDate({
        parent: calAnchor,
        fontUrl: "/fonts/Sniglet_Regular.json",
        size: 0.14,
        height: 0.003,
        color: 0xffffff,
        offset: new THREE.Vector3(0, 0, 0.01),
        letterSpacing: 0.025, // tweak this to widen / tighten
      });

      appState.calendarDate = calendarDate;

      // initial theme + subscribe
      console.log("Calendar 3D date initialized on cal-anchor");
    }

    // ─────────────────────────────────────────
    //  EMBEDDED PEASHOOTER SETUP (NO EXTERNAL GLB)
    // ─────────────────────────────────────────
    const embeddedPea =
      glb.scene.getObjectByName("peashooter-nine") ||
      glb.scene.getObjectByName("peashooter") ||
      glb.scene.getObjectByName("Peashooter");

    if (embeddedPea) {
      console.log("[Pea] Embedded peashooter found:", embeddedPea);

      embeddedPea.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;

        const name = o.name || "(no-name)";
        const matType = o.material ? o.material.type : "none";

        // make sure themed ShaderMaterial still supports skinning
        if (o.isSkinnedMesh && o.material && "skinning" in o.material) {
          o.material.skinning = true;
        }

        o.frustumCulled = false;
        o.visible = true;

        console.log("[Pea] submesh:", {
          name,
          isSkinned: !!o.isSkinnedMesh,
          matType,
          skinning: o.material && o.material.skinning,
        });
      });

      // Store for later use
      appState.peashooter = embeddedPea;

      // Optional debug box to check position
      const peaBox = new THREE.Box3().setFromObject(embeddedPea);
      const peaCenter = peaBox.getCenter(new THREE.Vector3());
      console.log("[Pea] embedded peashooter center:", peaCenter);
      // const peaHelper = new THREE.Box3Helper(peaBox);
      // appState.scene.add(peaHelper);
    } else {
      console.warn(
        "[Pea] No embedded peashooter found – check object name in Blender.",
      );
    }

    // ─────────────────────────────────────────
    //  MAILBOX SETUP
    // ─────────────────────────────────────────
    const mailbox = setupMailbox(glb.scene, {
      showModal: appState.showModal,
    });

    if (appState.raycasterController) {
      appState.raycasterController.mailbox = mailbox;
    }

    initializeTutorial();
    playIntroAnimation();
  });
}

// New function to initialize the tutorial system
function initializeTutorial() {
  // Make sure raycaster controller is available
  if (!appState.raycasterController) {
    console.warn(
      "RaycasterController not available yet, tutorial may not work properly",
    );
  }

  introTutorial = new IntroTutorial({
    scene: appState.scene,
    camera: appState.camera,
    renderer: appState.renderer,
    raycasterController: appState.raycasterController,
  });
  appState.introTutorial = introTutorial;
}

function restartTutorial() {
  if (introTutorial) {
    introTutorial.start();
  }
}

// Optional: Add keyboard shortcut to restart tutorial
document.addEventListener("keydown", (event) => {
  if (event.key === "T" && event.ctrlKey) {
    // Ctrl+T to restart tutorial
    event.preventDefault();
    restartTutorial();
  }
});

/**
 * ===================================================================
 * ANIMATIONS
 * ===================================================================
 */

// Modify your playIntroAnimation function to include tutorial
function playIntroAnimation() {
  const t1 = gsap.timeline({
    duration: 0.8,
    ease: "back.out(1.8)",
    onComplete: () => {
      const onIntroComplete = () => {
        console.log("Intro animation complete. Starting tutorial.");
        // Start tutorial after the camera has settled
        if (introTutorial) {
          introTutorial.start();
        }
      };
      // If debug mode is on, skip the animation and snap to the final position.
      if (appState.isInDebugMode()) {
        console.log("Skipping intro animation due to debug mode.");
        appState.cameraManager.resetToDefault(0); // Instantly snap to default
        onIntroComplete();
        return;
      }

      //sweep', 'reveal', or 'orbit'

      const animationStyle = "reveal";
      const animationDuration = 5.0;

      appState.cameraManager.playIntroAnimation(
        animationStyle,
        animationDuration,
        onIntroComplete,
      );
    },
  });
}

/**
 * ===================================================================
 * EVENT LISTENERS SETUP
 * ===================================================================
 */

function setupEventListeners() {
  // Event handlers
  const handlers = new EventHandler({
    themeButton: document.getElementById(BUTTON_IDS.themeToggle),
    // soundButton: document.getElementById(BUTTON_IDS.soundToggle),
    backButton: document.getElementById(BUTTON_IDS.backButton),
    themeManager,
    audioManager,
    body: document.body,
    camera: appState.camera,
    renderer: appState.renderer,
    innerWeb: appState.innerWeb,
    composer: appState.composer,
    sizes: appState.sizes,
    cameraManager: appState.cameraManager,
    whiteboard: appState.whiteboard,
    loadingButton: document.querySelector(LOADING_SELECTORS.button),
    pointer: appState.pointer,
  });

  handlers.registerThemeToggle();
  // handlers.registerSoundToggle();
  handlers.registerResize();
  handlers.registerKeyboard();
  handlers.registerLoadingButton();
  handlers.registerPointerMove();

  initModalOverlay();
  initSidePanel();
  initBackButton();
  console.log("Event listeners set up");
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize core components using the new Initializer
  initializeAll();

  // Initialize UI and other components
  initializeUI();
  // createTVEyesPlane();
  //appState.tvEyes.setPupilSize(0.4);
  const cursorFX = new CursorOverlay({
    mode: "paw",
    zIndex: 50,
    domElement: appState.renderer.domElement,

    // Return true => suppress (hide) the orbit/pan HUD for this press.
    shouldSuppress: (e) => {
      // 1) If clicking standard HTML controls
      const ui = e.target.closest?.(
        "button, a, [role='button'], input, select, textarea",
      );
      if (ui) return true;

      // 2) If your 3D raycaster says this is an interactive hit
      // (adapt to your API; using a hypothetical pick(x,y) here)
      const hit = appState.raycasterController?.pick?.(e.clientX, e.clientY);
      if (
        hit &&
        (hit.object?.userData?.interactive || hit.object?.userData?.ui)
      ) {
        return true;
      }

      // 3) If you’re holding a modifier that means “not orbiting”
      if (e.shiftKey || e.altKey || e.metaKey) return true;

      // otherwise, allow the HUD
      return false;
    },
  });

  if (appState.renderer?.domElement?.style) {
    appState.renderer.domElement.style.touchAction = "none";
    // block native drag & text selection on the WebGL canvas
    appState.renderer.domElement.style.userSelect = "none";
    appState.renderer.domElement.setAttribute("draggable", "false");
    appState.renderer.domElement.addEventListener("dragstart", (e) => {
      e.preventDefault();
    });
  }
  cursorFX.start();

  // toggle with a key (SHIFT + C)
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "c" && e.shiftKey) {
      cursorFX.nextMode();
      console.log("Cursor FX mode:", cursorFX.mode);
    }
  });
  /* ──────────────────────────────────────────────
   Image overlay → toggle the ray-caster
   ────────────────────────────────────────────── */
  const { showImageOverlay, hideImageOverlay } = initImageOverlay({
    onOpen: () => appState.disableRaycast(),
    onClose: () => appState.enableRaycast(),
  });

  // Make it available to the rest of the app
  appState.showImageOverlay = showImageOverlay;
  appState.hideImageOverlay = hideImageOverlay;

  // ─────────────────────────────────────────────
  // Mailbox setup – hook into scene + modal system
  // ─────────────────────────────────────────────

  // create controller (camera & empty list for now)
  const rayCtrl = new RaycasterController(
    appState.camera,
    appState.raycasterObjects,
    {
      outlinePass: appState.outlinePass,
      scaleTargets: appState.animatedObjects.scale,
      // mailbox will be attached later, after GLB is loaded
    },
  );

  appState.setRaycasterController(rayCtrl);

  setupLoadingScreen();
  setupEventListeners();

  // Load scene and start render loop
  const environmentReady = loadEnvironment().catch((error) => {
    console.error("[Environment] Failed to load env.glb", error);
  });
  loadScene(environmentReady);
  // loadPeashooter();

  appState.skyboxController = initSkybox(
    appState.scene,
    appState.camera,
    appState.textureLoader,
    themeManager.uMixRatio,
  );
  // ==========================================
  // In main.js
  // In your main.js file
  const { sunMesh, lensFlarePass } = setupLensFlare(
    appState.scene,
    appState.composer,
  );
  appState.sunMesh = sunMesh;
  appState.lensFlarePass = lensFlarePass;

  // Make sure it resizes correctly!
  window.addEventListener("resize", () => {
    if (appState.lensFlarePass) {
      appState.lensFlarePass.uniforms.uScreenSize.value.set(
        window.innerWidth,
        window.innerHeight,
      );
    }
  });

  // setupSteamEffect();
  // right after setupSteamEffect() or wherever you want the loop to begin
  const renderLoop = createRenderLoop({ introTutorial });
  renderLoop.start();
});
