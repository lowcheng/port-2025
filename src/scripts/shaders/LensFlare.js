import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

export const LensFlareShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLightPos: { value: new THREE.Vector2(0.5, 0.5) },
    uIntensity: { value: 1.0 },
    uScreenSize: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    
    uniform vec2 uLightPos;
    uniform float uIntensity;
    uniform vec2 uScreenSize;
    uniform float uTime;

    // saturate() was removed here because Three.js natively includes it!

    vec2 toPixels(vec2 uvDist) { return uvDist * uScreenSize; }

    float blob(vec2 uv, vec2 p, float r) {
      vec2 d = uv - p;
      d.x *= (uScreenSize.x / uScreenSize.y);
      float dd = dot(d, d);
      r = max(r, 0.0005);
      return exp(-dd / (r * r));
    }

    float hash1(float n) { return fract(sin(n) * 43758.5453123); }
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

    vec3 spectrum(float t) {
      t = fract(t);
      return 0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.00, 0.33, 0.67)));
    }

    float n2(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    vec3 screenBlend(vec3 base, vec3 add) {
      return vec3(1.0) - (vec3(1.0) - base) * (vec3(1.0) - add);
    }

    float ringHalo(vec2 p, vec2 lp, float r0, float w) {
      float r = length(p - lp);
      float x = (r - r0) / max(w, 1e-4);
      return exp(-x * x);
    }

    void main(void) {
      vec2 uv = vUv;
      vec4 scene = texture2D(tDiffuse, uv);

      if (uIntensity <= 0.001) {
        gl_FragColor = scene;
        return;
      }

      vec2 center = vec2(0.5, 0.5);
      vec2 L = uLightPos;
      vec2 toCenter = center - L;
      vec2 pixelD = toPixels(uv - L);
      float minDim = min(uScreenSize.x, uScreenSize.y);
      float distPx = length(pixelD);

      vec2 axisPix = toPixels(center - L);
      float axisLen = max(length(axisPix), 1e-4);
      vec2 axisDir = axisPix / axisLen;
      vec2 perpDir = vec2(-axisDir.y, axisDir.x);
      
      vec3 baseWarm = vec3(1.0, 0.90, 0.72);
      vec3 sunColor = vec3(1.0, 0.95, 0.75);

      float core = exp(-(distPx * distPx) / pow(0.020 * minDim, 2.0));
      float haloInner = exp(-(distPx * distPx) / pow(0.14 * minDim, 2.0));
      float haloOuter = exp(-(distPx * distPx) / pow(0.40 * minDim, 2.0));
      float halo = haloInner * 0.55 + haloOuter * 0.18;
      halo *= smoothstep(1.25 * minDim, 0.0, distPx);

      vec3 prism = vec3(0.0);
      {
        float edgeP = saturate(length(L - center) * 2.0);
        vec2 axisPixP = normalize(toPixels(center - L) + vec2(1e-3, 0.0));
        vec2 perpPixP = vec2(-axisPixP.y, axisPixP.x);
        float tCurtain = 1.35;
        vec2 Puv = center + (center - L) * tCurtain;
        vec2 dPix = toPixels(uv - Puv);
        float uPx = dot(dPix, perpPixP);
        float vPx = dot(dPix, axisPixP);
        float vN = vPx / max(minDim, 1e-4);
        float curve = 0.60;
        float uPxC = uPx - (curve * vN * vN) * (0.55 * minDim) * sign(uPx + 1e-4);
        float widthPx = (0.12 * minDim);
        float band = exp(-(uPxC * uPxC) / (widthPx * widthPx));
        float lenPx = (0.55 * minDim);
        float vMask = exp(-(vPx * vPx) / (lenPx * lenPx));
        float uN = clamp(uPxC / max(widthPx, 1e-4), -1.0, 1.0);
        float hue = 0.58 + uN * 0.30 + (vPx / max(lenPx, 1e-4)) * 0.06 + uTime * 0.02;
        float disp = 0.11 * uN;
        vec3 spec = vec3(spectrum(hue + disp).r, spectrum(hue).g, spectrum(hue - disp).b);
        spec = pow(max(spec, 0.0), vec3(0.55));
        float gate = exp(-(distPx * distPx) / pow(0.55 * minDim, 2.0));
        float grain = 0.92 + 0.08 * n2(uv * uScreenSize * 0.22 + uTime * 0.12);
        float mask = band * vMask * gate * grain * (0.10 + 0.90 * edgeP);
        prism = spec * mask * 3.2;
      }

      vec2 axisPix_r = toPixels(center - L);
      float axisLen_r = max(length(axisPix_r), 1e-4);
      vec2 axisDir_r = axisPix_r / axisLen_r;
      vec2 perpDir_r = vec2(-axisDir_r.y, axisDir_r.x);
      float along_r = dot(pixelD, axisDir_r);
      float side_r = dot(pixelD, perpDir_r);
      float width_r = 0.11 * minDim;
      float maxLen_r = 2.60 * minDim;
      float band_r = exp(-(side_r * side_r) / (width_r * width_r));
      float start_r = 0.05 * minDim;
      float len_r = smoothstep(start_r, start_r + 0.22 * minDim, along_r) * smoothstep(maxLen_r, 0.55 * maxLen_r, along_r);
      float gate_r = exp(-(distPx * distPx) / pow(0.34 * minDim, 2.0));
      float sideN_r = clamp(side_r / max(width_r, 1e-4), -1.0, 1.0);
      float alongN_r = clamp(along_r / max(maxLen_r, 1e-4), 0.0, 1.0);
      float hue_r = 0.58 + sideN_r * 0.34 + alongN_r * 0.10 + uTime * 0.02;
      float disp_r = 0.07 * sideN_r;
      vec3 spec_r = vec3(spectrum(hue_r + disp_r).r, spectrum(hue_r).g, spectrum(hue_r - disp_r).b);
      float grain_r = 0.90 + 0.10 * n2(uv * uScreenSize * 0.22 + uTime * 0.12);
      vec3 rainbowStreak = spec_r * (band_r * len_r * gate_r * grain_r) * 1.7;

      vec3 rainbow = prism + rainbowStreak;

      float haloT = saturate(distPx / (0.42 * minDim));
      vec3 haloCol = mix(vec3(1.0, 0.92, 0.72), vec3(0.88, 0.93, 1.0), haloT);
      float rN = saturate(distPx / (0.55 * minDim));
      vec3 haloSpec = spectrum(0.58 + rN * 0.10 + uTime * 0.01);
      float specMask = haloInner * smoothstep(0.18, 0.55, rN) * (1.0 - smoothstep(0.82, 1.0, rN));
      haloCol = mix(haloCol, haloSpec, 0.20 * specMask);

      float angle = atan(pixelD.y, pixelD.x);
      float rayBase = pow(abs(sin(angle * 8.0 + sin(angle * 2.3) * 0.6 + uTime * 0.10)), 4.0);
      float rays = rayBase * haloInner * 0.20;

      vec3 ghosts = vec3(0.0);
      vec2 dir = normalize(toCenter + vec2(1e-4, 0.0));
      vec2 perp = normalize(vec2(-dir.y, dir.x));
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float t = mix(0.22, 2.10, fi / 5.0);
        vec2 gp = L + toCenter * t;
        float r1 = hash1(fi * 17.13 + 1.0);
        float r2 = hash1(fi * 31.77 + 2.0);
        gp += perp * ((r1 - 0.5) * 0.012);
        float size = mix(0.010, 0.030, r2);
        float strength = mix(0.42, 0.12, fi / 5.0) * (0.65 + 0.35 * r1);
        float g = pow(blob(uv, gp, size), 2.4);
        vec3 gcol = mix(vec3(1.0, 0.90, 0.72), vec3(1.0, 0.78, 0.52), r2);
        ghosts += (g * gcol) * strength;
      }

      vec2 p = uv - 0.5;
      p.y *= (uScreenSize.y / uScreenSize.x);
      vec2 lp = L - 0.5;
      lp.y *= (uScreenSize.y / uScreenSize.x);
      float edge = saturate(length(L - center) * 2.0);
      float r0 = mix(0.20, 0.38, edge);
      float w0 = mix(0.030, 0.050, edge);
      float ring1 = ringHalo(p, lp, r0, w0);
      float ring2 = ringHalo(p, lp, r0 * 1.22, w0 * 1.15) * 0.55;
      vec2 d = normalize((p - lp) + vec2(1e-4));
      vec2 axis = normalize((vec2(0.0) - lp) + vec2(1e-4));
      float ring = (ring1 + ring2) * pow(saturate(dot(d, axis) * 0.5 + 0.5), 1.8);
      float sunDist = length(L - center);
      ring *= mix(0.85, 1.25, saturate(sunDist * 1.6)) * smoothstep(0.85, 0.12, length(p - lp));
      ring *= 1.0 + 0.06 * sin(uTime * 0.7 + length(p - lp) * 18.0);
      vec3 ringCol = mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.75, 0.55), pow(saturate(dot(d, axis) * 0.5 + 0.5), 0.9));

      float rbR0 = r0 * 1.18;
      float rbW0 = w0 * 1.10;
      float rainbowRing = ringHalo(p, lp, rbR0, rbW0);
      float rbT = saturate(((length(p - lp) - rbR0) / max(rbW0, 1e-4)) * 0.5 + 0.5);
      vec3 rainbowCol = pow(max(spectrum(0.0 + (1.0 - rbT) * 0.75 + uTime * 0.02), 0.0), vec3(2.2));
      float coreMask = smoothstep(0.12 * minDim, 0.32 * minDim, distPx);
      float centerOnlyMask = 1.0 - smoothstep(0.2, 1.5, sunDist);

      // Reduced core intensity from 0.18 to 0.08 so it blends better with the sky shader
      vec3 flare = halo * haloCol * 0.95 + core * sunColor * 0.08 + rays * baseWarm * 0.65 + ghosts * 3.00 + ring * ringCol * 1.35;
      flare *= mix(1.0, 1.18, smoothstep(0.65, 0.95, luma(scene.rgb)));
      flare *= uIntensity * 0.50;
      flare = pow(max(flare / (vec3(1.0) + flare * 0.70), 0.0), vec3(0.85));

      vec3 result = screenBlend(scene.rgb, flare);
      result = screenBlend(result, rainbow * uIntensity);
      result = screenBlend(result, (rainbowRing * rainbowCol) * (0.30 * centerOnlyMask * coreMask) * uIntensity);
      
      gl_FragColor = vec4(result, 1.0);
    }
  `,
};

export function setupLensFlare(scene, composer) {
  // We are bringing the 3D sphere back!
  const sunGeometry = new THREE.SphereGeometry(5, 16, 16);
  // Red wireframe so you can physically see it over the skybox sun
  const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
  });
  const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);

  // This matches your Skybox uSunDirection (0.6, 0.2, -0.6) scaled by 100
  sunMesh.position.set(60, 35, -60);
  scene.add(sunMesh);

  const lensFlarePass = new ShaderPass(LensFlareShader);
  composer.addPass(lensFlarePass);

  return { sunMesh, lensFlarePass };
}
