import * as THREE from "three";

// export function createGrassMaterial() {
//   return new THREE.ShaderMaterial({
//     uniforms: {
//       uTime: { value: 0.0 },
//     },
//     vertexShader: `
//       uniform float uTime;
//       varying vec2 vUv;

//       void main() {
//         vUv = uv;

//         // Start with the base position
//         vec3 pos = position;

//         // Calculate wind sway based on world position and time
//         // instanceMatrix[3].xz gets the world X and Z coordinates of this specific blade
//         float noise = sin(uTime * 1.5 + instanceMatrix[3][0] * 0.5 + instanceMatrix[3][2] * 0.5);

//         // Multiply by pos.y so the root (y=0) stays still, but the tip sways
//         pos.x += noise * pos.y * 0.3;
//         pos.z += noise * pos.y * 0.1;

//         // Standard instanced mesh projection
//         vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(pos, 1.0);
//         gl_Position = projectionMatrix * mvPosition;
//       }
//     `,
//     fragmentShader: `
//       varying vec2 vUv;

//       void main() {
//         // Colors for the grass gradient
//         vec3 bottomColor = vec3(0.15, 0.4, 0.1); // Darker base
//         vec3 topColor = vec3(0.4, 0.8, 0.3);     // Lighter tip

//         // Mix based on the UV height (y)
//         vec3 finalColor = mix(bottomColor, topColor, vUv.y);

//         gl_FragColor = vec4(finalColor, 1.0);
//       }
//     `,
//     side: THREE.DoubleSide,
//   });
// }

export function createGrassMaterial(uMixRatio = { value: 0 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uMap: { value: null }, // pass the texture here
      uMixRatio,
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vBladeVariation;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Wind sway
        vec2 instanceOffset = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float noise = sin(uTime * 1.5 + instanceOffset.x * 0.5 + instanceOffset.y * 0.5);
        vBladeVariation = 0.5 + 0.5 * sin(dot(instanceOffset, vec2(12.9898, 78.233)));

        // Assuming your Blender model's pivot is at the bottom (y=0)
        pos.x += noise * pos.y * 0.3;
        pos.z += noise * pos.y * 0.1;

        vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uMixRatio;
      varying vec2 vUv;
      varying float vBladeVariation;

      void main() {
        // Sample the texture
        vec4 texColor = texture2D(uMap, vUv);

        // MASK TEST: Check the Red channel (r) instead of Alpha (a).
        // If the pixel is dark/black (less than 0.5), throw it away!
        if (texColor.r < 0.5) {
            discard;
        }

        // Gradient coloring
        vec3 dayBottomColor = vec3(0.15, 0.4, 0.1);
        vec3 dayTopColor = vec3(0.4, 0.8, 0.3);
        vec3 nightBottomColor = vec3(0.008, 0.028, 0.03);
        vec3 nightTopColor = vec3(0.028, 0.068, 0.064);
        vec3 moonTint = vec3(0.032, 0.062, 0.082);

        float height = smoothstep(0.0, 1.0, vUv.y);
        float themeMix = uMixRatio * uMixRatio * (3.0 - 2.0 * uMixRatio);
        float variation = (vBladeVariation - 0.5) * 0.08;
        float moonCatch = smoothstep(0.55, 1.0, vUv.y) * (0.014 + 0.016 * vBladeVariation);

        vec3 dayColor = mix(dayBottomColor, dayTopColor, height) + variation;
        vec3 nightColor = mix(nightBottomColor, nightTopColor, height) + variation * 0.35;
        nightColor += moonTint * moonCatch;

        vec3 gradientColor = mix(dayColor, nightColor, themeMix);

        // Apply the gradient. (Since the remaining texture is white, it tints perfectly)
        gl_FragColor = vec4(gradientColor, 1.0);
      }
    `,
    side: THREE.DoubleSide, // Important so we see the planes from both sides
  });
}

export function createGrassGroundMaterial(uMixRatio = { value: 0 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDayColor: { value: new THREE.Color(0x8fcf75) },
      uNightColor: { value: new THREE.Color(0x040e0e) },
      uMixRatio,
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uDayColor;
      uniform vec3 uNightColor;
      uniform float uMixRatio;
      varying vec2 vUv;

      void main() {
        float themeMix = uMixRatio * uMixRatio * (3.0 - 2.0 * uMixRatio);
        float softVariation = 0.92 + 0.08 * smoothstep(0.0, 1.0, vUv.y);
        vec3 color = mix(uDayColor, uNightColor, themeMix) * softVariation;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}
