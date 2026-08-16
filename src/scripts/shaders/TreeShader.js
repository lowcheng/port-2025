import * as THREE from "three";

const leafVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;
  uniform float uWindSpeed;
  uniform vec3 uCanopyCenter;
  uniform vec3 uCanopyExtent;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vCanopyNormal;
  varying float vCanopyDepth;
  varying float vHeight;

  void main() {
    vUv = uv;

    vec3 safeExtent = max(uCanopyExtent, vec3(0.001));
    vec3 canopyCoordinate = (position - uCanopyCenter) / safeExtent;
    vec3 canopyDirection = normalize(
      canopyCoordinate + vec3(0.0, 0.08, 0.0)
    );

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);

    // Broad, low-frequency motion keeps each foliage card visually intact.
    float slowWave = sin(
      uTime * uWindSpeed +
      worldPosition.x * 0.18 +
      worldPosition.z * 0.14
    );
    float crossWave = cos(
      uTime * (uWindSpeed * 0.71) -
      worldPosition.x * 0.11 +
      worldPosition.z * 0.16
    );

    worldPosition.x += slowWave * uWindStrength;
    worldPosition.z += crossWave * uWindStrength * 0.38;

    vWorldPosition = worldPosition.xyz;
    vCanopyNormal = normalize(mat3(modelMatrix) * canopyDirection);
    vCanopyDepth = length(canopyCoordinate);
    vHeight = clamp(canopyCoordinate.y * 0.5 + 0.5, 0.0, 1.0);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const leafFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uAlphaCutoff;
  uniform float uLumaCutoff;
  uniform float uMixRatio;
  uniform vec3 uDayDark;
  uniform vec3 uDayLight;
  uniform vec3 uNightDark;
  uniform vec3 uNightLight;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vCanopyNormal;
  varying float vCanopyDepth;
  varying float vHeight;

  void main() {
    vec4 texel = texture2D(uMap, vUv);
    float textureValue = dot(
      texel.rgb,
      vec3(0.2126, 0.7152, 0.0722)
    );
    if (texel.a < uAlphaCutoff || textureValue < uLumaCutoff) discard;

    float leafDetail = smoothstep(0.08, 0.68, textureValue);

    float themeMix = smoothstep(0.0, 1.0, uMixRatio);
    vec3 dayColor = mix(uDayDark, uDayLight, leafDetail);
    vec3 nightColor = mix(uNightDark, uNightLight, leafDetail);
    vec3 leafColor = mix(dayColor, nightColor, themeMix);

    // Shade the canopy as a single volume. Surface leaves and the crown catch
    // more light while interior and underside leaves stay noticeably darker.
    vec3 lightDirection = normalize(vec3(-0.48, 0.82, 0.31));
    vec3 canopyNormal = normalize(vCanopyNormal);
    float sunLight = max(dot(canopyNormal, lightDirection), 0.0);
    float skyLight = smoothstep(-0.35, 0.82, canopyNormal.y);
    float crownLight = smoothstep(0.15, 0.94, vHeight);
    float surfaceLight = smoothstep(0.34, 1.05, vCanopyDepth);
    float undersideLight = smoothstep(-0.72, 0.28, canopyNormal.y);
    float interiorOcclusion = mix(0.68, 1.0, surfaceLight);
    float canopyLight =
      0.30 +
      sunLight * 0.40 +
      skyLight * 0.07 +
      crownLight * 0.13 +
      surfaceLight * 0.10;

    canopyLight *= mix(0.72, 1.0, undersideLight);
    canopyLight *= interiorOcclusion;

    // Large color patches break up the silhouette without noisy per-leaf
    // flicker. The warm/cool shift is deliberately muted for this scene.
    float clumpPattern = sin(
      vWorldPosition.x * 1.17 +
      vWorldPosition.y * 1.43 -
      vWorldPosition.z * 0.91
    );
    clumpPattern *= cos(
      vWorldPosition.x * 0.63 -
      vWorldPosition.y * 0.74 +
      vWorldPosition.z * 1.21
    );
    clumpPattern = clumpPattern * 0.5 + 0.5;

    vec3 coolColor = leafColor * vec3(0.86, 0.96, 0.90);
    vec3 warmColor = leafColor * vec3(1.04, 1.02, 0.88);
    leafColor = mix(coolColor, warmColor, clumpPattern);
    canopyLight *= mix(0.90, 1.08, clumpPattern);

    vec3 shadowTint = vec3(0.82, 0.94, 0.88);
    vec3 sunTint = vec3(1.06, 1.03, 0.86);
    leafColor *= mix(shadowTint, sunTint, sunLight);

    gl_FragColor = vec4(leafColor * canopyLight, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createFoliageMaterial({
  map,
  timeUniform,
  mixRatioUniform,
  canopyCenter,
  canopyExtent,
  name = "FoliageShader",
  windStrength = 0.024,
  windSpeed = 0.82,
  alphaCutoff = 0.39,
  lumaCutoff = 0.0,
  dayDark = 0x23462a,
  dayLight = 0x719748,
  nightDark = 0x101f20,
  nightLight = 0x315147,
}) {
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  return new THREE.ShaderMaterial({
    name,
    uniforms: {
      uTime: timeUniform,
      uMap: { value: map ?? null },
      uMixRatio: mixRatioUniform,
      uWindStrength: { value: windStrength },
      uWindSpeed: { value: windSpeed },
      uAlphaCutoff: { value: alphaCutoff },
      uLumaCutoff: { value: lumaCutoff },
      uCanopyCenter: { value: canopyCenter.clone() },
      uCanopyExtent: { value: canopyExtent.clone() },
      uDayDark: { value: new THREE.Color(dayDark) },
      uDayLight: { value: new THREE.Color(dayLight) },
      uNightDark: { value: new THREE.Color(nightDark) },
      uNightLight: { value: new THREE.Color(nightLight) },
    },
    vertexShader: leafVertexShader,
    fragmentShader: leafFragmentShader,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    toneMapped: true,
  });
}

// Kept for compatibility with older callers while foliage now also covers
// bushes and hedges.
export const createTreeLeafMaterial = createFoliageMaterial;

const foliageAccentVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const foliageAccentFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uMixRatio;
  uniform float uAlphaCutoff;
  uniform float uLumaCutoff;

  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vec4 texel = texture2D(uMap, vUv);
    float textureValue = dot(
      texel.rgb,
      vec3(0.2126, 0.7152, 0.0722)
    );

    if (texel.a < uAlphaCutoff || textureValue < uLumaCutoff) discard;

    vec3 normalDirection = normalize(vWorldNormal);
    if (!gl_FrontFacing) normalDirection *= -1.0;

    vec3 lightDirection = normalize(vec3(-0.48, 0.82, 0.31));
    float directionalLight = max(dot(normalDirection, lightDirection), 0.0);
    float lightAmount = 0.72 + directionalLight * 0.28;
    float themeMix = smoothstep(0.0, 1.0, uMixRatio);
    vec3 themeTint = mix(vec3(1.0), vec3(0.42, 0.51, 0.58), themeMix);

    gl_FragColor = vec4(texel.rgb * lightAmount * themeTint, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createFoliageAccentMaterial({
  map,
  mixRatioUniform,
  alphaCutoff = 0.35,
  lumaCutoff = 0.04,
}) {
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  return new THREE.ShaderMaterial({
    name: "FoliageAccentShader",
    uniforms: {
      uMap: { value: map ?? null },
      uMixRatio: mixRatioUniform,
      uAlphaCutoff: { value: alphaCutoff },
      uLumaCutoff: { value: lumaCutoff },
    },
    vertexShader: foliageAccentVertexShader,
    fragmentShader: foliageAccentFragmentShader,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    toneMapped: true,
  });
}

const barkVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const barkFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uMixRatio;
  uniform vec3 uDayDark;
  uniform vec3 uDayLight;
  uniform vec3 uNightDark;
  uniform vec3 uNightLight;

  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vec4 texel = texture2D(uMap, vUv);
    float textureValue = dot(
      texel.rgb,
      vec3(0.2126, 0.7152, 0.0722)
    );
    float barkDetail = smoothstep(0.035, 0.34, textureValue);

    float themeMix = smoothstep(0.0, 1.0, uMixRatio);
    vec3 dayColor = mix(uDayDark, uDayLight, barkDetail);
    vec3 nightColor = mix(uNightDark, uNightLight, barkDetail);
    vec3 barkColor = mix(dayColor, nightColor, themeMix);

    vec3 normalDirection = normalize(vWorldNormal);
    if (!gl_FrontFacing) normalDirection *= -1.0;

    vec3 lightDirection = normalize(vec3(-0.48, 0.82, 0.31));
    float directionalLight =
      dot(normalDirection, lightDirection) * 0.5 + 0.5;
    float barkLight = mix(0.64, 1.04, directionalLight);

    gl_FragColor = vec4(barkColor * barkLight, texel.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createTreeBarkMaterial({ map, mixRatioUniform }) {
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  return new THREE.ShaderMaterial({
    name: "TreeBarkShader",
    uniforms: {
      uMap: { value: map ?? null },
      uMixRatio: mixRatioUniform,
      uDayDark: { value: new THREE.Color(0x2d2118) },
      uDayLight: { value: new THREE.Color(0x684d34) },
      uNightDark: { value: new THREE.Color(0x12191d) },
      uNightLight: { value: new THREE.Color(0x35434a) },
    },
    vertexShader: barkVertexShader,
    fragmentShader: barkFragmentShader,
    side: THREE.DoubleSide,
    toneMapped: true,
  });
}
