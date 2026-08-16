// scripts/core/RenderLoop.js
import appState from "../core/AppState.js";
import clockManager from "../clock.js";
import { updateRotatingObjects } from "../utils/objectRotation.js";
import * as THREE from "three";
import themeManager from "../themeManager.js"; // ⬅️ add this

function cursorUVOnPlane(plane, camera, ndcX, ndcY) {
  const origin = camera.position.clone();
  const dir = new THREE.Vector3(ndcX, ndcY, 0.5)
    .unproject(camera)
    .sub(origin)
    .normalize();
  const ray = new THREE.Ray(origin, dir);

  const planePos = new THREE.Vector3().setFromMatrixPosition(plane.matrixWorld);
  const planeQuat = new THREE.Quaternion().setFromRotationMatrix(
    plane.matrixWorld,
  );
  const planeNormal = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(planeQuat)
    .normalize();
  const worldPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    planeNormal,
    planePos,
  );

  const hit = new THREE.Vector3();
  if (!ray.intersectPlane(worldPlane, hit)) return null;

  const inv = new THREE.Matrix4().copy(plane.matrixWorld).invert();
  const local = hit.applyMatrix4(inv); // PlaneGeometry(1,1) => x,y in [-0.5..0.5]

  // ❌ no clamp here
  return { x: local.x + 0.5, y: local.y + 0.5 };
}

/**
 * Sets up requestAnimationFrame loop and exposes a `start()` method.
 * Call start() once (after scene + camera are ready).
 */
export default function createRenderLoop() {
  let rafId = null;
  const clock = appState.clock || (appState.clock = new THREE.Clock());

  function loop() {
    /* --- 1. camera & controls ------------------------------------- */
    appState.cameraManager.update();

    const dt = clock.getDelta(); // now clock exists

    // advance any animation mixers
    if (appState.mixers) {
      for (const m of appState.mixers) m.update(dt);
    }
    /* --- 2. global time ------------------------------------------- */
    const elapsed = appState.getElapsedTime();

    /* --- 3. animations -------------------------------------------- */
    updateRotatingObjects();
    clockManager.updateClockHands();

    /* --- 4. raycaster --------------------------------------------- */
    if (appState.isRaycastEnabled) {
      const hits = appState.raycasterController.update(
        appState.pointer.x,
        appState.pointer.y,
      );
      // Always look at the cursor, even off the plane
      if (appState.tvEyes && appState.tvEyesPlane) {
        const uv = cursorUVOnPlane(
          appState.tvEyesPlane,
          appState.camera,
          appState.pointer.x, // NDC X (-1..1)
          appState.pointer.y, // NDC Y (-1..1)
        );
        if (uv) {
          // TVEyesChannel flips Y internally; pass v as-is
          appState.tvEyes.setTargetUV({ x: uv.x, y: 1 - uv.y });
        }
      }
      appState.setCurrentIntersects(hits);
    } else {
      appState.clearIntersects();
      appState.raycasterController.clearHover();
    }

    if (appState.grassMaterial) {
      appState.grassMaterial.uniforms.uTime.value = elapsed;
    }
    if (appState.environmentShaderController) {
      appState.environmentShaderController.update(elapsed);
    }
    if (appState.audioSliderController) {
      appState.audioSliderController.update(elapsed);
    }
    // 3. ADD THIS TO UPDATE THE TRAIL
    if (appState.particleTrail) {
      +appState.particleTrail.update(dt);
    }
    /* --- 5. whiteboard -------------------------------------------- */
    if (appState.whiteboard?.isActive) appState.whiteboard.update();

    /* --- 6. steam shader ------------------------------------------ */
    if (appState.steamMesh) {
      appState.steamMesh.material.uniforms.uTime.value = elapsed;
    }
    if (appState.skyboxController) {
      appState.skyboxController.update(elapsed);
    }

    // ===============================================================
    //  ADD THIS NEW SECTION
    // ===============================================================
    /* --- 7. Intro Tutorial Update --------------------------------- */
    // Check if the tutorial exists and is active before updating
    if (appState.introTutorial?.isActive) {
      appState.introTutorial.update();
    }
    //   if (appState.tvEyes) appState.tvEyes.update();

    // inside your render loop tick:
    /* --- 8. Erhu Particles ---------------------------------------- */
    if (appState.erhuInteraction) {
      appState.erhuInteraction.update(dt);
    }
    if (appState.calendarDate) {
      appState.calendarDate.updateFromMix(themeManager.uMixRatio.value);
    }

    /* --- 9. Lens Flare Tracking ----------------------------------- */
    if (appState.sunMesh && appState.lensFlarePass) {
      // Grab the physical sphere's position
      const sunPos = appState.sunMesh.position.clone();

      // Project it against your camera
      sunPos.project(appState.camera);

      // If it's behind the camera, turn off the flare
      if (sunPos.z > 1.0) {
        appState.lensFlarePass.uniforms.uIntensity.value = 0.0;
      } else {
        // Convert screen coordinates (-1 to 1) into Shader UV coordinates (0 to 1)
        const u = (sunPos.x + 1.0) * 0.5;
        const v = (sunPos.y + 1.0) * 0.5;

        // Smooth fade margin (20% off screen edges)
        const margin = 0.2;
        let fadeU = 1.0;
        let fadeV = 1.0;

        if (u < -margin) fadeU = 0.0;
        else if (u < 0.0) fadeU = 1.0 + u / margin;
        else if (u > 1.0 + margin) fadeU = 0.0;
        else if (u > 1.0) fadeU = 1.0 - (u - 1.0) / margin;

        if (v < -margin) fadeV = 0.0;
        else if (v < 0.0) fadeV = 1.0 + v / margin;
        else if (v > 1.0 + margin) fadeV = 0.0;
        else if (v > 1.0) fadeV = 1.0 - (v - 1.0) / margin;

        const fade = Math.min(fadeU, fadeV);

        // Apply it to the shader!
        appState.lensFlarePass.uniforms.uLightPos.value.set(u, v);
        appState.lensFlarePass.uniforms.uIntensity.value = 0.8 * fade;
      }

      appState.lensFlarePass.uniforms.uTime.value = elapsed;
    }

    /* --- 7. render passes ----------------------------------------- */
    appState.innerWeb.render();
    appState.composer.render();

    rafId = requestAnimationFrame(loop);
  }

  return {
    start() {
      if (!rafId) loop();
    },
    stop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
