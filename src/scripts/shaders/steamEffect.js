import * as THREE from "three";

/**
 * Creates a mesh that renders a steam/smoke effect.
 *
 * @param {THREE.Texture} perlinTexture - A loaded Perlin (or other noise) texture.
 * @param {object} [options]
 * @param {number} [options.width=2]  - Width of the plane geometry.
 * @param {number} [options.height=4] - Height of the plane geometry.
 * @param {number} [options.segments=32] - Plane geometry segments.
 *
 * @returns {THREE.Mesh} Steam mesh to be added to a Three.js scene.
 */
export function createSteamEffect(perlinTexture, options = {}) {
  const { width = 1, height = 2, segments = 32 } = options;

  // ------------------------------
  // 1. Geometry
  // ------------------------------
  const geometry = new THREE.PlaneGeometry(width, height, segments, segments);

  // ------------------------------
  // 2. Shaders (inline)
  // ------------------------------
  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform sampler2D uPerlinTexture;

    varying vec2 vUv;

    // 2D rotation helper
    vec2 rotate2D(vec2 _v, float _angle)
    {
        float s = sin(_angle);
        float c = cos(_angle);
        mat2 m = mat2(c, -s, s, c);
        return m * _v;
    }

    void main() {
        vec3 newPosition = position;

        // Twist effect (based on noise sample)
        float twistPerlin = texture2D(
            uPerlinTexture,
            vec2(0.5, uv.y * 0.2 - uTime * 0.01)
        ).r;
        float angle = twistPerlin * 3.0;
        newPosition.xz = rotate2D(newPosition.xz, angle);

        // Wind offset (another noise sample)
        vec2 windOffset = vec2(
            texture2D(uPerlinTexture, vec2(0.25, uTime * 0.01)).r - 0.5,
            texture2D(uPerlinTexture, vec2(0.75, uTime * 0.01)).r - 0.5
        );
        windOffset *= pow(uv.y, 2.0) * 1.5;
        newPosition.xz += windOffset;

        // Final position
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);

        // Varying
        vUv = uv;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform float uGlobalAlpha;   // <-- We'll multiply by this for fading
    uniform sampler2D uPerlinTexture;

    varying vec2 vUv;

    void main() {
        // Scale + scroll the noise sample
        vec2 smokeUv = vUv;
        smokeUv.x *= 0.5;
        smokeUv.y *= 0.3;
        smokeUv.y -= uTime * 0.04;

        // Sample noise
        float smoke = texture2D(uPerlinTexture, smokeUv).r;

        // Threshold, so only the higher noise values remain
        smoke = smoothstep(0.4, 1.0, smoke);

        // Fade out edges with smoothstep
        smoke *= smoothstep(0.0, 0.1, vUv.x);
        smoke *= smoothstep(1.0, 0.9, vUv.x);
        smoke *= smoothstep(0.0, 0.1, vUv.y);
        smoke *= smoothstep(1.0, 0.4, vUv.y);

        // Combine the result with our 'global alpha' uniform
        float finalAlpha = smoke * uGlobalAlpha;

        gl_FragColor = vec4(1.0, 1.0, 1.0, finalAlpha);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
  `;

  // ------------------------------
  // 3. Uniforms
  // ------------------------------
  const uniforms = {
    uTime: { value: 0.0 },
    uPerlinTexture: { value: perlinTexture },
    uGlobalAlpha: { value: 1.0 }, // start fully visible
  };

  // ------------------------------
  // 4. Material
  // ------------------------------
  const steamMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide, // so we see it from behind as well
    transparent: true, // for alpha blending
    depthWrite: false, // usually off for "foggy" transparent effects
  });

  // ------------------------------
  // 5. Mesh
  // ------------------------------
  const steamMesh = new THREE.Mesh(geometry, steamMaterial);

  return steamMesh;
}
