import * as THREE from "three";

export function initSkybox(scene, camera, textureLoader, uMixRatio = { value: 0 }) {
  const createDummyTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    return new THREE.CanvasTexture(canvas);
  };

  const skyUniforms = {
    uTime: { value: 0 },

    // ☀️ Sun Position & Look
    uSunDirection: { value: new THREE.Vector3(0.6, 0.2, -0.6).normalize() },
    uSunScale: { value: 0.15 },
    uSunColor: { value: new THREE.Color(1.0, 0.9, 0.7) },
    uMoonColor: { value: new THREE.Color(0.28, 0.36, 0.55) },

    // 🌊 USER'S DEEP BLUE SKY
    uSkyDay: { value: new THREE.Color(0.05, 0.2, 0.7) }, // 👈 Your requested deep blue!
    uHorizonDay: { value: new THREE.Color(0.5, 0.75, 0.9) }, // Soft cyan/blue horizon
    uSkyNight: { value: new THREE.Color(0.004, 0.008, 0.025) },
    uHorizonNight: { value: new THREE.Color(0.016, 0.032, 0.055) },
    uMixRatio,

    uCloudTex01: { value: createDummyTexture() },
    uCloudTex02: { value: createDummyTexture() },
    uCloudEdgeColor: { value: new THREE.Color(1.0, 1.0, 1.0) }, // White rims
    uCloudCoreColor: { value: new THREE.Color(0.96, 0.66, 0.54) }, // Peachy centers
    uCloudNightEdgeColor: { value: new THREE.Color(0.075, 0.105, 0.15) },
    uCloudNightCoreColor: { value: new THREE.Color(0.025, 0.038, 0.07) },
    uCloudTiling: { value: new THREE.Vector2(0.3, 0.3) }, // Controls cloud size (Lower = Bigger)
    uWindSpeed: { value: new THREE.Vector2(0.02, 0.01) },
    uCloudDensity: { value: 0.5 }, // Controls cloud coverage (0.0 to 1.0)
  };

  const setupTexture = (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
  };

  textureLoader.load("/textures/seamless_noise.png", (tex) => {
    setupTexture(tex);
    skyUniforms.uCloudTex01.value = tex;
  });
  textureLoader.load("/textures/seamless_noise2.png", (tex) => {
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
    uniform vec3 uSunColor; 
    uniform vec3 uMoonColor;
    uniform float uSunScale; 

    uniform vec3 uSkyDay; 
    uniform vec3 uHorizonDay;
    uniform vec3 uSkyNight;
    uniform vec3 uHorizonNight;
    uniform float uMixRatio;

    uniform sampler2D uCloudTex01; 
    uniform sampler2D uCloudTex02;
    uniform vec3 uCloudEdgeColor;
    uniform vec3 uCloudCoreColor;
    uniform vec3 uCloudNightEdgeColor;
    uniform vec3 uCloudNightCoreColor;
    uniform vec2 uCloudTiling; 
    uniform vec2 uWindSpeed;
    uniform float uCloudDensity;

    float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
    }

    void main() {
        vec3 eyeDir = normalize(vWorldPosition - cameraPosition);
        float themeMix = uMixRatio * uMixRatio * (3.0 - 2.0 * uMixRatio);
        
        // 1. 🌊 SKY GRADIENT
        float sky_gradient = smoothstep(0.0, 0.6, eyeDir.y);
        vec3 daySky = mix(uHorizonDay, uSkyDay, sky_gradient);
        vec3 nightSky = mix(uHorizonNight, uSkyNight, sky_gradient);
        vec3 sky = mix(daySky, nightSky, themeMix);

        // 2. ☀️ GLOWING SUN
        float sun_dist = distance(eyeDir, uSunDirection);
        float sun_core = 1.0 - step(uSunScale, sun_dist);
        float sun_glow = smoothstep(uSunScale + 0.4, uSunScale, sun_dist);
        
        float moonScale = uSunScale * 0.62;
        float moon_core = 1.0 - step(moonScale, sun_dist);
        float moon_glow = smoothstep(moonScale + 0.18, moonScale, sun_dist);
        float horizonDim = smoothstep(-0.08, 0.22, eyeDir.y);

        vec3 dayLight = uSunColor * sun_core + uSunColor * sun_glow * 0.6;
        vec3 nightLight = uMoonColor * moon_core * 0.45 + uMoonColor * moon_glow * 0.12;
        sky += mix(dayLight, nightLight, themeMix) * horizonDim;

        vec2 starGrid = floor((eyeDir.xz / max(eyeDir.y + 0.35, 0.08)) * 180.0);
        float starSeed = hash(starGrid);
        float star = step(0.992, starSeed) * pow(hash(starGrid + 4.17), 7.0);
        float starFade = smoothstep(0.18, 0.65, eyeDir.y) * themeMix;
        sky += vec3(0.78, 0.86, 1.0) * star * starFade;

        // 3. ☁️ FLUFFY DOME CLOUDS
        // We use a modified ceiling projection to get good perspective,
        // but offset the Y so it curves slightly and doesn't infinitely stretch.
        vec2 cloud_uv = eyeDir.xz / (max(eyeDir.y, 0.0) + 0.15);
        
        vec2 wind1 = uWindSpeed * uTime;
        vec2 wind2 = uWindSpeed * uTime * 1.5; // Second layer moves slightly faster
        
        // Add the noise layers instead of multiplying to get chunky blobs
        float n1 = texture2D(uCloudTex01, cloud_uv * uCloudTiling + wind1).r;
        float n2 = texture2D(uCloudTex02, cloud_uv * (uCloudTiling * 2.0) + wind2).r;
        float cloud_noise = (n1 * 0.7) + (n2 * 0.3); // Base shape + details
        
        float threshold = 1.0 - uCloudDensity;
        
        // Anime hard edge
        float cloud_mask = smoothstep(threshold, threshold + 0.03, cloud_noise);
        
        // This stops the "thin stretched lines" completely.
        float horizon_fade = smoothstep(0.05, 0.3, eyeDir.y);
        cloud_mask *= horizon_fade;

        // Rim Lighting: Edges are white, core is peach
        float core_mask = smoothstep(threshold + 0.05, threshold + 0.2, cloud_noise);
        vec3 dayCloud = mix(uCloudEdgeColor, uCloudCoreColor, core_mask);
        vec3 nightCloud = mix(uCloudNightEdgeColor, uCloudNightCoreColor, core_mask);
        vec3 cloud_rgb = mix(dayCloud, nightCloud, themeMix);
        cloud_mask *= mix(1.0, 0.38, themeMix);

        // Apply clouds
        sky = mix(sky, cloud_rgb, cloud_mask);

        gl_FragColor = vec4(sky, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
  `;

  const skyGeo = new THREE.SphereGeometry(500, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skybox = new THREE.Mesh(skyGeo, skyMat);
  skybox.name = "SKYBOX";
  skybox.frustumCulled = false;
  skybox.renderOrder = -1000;

  scene.add(skybox);

  // Bottom of SkyboxShader.js
  return {
    update: (time) => {
      skyUniforms.uTime.value = time;
      if (camera) {
        skybox.position.copy(camera.position);
      }
    },
    sunDirection: skyUniforms.uSunDirection.value,
    mesh: skybox,
  };
}
