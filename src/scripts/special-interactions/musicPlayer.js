import * as THREE from "three";
import appState from "../core/AppState.js";
import themeManager from "../themeManager.js";
import { createContactShadowMaterial } from "../shaders/EnvironmentShader.js";

// The GLB is authored in Blender with its dock resting at the origin.
// This is the free space to the right of the existing bedside lamp.
const PLAYER_POSITION = new THREE.Vector3(-4.72, 3.0155, 3.68);

function createPlayerMaterial(source) {
  const isScreenInk = source.name.includes("Spotify_Green");
  return new THREE.ShaderMaterial({
    name: `Bedside_${source.name}`,
    uniforms: {
      uColor: { value: source.color.clone() },
      uMixRatio: themeManager.uMixRatio,
      uScreenInk: { value: isScreenInk ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uMixRatio;
      uniform float uScreenInk;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normal = normalize(vWorldNormal);
        float windowLight = max(dot(normal, normalize(vec3(-0.7, 1.0, -0.8))), 0.0);
        vec3 lampDirection = normalize(vec3(-5.09, 3.46, 4.02) - vWorldPosition);
        float lampLight = max(dot(normal, lampDirection), 0.0);
        float contact = mix(0.80, 1.0, smoothstep(3.0155, 3.07, vWorldPosition.y));
        vec3 day = vec3(1.0, 0.965, 0.91) * (0.72 + 0.22 * windowLight);
        vec3 night = vec3(0.69, 0.79, 1.0) * 0.15
          + vec3(1.0, 0.73, 0.44) * lampLight * 0.24;
        vec3 lighting = mix(day, night, uMixRatio) * contact;
        lighting += uScreenInk * mix(0.24, 0.40, uMixRatio);
        // Match the room's baked material output convention.
        gl_FragColor = vec4(uColor * lighting, 1.0);
      }
    `,
  });
}

function createScreenGlassMaterial(environment) {
  return new THREE.ShaderMaterial({
    name: "Player_Recessed_Screen_Glass",
    transparent: true,
    depthWrite: false,
    uniforms: {
      uEnvironment: { value: environment },
      uMixRatio: themeManager.uMixRatio,
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform samplerCube uEnvironment;
      uniform float uMixRatio;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 toCamera = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normal, toCamera), 0.0), 5.0);
        vec3 reflected = textureCube(uEnvironment, reflect(-toCamera, normal)).rgb;
        float reflectionStrength = mix(0.38, 0.10, uMixRatio);
        gl_FragColor = vec4(reflected * reflectionStrength, 0.045 + 0.16 * fresnel);
      }
    `,
  });
}

export function loadMusicPlayer(roomRoot) {
  appState.gltfLoader.load(
    "/models/spotify-player.glb",
    (gltf) => {
      const player = gltf.scene;
      player.name = "bedside-spotify-player";
      player.position.copy(PLAYER_POSITION);
      player.userData.feature = "spotify-on-repeat";
      player.userData.connected = false;
      const materialCache = new Map();
      const screenEnvironment = themeManager.loadGlassEnvironmentMap();
      const replaceMaterial = (source) => {
        if (!materialCache.has(source.uuid))
          materialCache.set(
            source.uuid,
            source.name === "Player_Screen_Glass"
              ? createScreenGlassMaterial(screenEnvironment)
              : createPlayerMaterial(source),
          );
        return materialCache.get(source.uuid);
      };
      player.traverse((child) => {
        if (!child.isMesh) return;
        child.material = Array.isArray(child.material)
          ? child.material.map(replaceMaterial)
          : replaceMaterial(child.material);
        child.userData.spotifyPlayer = true;
        child.userData.hoverGroup = "spotifyPlayer";
        appState.addRaycasterObject(child);
      });
      roomRoot.add(player);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.312, 0.232),
        createContactShadowMaterial({ color: 0x34251e, opacity: 0.22 }),
      );
      shadow.name = "music-player-contact-shadow";
      shadow.position.copy(PLAYER_POSITION);
      shadow.position.y += 0.001;
      shadow.rotation.x = -Math.PI / 2;
      shadow.rotation.z = Math.PI / 2;
      roomRoot.add(shadow);
    },
    undefined,
    (error) =>
      console.error("[Music player] Could not load the Blender asset", error),
  );
}
