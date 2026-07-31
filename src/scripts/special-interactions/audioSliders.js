import * as THREE from "three";
import appState from "../core/AppState.js";
import audioManager from "../core/audio.js";

const SLIDER_CONFIG = [
  {
    id: "sfx",
    trackName: "sfx-slider",
    startName: "sfx-slider-start",
    endName: "sfx-slider-end",
    knobName: "SFX-sliderKnob-seven",
    setVolume: (value) => audioManager.setSFXVolume(value),
  },
  {
    id: "bgm",
    trackName: "bgm-slider",
    startName: "bgm-slider-start",
    endName: "bgm-slider-end",
    knobName: "bgm-sliderKnob-seven",
    setVolume: (value) => audioManager.setBGMVolume(value),
  },
];

const SLIDER_FILL_COLOR = 0x5f8397;
const SLIDER_HOVER_COLOR = 0x7ba9bd;
const SLIDER_EMPTY_COLOR = 0xb7b2aa;
const SLIDER_EMPTY_HOVER_COLOR = 0xd0cbc3;

export function setupAudioSliders(sceneRoot) {
  const sliders = SLIDER_CONFIG.map((config) =>
    createSlider(sceneRoot, config),
  ).filter(Boolean);

  if (!sliders.length) return null;

  const controller = new AudioSliderController(sliders);
  controller.register();

  return controller;
}

function createSlider(sceneRoot, config) {
  const track = sceneRoot.getObjectByName(config.trackName);
  const start = sceneRoot.getObjectByName(config.startName);
  const end = sceneRoot.getObjectByName(config.endName);
  const knob = sceneRoot.getObjectByName(config.knobName);

  if (!track || !start || !end || !knob) {
    console.warn(
      `Audio slider "${config.id}" is missing a track, start, end, or knob.`,
    );
    return null;
  }

  track.material = createSliderTrackMaterial();
  const sliderUniforms = track.material.userData.sliderUniforms;

  sliderUniforms.uStart.value.copy(
    track.worldToLocal(getWorldPosition(start)),
  );
  sliderUniforms.uEnd.value.copy(track.worldToLocal(getWorldPosition(end)));

  knob.userData.audioSlider = config.id;
  knob.userData.interactive = true;
  appState.addRaycasterObject(knob);

  return {
    ...config,
    track,
    uniforms: sliderUniforms,
    start,
    end,
    knob,
    value: 0,
    baseScale: knob.scale.clone(),
    targetScale: knob.scale.clone(), // Added for smooth scale animations
    targetFillColor: new THREE.Color(SLIDER_FILL_COLOR),
    targetEmptyColor: new THREE.Color(SLIDER_EMPTY_COLOR),
  };
}

class AudioSliderController {
  constructor(sliders) {
    this.sliders = sliders;
    this.activeSlider = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hoveredSlider = null;
    this.dragStartPointerValue = 0;
    this.dragStartSliderValue = 0;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  register() {
    this.sliders.forEach((slider) => {
      this.updateSliderFromKnob(slider);
    });

    appState.renderer.domElement.addEventListener(
      "pointerdown",
      this._onPointerDown,
      { capture: true },
    );
    window.addEventListener("pointermove", this._onPointerMove, {
      capture: true,
    });
    window.addEventListener("pointerup", this._onPointerUp, { capture: true });
    window.addEventListener("pointercancel", this._onPointerUp, {
      capture: true,
    });
  }

  dispose() {
    appState.renderer.domElement.removeEventListener(
      "pointerdown",
      this._onPointerDown,
      { capture: true },
    );
    window.removeEventListener("pointermove", this._onPointerMove, {
      capture: true,
    });
    window.removeEventListener("pointerup", this._onPointerUp, {
      capture: true,
    });
    window.removeEventListener("pointercancel", this._onPointerUp, {
      capture: true,
    });
  }

  update(time) {
    this.sliders.forEach((slider) => {
      // Smoothly animate colors and scale every frame
      slider.uniforms.uFillColor.value.lerp(
        slider.targetFillColor,
        0.15,
      );
      slider.uniforms.uEmptyColor.value.lerp(
        slider.targetEmptyColor,
        0.15,
      );
      slider.knob.scale.lerp(slider.targetScale, 0.25);
    });
  }

  updateSliderFromKnob(slider) {
    const start = getWorldPosition(slider.start);
    const end = getWorldPosition(slider.end);
    const knob = getWorldPosition(slider.knob);
    const value = getSegmentValue(knob, start, end);
    this.setSliderValue(slider, value);
  }

  setSliderValue(slider, value) {
    slider.value = THREE.MathUtils.clamp(value, 0, 1);
    const start = getWorldPosition(slider.start);
    const end = getWorldPosition(slider.end);
    const worldPosition = start.lerp(end, slider.value);

    setWorldPosition(slider.knob, worldPosition);
    slider.uniforms.uFill.value = slider.value;
    slider.setVolume(slider.value);
  }

  _onPointerDown(event) {
    if (!appState.isRaycastEnabled) return;
    const hitSlider = this.getHitSlider(event);
    if (!hitSlider) return;

    this.activeSlider = hitSlider;
    this.dragStartPointerValue = this.getRaySliderValue(hitSlider, event);
    this.dragStartSliderValue = hitSlider.value;
    appState.cameraManager.controls.enabled = false;

    // Set target scale to press inwards
    this.activeSlider.targetScale
      .copy(this.activeSlider.baseScale)
      .multiplyScalar(0.85);

    event.preventDefault();
    event.stopPropagation();
  }

  _onPointerMove(event) {
    if (this.activeSlider) {
      event.preventDefault();
      this.updateActiveSlider(event);
      return;
    }

    if (!appState.isRaycastEnabled) return;
    const hitSlider = this.getHitSlider(event);

    if (this.hoveredSlider !== hitSlider) {
      if (this.hoveredSlider) {
        // Reset colors
        this.hoveredSlider.targetFillColor.setHex(SLIDER_FILL_COLOR);
        this.hoveredSlider.targetEmptyColor.setHex(SLIDER_EMPTY_COLOR);
        // Only revert scale if it isn't currently being clicked/active
        if (this.hoveredSlider !== this.activeSlider) {
          this.hoveredSlider.targetScale.copy(this.hoveredSlider.baseScale);
        }
        document.body.style.cursor = "default";
      }

      this.hoveredSlider = hitSlider;

      if (this.hoveredSlider) {
        // Apply hover tint to the filled and empty rail portions.
        this.hoveredSlider.targetFillColor.setHex(SLIDER_HOVER_COLOR);
        this.hoveredSlider.targetEmptyColor.setHex(SLIDER_EMPTY_HOVER_COLOR);

        if (this.hoveredSlider !== this.activeSlider) {
          // Slightly scale up to give a tactile "lift" hover effect
          this.hoveredSlider.targetScale
            .copy(this.hoveredSlider.baseScale)
            .multiplyScalar(1.05);
        }
        document.body.style.cursor = "pointer";
      }
    }
  }

  _onPointerUp(event) {
    if (!this.activeSlider) return;

    // If releasing while hovering, go to hover scale. Otherwise, normal scale.
    if (this.activeSlider === this.hoveredSlider) {
      this.activeSlider.targetScale
        .copy(this.activeSlider.baseScale)
        .multiplyScalar(1.05);
    } else {
      this.activeSlider.targetScale.copy(this.activeSlider.baseScale);
    }

    this.activeSlider = null;
    appState.cameraManager.controls.enabled = true;
    this._onPointerMove(event);
  }

  getHitSlider(event) {
    setPointerFromEvent(this.pointer, event);
    this.raycaster.setFromCamera(this.pointer, appState.camera);

    const knobHits = this.raycaster.intersectObjects(
      this.sliders.map(({ knob }) => knob),
      true,
    );
    const hitKnob = knobHits[0]?.object;

    if (!hitKnob) return null;

    return this.sliders.find((slider) => {
      let object = hitKnob;
      while (object) {
        if (object === slider.knob) return true;
        object = object.parent;
      }
      return false;
    });
  }

  updateActiveSlider(event) {
    setPointerFromEvent(this.pointer, event);
    this.raycaster.setFromCamera(this.pointer, appState.camera);

    const start = getWorldPosition(this.activeSlider.start);
    const end = getWorldPosition(this.activeSlider.end);
    const pointerValue = getSegmentValueFromRay(this.raycaster.ray, start, end);
    const value =
      this.dragStartSliderValue +
      (pointerValue - this.dragStartPointerValue);

    this.setSliderValue(this.activeSlider, value);
  }

  getRaySliderValue(slider, event) {
    setPointerFromEvent(this.pointer, event);
    this.raycaster.setFromCamera(this.pointer, appState.camera);

    const start = getWorldPosition(slider.start);
    const end = getWorldPosition(slider.end);

    return getSegmentValueFromRay(this.raycaster.ray, start, end);
  }
}

function setPointerFromEvent(pointer, event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function getWorldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function setWorldPosition(object, worldPosition) {
  object.position.copy(
    object.parent
      ? object.parent.worldToLocal(worldPosition.clone())
      : worldPosition,
  );
  object.updateMatrixWorld(true);
}

function getSegmentValue(point, start, end) {
  const segment = end.clone().sub(start);
  const segmentLengthSq = segment.lengthSq();
  if (segmentLengthSq === 0) return 0;
  return THREE.MathUtils.clamp(
    point.clone().sub(start).dot(segment) / segmentLengthSq,
    0,
    1,
  );
}

function getSegmentValueFromRay(ray, start, end) {
  const segment = end.clone().sub(start);
  const rayDirection = ray.direction.clone();
  const betweenStarts = ray.origin.clone().sub(start);
  const segmentLengthSq = segment.lengthSq();
  const segmentRayDot = segment.dot(rayDirection);
  const segmentStartDot = segment.dot(betweenStarts);
  const rayStartDot = rayDirection.dot(betweenStarts);
  const denominator = segmentLengthSq - segmentRayDot * segmentRayDot;

  if (segmentLengthSq === 0) return 0;
  if (Math.abs(denominator) < 0.00001) {
    return getSegmentValue(ray.origin, start, end);
  }

  return THREE.MathUtils.clamp(
    (segmentStartDot - segmentRayDot * rayStartDot) / denominator,
    0,
    1,
  );
}

function createSliderTrackMaterial() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uFill: { value: 0 },
      uStart: { value: new THREE.Vector3() },
      uEnd: { value: new THREE.Vector3(1, 0, 0) },
      uFillColor: { value: new THREE.Color(SLIDER_FILL_COLOR) },
      uEmptyColor: { value: new THREE.Color(SLIDER_EMPTY_COLOR) },
    },
    vertexShader: `
      uniform vec3 uStart;
      uniform vec3 uEnd;

      varying float vSliderT;
      varying vec3 vViewNormal;

      void main() {
        vec3 sliderAxis = uEnd - uStart;
        float sliderLengthSq = max(dot(sliderAxis, sliderAxis), 0.0001);

        vSliderT = dot(position - uStart, sliderAxis) / sliderLengthSq;
        vViewNormal = normalize(normalMatrix * normal);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uFill;
      uniform vec3 uFillColor;
      uniform vec3 uEmptyColor;

      varying float vSliderT;
      varying vec3 vViewNormal;

      void main() {
        float clampedT = clamp(vSliderT, 0.0, 1.0);
        float filled = step(vSliderT, uFill);
        vec3 baseColor = mix(uEmptyColor, uFillColor, filled);

        vec3 lightDirection = normalize(vec3(-0.35, 0.65, 0.68));
        float wrappedLight = dot(normalize(vViewNormal), lightDirection) * 0.5 + 0.5;
        float softShade = mix(0.76, 1.04, smoothstep(0.05, 0.95, wrappedLight));

        float endShade = mix(0.95, 1.0, smoothstep(0.0, 0.16, clampedT));
        endShade *= mix(1.0, 0.95, smoothstep(0.84, 1.0, clampedT));

        gl_FragColor = vec4(baseColor * softShade * endShade, 1.0);
      }
    `,
  });

  material.toneMapped = false;
  material.userData.sliderUniforms = material.uniforms;

  return material;
}
