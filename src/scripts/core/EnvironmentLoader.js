import * as THREE from "three";
import appState from "./AppState.js";
import themeManager from "../themeManager.js";
import { MODEL_PATHS } from "../config/constants.js";
import {
  createFoliageAccentMaterial,
  createFoliageMaterial,
  createTreeBarkMaterial,
} from "../shaders/TreeShader.js";
import {
  createEnvironmentGroundMaterial,
  createSteppingStoneMaterial,
} from "../shaders/EnvironmentShader.js";

const FOLIAGE_PREFIX = "MAT_Foliage_";
const BARK_PREFIX = "MAT_Bark_";
const FLOWER_PREFIX = "MAT_Accent_";
const SURFACE_PREFIX = "MAT_Surface_";

const FOLIAGE_PRESETS = {
  tree: {
    windStrength: 0.032,
    windSpeed: 0.86,
    alphaCutoff: 0.39,
    lumaCutoff: 0.0,
    dayDark: 0x23462a,
    dayLight: 0x719748,
    nightDark: 0x101f20,
    nightLight: 0x315147,
  },
  bush: {
    windStrength: 0.012,
    windSpeed: 0.68,
    alphaCutoff: 0.37,
    lumaCutoff: 0.035,
    dayDark: 0x294d2a,
    dayLight: 0x7ca54c,
    nightDark: 0x11201e,
    nightLight: 0x345347,
  },
  hedge: {
    windStrength: 0.007,
    windSpeed: 0.56,
    alphaCutoff: 0.37,
    lumaCutoff: 0.035,
    dayDark: 0x274829,
    dayLight: 0x729746,
    nightDark: 0x101d1d,
    nightLight: 0x304b42,
  },
};

function asMaterialArray(material) {
  return Array.isArray(material) ? material : [material];
}

function getFoliageKind(mesh) {
  if (mesh.name.startsWith("ENV_Hedge_")) return "hedge";
  if (mesh.name.startsWith("ENV_Bush_")) return "bush";
  return "tree";
}

export async function loadEnvironment() {
  const gltf = await appState.gltfLoader.loadAsync(MODEL_PATHS.environment);
  const environmentRoot = gltf.scene;
  const groundRoot = environmentRoot.getObjectByName("ENV_Grass_Ground");
  const timeUniform = { value: 0 };
  const foliageMaterialCache = new Map();
  const barkMaterialCache = new Map();
  const accentMaterialCache = new Map();
  const surfaceMaterial = createSteppingStoneMaterial(themeManager.uMixRatio);
  const groundMaterials = new Map([
    [
      "Grass",
      createEnvironmentGroundMaterial({
        mixRatioUniform: themeManager.uMixRatio,
        name: "EnvironmentGrassGroundShader",
        dayDark: 0x465735,
        dayLight: 0x5f7145,
        nightDark: 0x101a15,
        nightLight: 0x263528,
        variationScale: 0.29,
        patchStrength: 1.0,
      }),
    ],
    [
      "Dirt",
      createEnvironmentGroundMaterial({
        mixRatioUniform: themeManager.uMixRatio,
        name: "EnvironmentSoilShader",
        dayDark: 0x583b31,
        dayLight: 0x765545,
        nightDark: 0x171115,
        nightLight: 0x302329,
        variationScale: 0.22,
      }),
    ],
  ]);
  const foliageMeshes = [];
  const barkMeshes = [];
  const accentMeshes = [];
  const surfaceMeshes = [];
  let grassGround = null;

  environmentRoot.name = "environment";

  groundRoot?.traverse((object) => {
    object.userData.isEnvironmentGroundPart = true;
  });

  environmentRoot.traverse((child) => {
    if (!child.isMesh) return;

    child.frustumCulled = true;

    const importedMaterials = asMaterialArray(child.material);
    const isGroundPart = child.userData.isEnvironmentGroundPart === true;

    if (
      isGroundPart &&
      importedMaterials.some((material) => material?.name === "Grass")
    ) {
      grassGround = child;
    }
    const hasFoliage = importedMaterials.some((material) =>
      material?.name?.startsWith(FOLIAGE_PREFIX),
    );

    let canopyCenter = null;
    let canopyExtent = null;

    if (hasFoliage) {
      child.geometry.computeBoundingBox();
      canopyCenter = child.geometry.boundingBox.getCenter(new THREE.Vector3());
      canopyExtent = child.geometry.boundingBox
        .getSize(new THREE.Vector3())
        .multiplyScalar(0.5);
    }

    const foliageKind = getFoliageKind(child);
    const mappedMaterials = importedMaterials.map((importedMaterial) => {
      const materialName = importedMaterial?.name ?? "";

      if (isGroundPart && groundMaterials.has(materialName)) {
        return groundMaterials.get(materialName);
      }

      if (materialName.startsWith(FOLIAGE_PREFIX)) {
        const cacheKey = [
          importedMaterial.uuid,
          child.geometry.uuid,
          foliageKind,
        ].join(":");

        if (!foliageMaterialCache.has(cacheKey)) {
          foliageMaterialCache.set(
            cacheKey,
            createFoliageMaterial({
              map: importedMaterial.map,
              timeUniform,
              mixRatioUniform: themeManager.uMixRatio,
              canopyCenter,
              canopyExtent,
              name: `FoliageShader:${foliageKind}`,
              ...FOLIAGE_PRESETS[foliageKind],
            }),
          );
        }

        return foliageMaterialCache.get(cacheKey);
      }

      if (materialName.startsWith(BARK_PREFIX)) {
        if (!barkMaterialCache.has(importedMaterial.uuid)) {
          barkMaterialCache.set(
            importedMaterial.uuid,
            createTreeBarkMaterial({
              map: importedMaterial.map,
              mixRatioUniform: themeManager.uMixRatio,
            }),
          );
        }

        return barkMaterialCache.get(importedMaterial.uuid);
      }

      if (materialName.startsWith(FLOWER_PREFIX)) {
        if (!accentMaterialCache.has(importedMaterial.uuid)) {
          accentMaterialCache.set(
            importedMaterial.uuid,
            createFoliageAccentMaterial({
              map: importedMaterial.map,
              mixRatioUniform: themeManager.uMixRatio,
            }),
          );
        }

        return accentMaterialCache.get(importedMaterial.uuid);
      }

      if (materialName.startsWith(SURFACE_PREFIX)) {
        return surfaceMaterial;
      }

      return importedMaterial;
    });

    child.material = Array.isArray(child.material)
      ? mappedMaterials
      : mappedMaterials[0];

    if (hasFoliage) foliageMeshes.push(child);
    if (
      importedMaterials.some((material) =>
        material?.name?.startsWith(BARK_PREFIX),
      )
    ) {
      barkMeshes.push(child);
    }
    if (
      importedMaterials.some((material) =>
        material?.name?.startsWith(FLOWER_PREFIX),
      )
    ) {
      accentMeshes.push(child);
    }
    if (
      importedMaterials.some((material) =>
        material?.name?.startsWith(SURFACE_PREFIX),
      )
    ) {
      surfaceMeshes.push(child);
    }
  });

  if (foliageMeshes.length === 0) {
    console.warn(
      `[Environment] No materials beginning with ${FOLIAGE_PREFIX} were found.`,
    );
  }

  appState.scene.add(environmentRoot);
  appState.environment = environmentRoot;
  appState.environmentShaderController = {
    root: environmentRoot,
    foliageMeshes,
    barkMeshes,
    accentMeshes,
    surfaceMeshes,
    groundRoot,
    grassGround,
    foliageMaterials: [...foliageMaterialCache.values()],
    barkMaterials: [...barkMaterialCache.values()],
    accentMaterials: [...accentMaterialCache.values()],
    surfaceMaterials: [surfaceMaterial],
    groundMaterials: [...groundMaterials.values()],
    update(elapsed) {
      timeUniform.value = elapsed;
    },
  };

  console.log("[Environment] Loaded env.glb", {
    foliageMeshes: foliageMeshes.length,
    barkMeshes: barkMeshes.length,
    accentMeshes: accentMeshes.length,
    surfaceMeshes: surfaceMeshes.length,
    groundRoot: groundRoot?.name ?? null,
    grassGround: grassGround?.name ?? null,
  });

  return appState.environmentShaderController;
}
