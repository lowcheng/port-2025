import * as THREE from "three";
import gsap from "gsap";
import {
  themeVertexShader,
  themeFragmentShader,
} from "./shaders/themeShader.js";

class ThemeManager {
  constructor() {
    if (typeof window !== "undefined" && ThemeManager._instance) {
      return ThemeManager._instance;
    }

    ThemeManager._instance = this;
    // Initialize state
    this.isDarkMode = false;
    this.uMixRatio = { value: 0 };
    this.themeToggle = document.getElementById("theme-toggle");
    this.body = document.body;

    this.themedMeshes = [];
    this.themeListeners = new Set();
  }

  toggleTheme() {
    this.setTheme(!this.isDarkMode);
  }

  setTheme(isDarkMode) {
    this.isDarkMode = !!isDarkMode;

    // Update UI
    this.themeToggle.innerHTML = this.isDarkMode
      ? '<i class="fas fa-moon"></i>'
      : '<i class="fas fa-sun"></i>';

    this.body.classList.toggle("dark-theme", this.isDarkMode);
    this.body.classList.toggle("light-theme", !this.isDarkMode);

    this.updateThreeJSTheme();
    this._notifyThemeChange();
  }

  updateThreeJSTheme() {
    // Animate uMixRatio for shader blending
    gsap.to(this.uMixRatio, {
      value: this.isDarkMode ? 1 : 0,
      duration: 1.5,
      ease: "power2.inOut",
    });
  }

  addThemeListener(listener) {
    this.themeListeners.add(listener);
    return () => this.removeThemeListener(listener);
  }

  removeThemeListener(listener) {
    this.themeListeners.delete(listener);
  }

  _notifyThemeChange() {
    this.themeListeners.forEach((listener) => {
      listener(this.isDarkMode, this.uMixRatio.value);
    });
  }

  getTextureKeyFromName(meshName) {
    if (meshName.includes("-one")) return "one";
    if (meshName.includes("-two")) return "two";
    if (meshName.includes("-three")) return "three";
    if (meshName.includes("-four")) return "four";
    if (meshName.includes("-five")) return "five";
    if (meshName.includes("-six")) return "six";
    if (meshName.includes("-seven")) return "seven";
    if (meshName.includes("-eight")) return "eight";
    if (meshName.includes("-nine")) return "nine";
    if (meshName.includes("-ten")) return "ten";
    if (meshName.includes("-emissive")) return "emissive";

    return null;
  }

  loadTexture(textureLoader, path) {
    const tex = textureLoader.load(path);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  // Assumes files live under: public/textures/webp-compresed/{day,night}/...
  // e.g. /textures/webp-compresed/day/Day-Texture1.webp

  loadAllTextures(textureLoader) {
    const BASE = "/textures/V3";

    // Keep your existing keys ("one"..."ten") so getTextureKeyFromName() still works.
    const textureMap = {
      one: {
        day: `${BASE}/day/Texture1.webp`,
        night: `${BASE}/night/NightTexture1.webp`,
      },
      two: {
        day: `${BASE}/day/Texture2-2k.webp`,
        night: `${BASE}/night/NightTexture2-2k.webp`,
      },
      three: {
        day: `${BASE}/day/Texture3.webp`,
        night: `${BASE}/night/NightTexture3.webp`,
      },
      four: {
        day: `${BASE}/day/Texture4.webp`,
        night: `${BASE}/night/NightTexture4.webp`,
      },
      five: {
        day: `${BASE}/day/Texture5.webp`,
        night: `${BASE}/night/NightTexture5.webp`,
      },
      six: {
        day: `${BASE}/day/Texture6.webp`,
        night: `${BASE}/night/NightTexture6.webp`,
      },
      seven: {
        day: `${BASE}/day/Texture7.webp`,
        night: `${BASE}/night/NightTexture7.webp`,
      },
      eight: {
        day: `${BASE}/day/Texture8.webp`,
        night: `${BASE}/night/NightTexture8.webp`,
      },

      // New emissive names
      emissive: {
        day: `${BASE}/day/TextureEmissive.webp`,
        night: `${BASE}/night/NightTextureEmissive.webp`,
      },
    };

    const loadedTextures = { day: {}, night: {} };

    Object.entries(textureMap).forEach(([key, paths]) => {
      loadedTextures.day[key] = this.loadTexture(textureLoader, paths.day);
      loadedTextures.night[key] = this.loadTexture(textureLoader, paths.night);
    });

    return { textureMap, loadedTextures };
  }

  // Your processThemedMesh stays the same.

  processThemedMesh(child, loadedTextures) {
    const textureKey = this.getTextureKeyFromName(child.name);
    if (!textureKey) return false;

    const isSkinned = child.isSkinnedMesh === true;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uDayTexture: { value: loadedTextures.day[textureKey] },
        uNightTexture: { value: loadedTextures.night[textureKey] },
        uMixRatio: this.uMixRatio,
      },
      vertexShader: themeVertexShader,
      fragmentShader: themeFragmentShader,
      skinning: isSkinned, // ← important
    });

    child.material = material;
    this.themedMeshes.push(child);
    return true;
  }

  loadGlassEnvironmentMap(
    path = "textures/skybox/",
    files = ["px.webp", "nx.webp", "py.webp", "ny.webp", "pz.webp", "nz.webp"],
  ) {
    const loader = new THREE.CubeTextureLoader().setPath(path);
    const cubeMap = loader.load(files);

    cubeMap.colorSpace = THREE.SRGBColorSpace;
    cubeMap.magFilter = THREE.LinearFilter;
    cubeMap.minFilter = THREE.LinearMipmapLinearFilter;
    cubeMap.generateMipmaps = true;
    cubeMap.needsUpdate = true;

    return cubeMap;
  }

  createGlassMaterial() {
    const glassEnvMap = this.loadGlassEnvironmentMap();

    return new THREE.MeshPhysicalMaterial({
      transmission: 1,
      opacity: 1,
      metalness: 0,
      roughness: 0,
      ior: 1.5,
      thickness: 0.01,
      specularIntensity: 1,
      envMap: glassEnvMap,
      envMapIntensity: 1,
    });
  }

  processGlassMesh(child) {
    if (child.name.includes("glass")) {
      child.material = this.createGlassMaterial();
      return true;
    }
    return false;
  }
}

const themeManagerInstance = new ThemeManager();
export default themeManagerInstance;
