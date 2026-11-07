import * as THREE from "three";

// The room's baked materials output directly, without the standard-material
// tone-mapping chain. Use the same output convention for the dynamic covers.
export function createGameCaseMaterial(color, map, mixRatio, fallbackMap) {
  return new THREE.ShaderMaterial({
    name: "ShelfCaseBakedLighting",
    uniforms: {
      uMap: { value: map ?? fallbackMap },
      uColor: { value: new THREE.Color(color) },
      uMixRatio: mixRatio,
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uMixRatio;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vec3 albedo = texture2D(uMap, vUv).rgb * uColor;
        vec3 normal = normalize(vWorldNormal);
        // The window is to the left, above and in front of the lower shelf.
        float windowLight = max(dot(normal, normalize(vec3(-0.8, 1.0, 0.7))), 0.0);
        float frontVisibility = smoothstep(-5.12, -4.62, vWorldPosition.z);
        float floorContact = smoothstep(1.61, 1.68, vWorldPosition.y);
        float overhang = 1.0 - smoothstep(1.98, 2.25, vWorldPosition.y);
        float occlusion = mix(0.78, 1.0, frontVisibility)
          * mix(0.79, 1.0, floorContact) * mix(0.86, 1.0, overhang);
        vec3 dayLight = vec3(1.0, 0.955, 0.88) * (0.66 + 0.24 * windowLight);
        vec3 nightLight = vec3(0.68, 0.79, 1.0) * (0.15 + 0.07 * windowLight);
        gl_FragColor = vec4(albedo * mix(dayLight, nightLight, uMixRatio) * occlusion, 1.0);
      }
    `,
  });
}
