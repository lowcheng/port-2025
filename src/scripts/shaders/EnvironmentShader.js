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
  uniform float uPatchStrength;
  uniform vec4 uContactBoxes[32];
  uniform vec2 uContactParams[32];

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

    float patchField = sin(
      vWorldPosition.x * 0.43 + vWorldPosition.z * 0.19
    );
    patchField *= cos(
      vWorldPosition.x * 0.23 - vWorldPosition.z * 0.37
    );
    patchField = patchField * 0.5 + 0.5;
    float patchMask = smoothstep(0.68, 0.90, patchField) * uPatchStrength;

    float contactShadow = 0.0;
    for (int i = 0; i < 32; i++) {
      vec4 bounds = uContactBoxes[i];
      vec2 params = uContactParams[i];
      vec2 outsideDistance = max(
        max(
          bounds.xy - vWorldPosition.xz,
          vWorldPosition.xz - bounds.zw
        ),
        vec2(0.0)
      );
      float distanceFromContact = length(outsideDistance);
      float softContact = 1.0 - smoothstep(
        0.0,
        max(params.x, 0.001),
        distanceFromContact
      );
      contactShadow = max(contactShadow, softContact * params.y);
    }

    vec3 dayColor = mix(uDayDark, uDayLight, variation);
    vec3 nightColor = mix(uNightDark, uNightLight, variation);
    dayColor *= mix(1.0, 0.80, patchMask);
    nightColor *= mix(1.0, 0.72, patchMask);
    dayColor *= 1.0 - contactShadow;
    nightColor *= 1.0 - contactShadow * 0.82;
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
  patchStrength = 0.0,
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
      uPatchStrength: { value: patchStrength },
      uContactBoxes: {
        value: Array.from({ length: 32 }, () => new THREE.Vector4()),
      },
      uContactParams: {
        value: Array.from({ length: 32 }, () => new THREE.Vector2()),
      },
    },
    vertexShader: groundVertexShader,
    fragmentShader: groundFragmentShader,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    toneMapped: true,
  });
}

const contactShadowVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const contactShadowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;

  void main() {
    vec2 centeredUv = (vUv - 0.5) * 2.0;
    float radialDistance = length(centeredUv);
    float alpha = (1.0 - smoothstep(0.12, 1.0, radialDistance)) * uOpacity;

    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createContactShadowMaterial({
  color = 0x26312b,
  opacity = 0.16,
  name = "ContactShadowShader",
} = {}) {
  return new THREE.ShaderMaterial({
    name,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: contactShadowVertexShader,
    fragmentShader: contactShadowFragmentShader,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: true,
  });
}
