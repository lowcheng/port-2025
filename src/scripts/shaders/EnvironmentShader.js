import * as THREE from "three";

const stoneVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const stoneFragmentShader = /* glsl */ `
  uniform float uMixRatio;
  uniform vec3 uDayDark;
  uniform vec3 uDayLight;
  uniform vec3 uNightDark;
  uniform vec3 uNightLight;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normalDirection = normalize(vWorldNormal);
    if (!gl_FrontFacing) normalDirection *= -1.0;

    vec3 lightDirection = normalize(vec3(-0.48, 0.82, 0.31));
    float directionalLight = max(dot(normalDirection, lightDirection), 0.0);
    float surfaceLight = 0.72 + directionalLight * 0.28;

    float variation = sin(vWorldPosition.x * 2.7 + vWorldPosition.z * 1.9);
    variation *= cos(vWorldPosition.x * 1.3 - vWorldPosition.z * 2.4);
    variation = variation * 0.5 + 0.5;

    vec3 dayColor = mix(uDayDark, uDayLight, variation);
    vec3 nightColor = mix(uNightDark, uNightLight, variation);
    float themeMix = smoothstep(0.0, 1.0, uMixRatio);
    vec3 color = mix(dayColor, nightColor, themeMix) * surfaceLight;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSteppingStoneMaterial(mixRatioUniform) {
  return new THREE.ShaderMaterial({
    name: "SteppingStoneShader",
    uniforms: {
      uMixRatio: mixRatioUniform,
      uDayDark: { value: new THREE.Color(0x625d57) },
      uDayLight: { value: new THREE.Color(0x969087) },
      uNightDark: { value: new THREE.Color(0x141d22) },
      uNightLight: { value: new THREE.Color(0x2b3940) },
    },
    vertexShader: stoneVertexShader,
    fragmentShader: stoneFragmentShader,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    toneMapped: true,
  });
}

const groundVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const groundFragmentShader = /* glsl */ `
  uniform float uMixRatio;
  uniform vec3 uDayDark;
  uniform vec3 uDayLight;
  uniform vec3 uNightDark;
  uniform vec3 uNightLight;
  uniform float uVariationScale;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normalDirection = normalize(vWorldNormal);
    if (!gl_FrontFacing) normalDirection *= -1.0;

    vec3 lightDirection = normalize(vec3(-0.48, 0.82, 0.31));
    float directionalLight = max(dot(normalDirection, lightDirection), 0.0);
    float skyLight = normalDirection.y * 0.5 + 0.5;
    float surfaceLight = 0.68 + skyLight * 0.18 + directionalLight * 0.14;

    float variation = sin(
      vWorldPosition.x * uVariationScale +
      vWorldPosition.z * uVariationScale * 0.73
    );
    variation *= cos(
      vWorldPosition.x * uVariationScale * 0.47 -
      vWorldPosition.z * uVariationScale * 0.89
    );
    variation = variation * 0.5 + 0.5;

    vec3 dayColor = mix(uDayDark, uDayLight, variation);
    vec3 nightColor = mix(uNightDark, uNightLight, variation);
    float themeMix = smoothstep(0.0, 1.0, uMixRatio);
    vec3 color = mix(dayColor, nightColor, themeMix) * surfaceLight;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createEnvironmentGroundMaterial({
  mixRatioUniform,
  name,
  dayDark,
  dayLight,
  nightDark,
  nightLight,
  variationScale = 0.32,
}) {
  return new THREE.ShaderMaterial({
    name,
    uniforms: {
      uMixRatio: mixRatioUniform,
      uDayDark: { value: new THREE.Color(dayDark) },
      uDayLight: { value: new THREE.Color(dayLight) },
      uNightDark: { value: new THREE.Color(nightDark) },
      uNightLight: { value: new THREE.Color(nightLight) },
      uVariationScale: { value: variationScale },
    },
    vertexShader: groundVertexShader,
    fragmentShader: groundFragmentShader,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    toneMapped: true,
  });
}
