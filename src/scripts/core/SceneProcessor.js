// scripts/scene/SceneProcessor.js
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import themeManager from "../themeManager.js";
import clockManager from "../clock.js";
import { processRotatingObject } from "../utils/objectRotation.js";
import appState from "../core/AppState.js";
import {
  createGrassGroundMaterial,
  createGrassMaterial,
} from "../shaders/GrassShader.js";

const MAILBOX_HOVER_GROUP_ID = "mailboxSet";
const GRASS_EDGE_PADDING = 0.25;
const GRASS_PATH_PADDING = 0.32;

export function processScene(sceneRoot) {
  let grassGround = null;

  sceneRoot.traverse((child) => {
    // Hide any object with "backdrop" in its name
    if (child.name.includes("backdrop")) {
      child.visible = false;
    }

    // Log the position of objects containing "anchor"
    if (child.name.includes("monitor-screen-anchor")) {
      console.log("Found anchor:", child.name, child.position);
    }
    if (child.name.includes("whiteboard-raycast-seven")) {
      console.log("Found anchor:", child.name, child.position);
    }

    if (!child.isMesh) return;

    if (child.name === "grass-ground") {
      grassGround = child;
      child.material = createGrassGroundMaterial(themeManager.uMixRatio);
    }

    if (themeManager.processThemedMesh(child, window.loadedTextures)) {
      categorizeAnimated(child);
      processSpecial(child);
      processRotatingObject(child);

      if (child.name.includes("raycast")) appState.addRaycasterObject(child);
      if (child.name.includes("hat"))
        console.log("Found hat mesh:", child.position);
    }

    // Mailbox body + cover hover group
    if (
      child.name === "mailbox-one-raycast" ||
      child.name === "mailbox-cover-one"
    ) {
      console.log("Found mailbox piece:", child.name, child.position);

      child.userData.hoverGroup = MAILBOX_HOVER_GROUP_ID;

      // body has "raycast" already; make sure the cover is raycastable too
      if (!child.name.includes("raycast")) {
        appState.addRaycasterObject(child);
      }
    }

    // material tweaks
    if (child.material?.map) child.material.map.minFilter = THREE.LinearFilter;

    // clock hands
    if (child.name.includes("clock-hour")) clockManager.setHourHand(child);
    else if (child.name.includes("clock-min"))
      clockManager.setMinuteHand(child);
    else if (child.name.includes("clock-sec"))
      clockManager.setSecondsHand(child);

    // glass materials
    themeManager.processGlassMesh(child);
  });

  return { grassGround };
}

/* ---------- helpers ------------------------------------------------ */
// export function createGrassTerrain(scene) {
//   // Keep the same blade size
//   const bladeGeo = new THREE.ConeGeometry(0.1, 0.8, 3);
//   bladeGeo.translate(0, 0.4, 0);

//   const grassMaterial = createGrassMaterial();

//   // Slightly larger bounding area
//   const width = 40;
//   const depth = 40;

//   // Proportional increase to maintain the exact same density!
//   const instanceCount = 180000;

//   const instancedGrass = new THREE.InstancedMesh(
//     bladeGeo,
//     grassMaterial,
//     instanceCount,
//   );
//   const dummy = new THREE.Object3D();

//   for (let i = 0; i < instanceCount; i++) {
//     const x = (Math.random() - 0.5) * width;
//     const z = (Math.random() - 0.5) * depth;
//     const y = 0;

//     dummy.position.set(x, y, z);
//     dummy.rotation.y = Math.random() * Math.PI * 2;

//     const scale = 0.6 + Math.random() * 0.6;
//     dummy.scale.set(scale, scale, scale);

//     dummy.updateMatrix();
//     instancedGrass.setMatrixAt(i, dummy.matrix);
//   }

//   const groundGeo = new THREE.PlaneGeometry(width, depth);
//   const groundMat = new THREE.MeshBasicMaterial({ color: 0x26661a });
//   const groundMesh = new THREE.Mesh(groundGeo, groundMat);
//   groundMesh.rotation.x = -Math.PI / 2;
//   groundMesh.position.y = -0.01;

//   scene.add(groundMesh);
//   scene.add(instancedGrass);

//   return grassMaterial;
// }

export function createGrassTerrain(scene, groundMesh) {
  // 1. Create the material immediately
  const grassMaterial = createGrassMaterial(themeManager.uMixRatio);

  // 2. Load the texture
  appState.textureLoader.load("/textures/grass_texture.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    grassMaterial.uniforms.uMap.value = texture; // Inject texture into shader
  });

  // 3. Load the custom 3-plane mesh
  appState.gltfLoader.load("/models/bended-grass.glb", (gltf) => {
    let bladeGeo = null;

    // Find the geometry inside the loaded model
    gltf.scene.traverse((child) => {
      if (child.isMesh && !bladeGeo) {
        bladeGeo = child.geometry.clone();
      }
    });

    if (!bladeGeo) return;
    if (!groundMesh?.isMesh) {
      console.warn(
        "grass-ground mesh not found; grass terrain was not created.",
      );
      return;
    }

    const instanceCount = 5200; // Looser coverage lets the ground and planting groups breathe
    groundMesh.updateWorldMatrix(true, false);
    const sampler = new MeshSurfaceSampler(groundMesh).build();
    const boundaryEdges = getWorldBoundaryEdges(groundMesh);
    const pathExclusionBoxes = getPathExclusionBoxes(
      appState.environment,
      GRASS_PATH_PADDING,
    );
    const sampledPosition = new THREE.Vector3();
    const sampledNormal = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const worldPosition = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const alignToSurface = new THREE.Quaternion();

    // Use your custom blade geometry!
    const instancedGrass = new THREE.InstancedMesh(
      bladeGeo,
      grassMaterial,
      instanceCount,
    );
    const dummy = new THREE.Object3D();

    for (let i = 0; i < instanceCount; i++) {
      let attempts = 0;

      do {
        sampler.sample(sampledPosition, sampledNormal);
        worldPosition
          .copy(sampledPosition)
          .applyMatrix4(groundMesh.matrixWorld);
        worldNormal
          .copy(sampledNormal)
          .transformDirection(groundMesh.matrixWorld);
        if (worldNormal.dot(up) < 0) worldNormal.negate();
        attempts++;
      } while (
        attempts < 30 &&
        (worldNormal.dot(up) < 0.72 ||
          isNearBoundaryEdge(
            worldPosition,
            boundaryEdges,
            GRASS_EDGE_PADDING,
          ) ||
          isInsideExclusionBox(worldPosition, pathExclusionBoxes))
      );

      dummy.position.copy(worldPosition);
      alignToSurface.setFromUnitVectors(up, worldNormal);
      dummy.quaternion.copy(alignToSurface);
      dummy.rotateY(Math.random() * Math.PI * 2);

      const widthScale = 0.42 + Math.random() * 0.38;
      const heightScale = 0.42 + Math.random() * 0.55;
      // Keep the shorter average height, but avoid a uniformly clipped lawn.
      dummy.scale.set(widthScale, heightScale * 0.65, widthScale);

      dummy.updateMatrix();
      instancedGrass.setMatrixAt(i, dummy.matrix);
    }

    scene.add(instancedGrass);
  });

  return grassMaterial;
}

function getPathExclusionBoxes(environmentRoot, padding) {
  if (!environmentRoot) return [];

  const paddingVector = new THREE.Vector3(padding, 0, padding);
  const boxes = [];

  environmentRoot.updateWorldMatrix(true, true);
  environmentRoot.traverse((child) => {
    if (!child.isMesh || !child.name.startsWith("ENV_Path_Stone_")) return;

    const box = new THREE.Box3().setFromObject(child);
    box.min.sub(paddingVector);
    box.max.add(paddingVector);
    box.min.y = Number.NEGATIVE_INFINITY;
    box.max.y = Number.POSITIVE_INFINITY;
    boxes.push(box);
  });

  return boxes;
}

function isInsideExclusionBox(point, boxes) {
  return boxes.some((box) => box.containsPoint(point));
}

function categorizeAnimated(mesh) {
  const { name } = mesh;
  if (name.includes("keycapAnimate"))
    appState.addAnimatedObject("keycaps", mesh);
  if (name.includes("animateScale")) appState.addAnimatedObject("scale", mesh);
  if (name.includes("animateSpin")) appState.addAnimatedObject("spin", mesh);
  if (name.includes("scaleLights"))
    appState.addAnimatedObject("scaleLights", mesh);
}

function processSpecial(mesh) {
  const { name } = mesh;
  if (name.includes("pig-head")) appState.setPigObject(mesh);
}

function getWorldBoundaryEdges(mesh) {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const index = geometry.index;
  const edgeCounts = new Map();
  const vertexKey = (vertexIndex) => {
    const x = position.getX(vertexIndex).toFixed(5);
    const y = position.getY(vertexIndex).toFixed(5);
    const z = position.getZ(vertexIndex).toFixed(5);

    return `${x},${y},${z}`;
  };

  const addEdge = (a, b) => {
    const aKey = vertexKey(a);
    const bKey = vertexKey(b);
    const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
    const edge = edgeCounts.get(key);

    if (edge) {
      edge.count++;
    } else {
      edgeCounts.set(key, { a, b, aKey, bKey, count: 1 });
    }
  };

  const triangleCount = index ? index.count / 3 : position.count / 3;

  for (let i = 0; i < triangleCount; i++) {
    const a = index ? index.getX(i * 3) : i * 3;
    const b = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const c = index ? index.getX(i * 3 + 2) : i * 3 + 2;

    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  const boundaryEdges = [...edgeCounts.values()]
    .filter((edge) => edge.count === 1)
    .map(({ a, b }) => ({
      a,
      b,
      aKey: vertexKey(a),
      bKey: vertexKey(b),
      start: new THREE.Vector3()
        .fromBufferAttribute(position, a)
        .applyMatrix4(mesh.matrixWorld),
      end: new THREE.Vector3()
        .fromBufferAttribute(position, b)
        .applyMatrix4(mesh.matrixWorld),
    }));

  return boundaryEdges;
}

function isNearBoundaryEdge(point, boundaryEdges, padding) {
  const paddingSq = padding * padding;

  return boundaryEdges.some(
    ({ start, end }) => distanceToSegmentSq(point, start, end) < paddingSq,
  );
}

function distanceToSegmentSq(point, start, end) {
  const segment = new THREE.Vector3().subVectors(end, start);
  const toPoint = new THREE.Vector3().subVectors(point, start);
  const segmentLengthSq = segment.lengthSq();

  if (segmentLengthSq === 0) return point.distanceToSquared(start);

  const t = THREE.MathUtils.clamp(toPoint.dot(segment) / segmentLengthSq, 0, 1);
  const closestPoint = new THREE.Vector3()
    .copy(start)
    .addScaledVector(segment, t);

  return point.distanceToSquared(closestPoint);
}
