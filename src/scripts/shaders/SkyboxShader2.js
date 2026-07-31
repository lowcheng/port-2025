import * as THREE from "three";

export function initSkybox(scene, camera, textureLoader) {
  const createDummyTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 2, 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  };

  const setupTexture = (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
  };

  const skyUniforms = {
    uTime: { value: 0.0 },

    // Sun
    uSunDirection: {
      value: new THREE.Vector3(0.6, 0.28, -0.6).normalize(),
    },
    uSunScale: { value: 0.12 },
    uSunColor: { value: new THREE.Color(1.0, 0.95, 0.86) },

    // Sky
    uSkyTop: { value: new THREE.Color(0.18, 0.5, 0.9) },
    uSkyBottom: { value: new THREE.Color(0.84, 0.91, 0.98) },

    // Cloud textures
    uCloudTex01: { value: createDummyTexture() }, // coverage / big shapes
    uCloudTex02: { value: createDummyTexture() }, // detail / edge breakup

    // Cloud colors
    uCloudBrightColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uCloudBodyColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uCloudShadowColor: { value: new THREE.Color(0.74, 0.82, 0.93) },

    // Cloud controls
    uCloudCoverageTiling: { value: new THREE.Vector2(0.055, 0.055) },
    uCloudDetailTiling: { value: new THREE.Vector2(0.12, 0.12) },
    uCloudWarpTiling: { value: new THREE.Vector2(0.08, 0.08) },

    uWindSpeed: { value: new THREE.Vector2(0.0025, 0.0012) },
    uCloudDensity: { value: 0.42 },
    uCloudSoftness: { value: 0.09 },
    uWarpStrength: { value: 0.035 },
  };

  textureLoader.load("/textures/noise1.png", (tex) => {
    setupTexture(tex);
    skyUniforms.uCloudTex01.value = tex;
  });

  textureLoader.load("/textures/noise2.png", (tex) => {
    setupTexture(tex);
    skyUniforms.uCloudTex02.value = tex;
  });

  const vertexShader = `
    varying vec3 vWorldPosition;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec3 vWorldPosition;

    uniform float uTime;

    uniform vec3 uSunDirection;
    uniform float uSunScale;
    uniform vec3 uSunColor;

    uniform vec3 uSkyTop;
    uniform vec3 uSkyBottom;

    uniform sampler2D uCloudTex01;
    uniform sampler2D uCloudTex02;

    uniform vec3 uCloudBrightColor;
    uniform vec3 uCloudBodyColor;
    uniform vec3 uCloudShadowColor;

    uniform vec2 uCloudCoverageTiling;
    uniform vec2 uCloudDetailTiling;
    uniform vec2 uCloudWarpTiling;
    uniform vec2 uWindSpeed;

    uniform float uCloudDensity;
    uniform float uCloudSoftness;
    uniform float uWarpStrength;

    void main() {
      vec3 eyeDir = normalize(vWorldPosition - cameraPosition);

      // Sky gradient
      float skyGradient = smoothstep(-0.2, 0.7, eyeDir.y);
      vec3 sky = mix(uSkyBottom, uSkyTop, skyGradient);

      // Sun disc + glow
      vec3 sunDir = normalize(uSunDirection);
      float sunDist = distance(eyeDir, sunDir);

      float sunCore = 1.0 - smoothstep(uSunScale, uSunScale + 0.015, sunDist);
      float sunGlow = 1.0 - smoothstep(uSunScale, uSunScale + 0.32, sunDist);

      sky += uSunColor * sunCore * 1.15;
      sky += uSunColor * sunGlow * 0.22;

      // Slight warm tint around the sun region
      sky = mix(sky, sky + uSunColor * 0.08, sunGlow * 0.35);

      // Dome projection
      float dome = max(eyeDir.y, 0.0);
      vec2 baseUV = eyeDir.xz / (dome + 0.24);

      // Calm movement
      vec2 windA = uWindSpeed * uTime;
      vec2 windB = uWindSpeed * uTime * 1.12 + vec2(0.21, 0.37);
      vec2 windWarp = uWindSpeed * uTime * 0.45 + vec2(-0.13, 0.09);

      // Subtle UV warp
      vec2 warpSampleUV = baseUV * uCloudWarpTiling + windWarp;
      vec2 warp = texture2D(uCloudTex02, warpSampleUV).rg * 2.0 - 1.0;
      vec2 cloudUV = baseUV + warp * uWarpStrength;

      // Big cloud layout
      float coverageNoise = texture2D(
        uCloudTex01,
        cloudUV * uCloudCoverageTiling + windA
      ).r;

      coverageNoise = smoothstep(0.22, 0.86, coverageNoise);

      // Edge breakup detail
      float detailNoise = texture2D(
        uCloudTex02,
        cloudUV * uCloudDetailTiling + windB
      ).r;

      // Detail should decorate, not destroy
      float shapedCloud = coverageNoise - detailNoise * 0.12;

      // Density threshold
      float threshold = 1.0 - uCloudDensity;

      float cloudMask = smoothstep(
        threshold - uCloudSoftness * 0.8,
        threshold + uCloudSoftness * 0.5,
        shapedCloud
      );

      float cloudBody = smoothstep(
        threshold + 0.01,
        threshold + 0.18,
        shapedCloud
      );

      float cloudOuter = smoothstep(
        threshold - 0.12,
        threshold + 0.02,
        shapedCloud
      );

      float rim = clamp(cloudOuter - cloudBody, 0.0, 1.0);

      // Fade clouds toward horizon
      float horizonFade = smoothstep(0.08, 0.28, eyeDir.y);
      cloudMask *= horizonFade;
      cloudBody *= horizonFade;
      rim *= horizonFade;

      // Stylized anime lighting
      float sunFacing = clamp(dot(eyeDir, sunDir) * 0.5 + 0.5, 0.0, 1.0);

      vec3 cloudColor = mix(uCloudShadowColor, uCloudBodyColor, cloudBody);

      cloudColor = mix(cloudColor, uCloudBodyColor, cloudMask * 0.35);
      cloudColor += uCloudBrightColor * rim * 0.85;
      cloudColor += uSunColor * rim * sunFacing * 0.28;
      cloudColor += uSunColor * cloudBody * sunFacing * 0.12;

      float overhead = clamp(eyeDir.y * 0.5 + 0.5, 0.0, 1.0);
      cloudColor = mix(cloudColor * 0.96, cloudColor, overhead);

      // Composite clouds
      sky = mix(sky, cloudColor, clamp(cloudMask * 1.12, 0.0, 1.0));

      gl_FragColor = vec4(sky, 1.0);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  const skyGeo = new THREE.SphereGeometry(500, 48, 32);

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skybox = new THREE.Mesh(skyGeo, skyMat);
  skybox.name = "SKYBOX";
  skybox.frustumCulled = false;
  skybox.renderOrder = -1000;

  scene.add(skybox);

  return {
    skybox,
    material: skyMat,
    uniforms: skyUniforms,

    update: (time) => {
      skyUniforms.uTime.value = time;

      if (camera) {
        skybox.position.copy(camera.position);
      }
    },
  };
}
