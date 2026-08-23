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
import { createContactShadowMaterial } from "../shaders/EnvironmentShader.js";

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

export function createGrassTerrain(
  scene,
  groundMesh,
  {
    environmentRoot = appState.environment,
    roomRoot = null,
    roomGroundReference = null,
  } = {},
) {
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
      environmentRoot,
      GRASS_PATH_PADDING,
    );
    const grassInfluenceZones = getGrassInfluenceZones(
      environmentRoot,
      roomRoot,
      roomGroundReference,
    );
    const sampledPosition = new THREE.Vector3();
    const sampledNormal = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const worldPosition = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const alignToSurface = new THREE.Quaternion();

    // Use your custom blade geometry!
    const contactShadeAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(instanceCount),
      1,
    );
    bladeGeo.setAttribute("aContactShade", contactShadeAttribute);

    const instancedGrass = new THREE.InstancedMesh(
      bladeGeo,
      grassMaterial,
      instanceCount,
    );
    const dummy = new THREE.Object3D();

    for (let i = 0; i < instanceCount; i++) {
      let attempts = 0;
      let grassEffect = { rejection: 0, heightScale: 1, shade: 0 };
      let patchMask = 0;
      let rejectForThinning = false;

      do {
        sampler.sample(sampledPosition, sampledNormal);
        worldPosition
          .copy(sampledPosition)
          .applyMatrix4(groundMesh.matrixWorld);
        worldNormal
          .copy(sampledNormal)
          .transformDirection(groundMesh.matrixWorld);
        if (worldNormal.dot(up) < 0) worldNormal.negate();

        grassEffect = getGrassZoneEffect(
          worldPosition,
          grassInfluenceZones,
        );
        patchMask = getGrassPatchMask(worldPosition);
        // Patch noise now varies blade height/color only. Randomly removing
        // instances created obvious bald islands in an otherwise even lawn.
        const patchRejection = 0;
        const rejectionProbability =
          1 -
          (1 - grassEffect.rejection) *
            (1 - patchRejection);
        rejectForThinning = Math.random() < rejectionProbability;
        attempts++;
      } while (
        attempts < 48 &&
        (worldNormal.dot(up) < 0.72 ||
          isNearBoundaryEdge(
            worldPosition,
            boundaryEdges,
            GRASS_EDGE_PADDING,
          ) ||
          isInsideExclusionBox(worldPosition, pathExclusionBoxes) ||
          rejectForThinning)
      );

      dummy.position.copy(worldPosition);
      alignToSurface.setFromUnitVectors(up, worldNormal);
      dummy.quaternion.copy(alignToSurface);
      dummy.rotateY(Math.random() * Math.PI * 2);

      const widthScale = 0.42 + Math.random() * 0.38;
      const heightScale = 0.42 + Math.random() * 0.55;
      const patchHeightScale = THREE.MathUtils.lerp(1, 0.9, patchMask);
      const proximityWidthScale = THREE.MathUtils.lerp(
        1,
        0.9,
        1 - grassEffect.heightScale,
      );
      dummy.scale.set(
        widthScale * proximityWidthScale,
        heightScale * 0.65 * grassEffect.heightScale * patchHeightScale,
        widthScale * proximityWidthScale,
      );

      dummy.updateMatrix();
      instancedGrass.setMatrixAt(i, dummy.matrix);
      contactShadeAttribute.setX(i, grassEffect.shade);
    }

    contactShadeAttribute.needsUpdate = true;

    scene.add(instancedGrass);
  });

  return grassMaterial;
}

export function createSceneContactShadows(
  scene,
  {
    environmentRoot,
    roomRoot,
    roomGroundReference,
    groundRoot,
    groundMesh,
  },
) {
  const previousGroup = scene.getObjectByName("procedural-contact-shadows");
  if (previousGroup) scene.remove(previousGroup);

  const group = new THREE.Group();
  group.name = "procedural-contact-shadows";
  const groundContactAreas = [];

  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials = {
    tree: createContactShadowMaterial({ opacity: 0.27 }),
    bush: createContactShadowMaterial({ opacity: 0.22 }),
    hedge: createContactShadowMaterial({ opacity: 0.17 }),
    room: createContactShadowMaterial({ opacity: 0.2 }),
    platform: createContactShadowMaterial({
      color: 0x435057,
      opacity: 0.18,
      name: "PlatformContactShadowShader",
    }),
  };

  const groundBox = new THREE.Box3().setFromObject(groundRoot ?? groundMesh);
  const groundTopY = new THREE.Box3().setFromObject(groundMesh).max.y;

  const addShadow = ({ center, width, depth, y, material, name }) => {
    const shadow = new THREE.Mesh(geometry, material);
    shadow.name = name;
    shadow.rotation.x = -Math.PI * 0.5;
    shadow.position.set(center.x, y, center.z);
    shadow.scale.set(width, depth, 1);
    shadow.renderOrder = 1;
    shadow.frustumCulled = true;
    group.add(shadow);
  };

  const addGroundContactArea = ({
    center,
    width,
    depth,
    falloff,
    strength,
  }) => {
    groundContactAreas.push({
      bounds: new THREE.Vector4(
        center.x - width * 0.5,
        center.z - depth * 0.5,
        center.x + width * 0.5,
        center.z + depth * 0.5,
      ),
      params: new THREE.Vector2(falloff, strength),
    });
  };

  if (!groundBox.isEmpty()) {
    const platformCenter = groundBox.getCenter(new THREE.Vector3());
    const platformSize = groundBox.getSize(new THREE.Vector3());
    addShadow({
      center: platformCenter,
      width: platformSize.x * 1.06,
      depth: platformSize.z * 1.06,
      y: groundBox.min.y - 0.035,
      material: materials.platform,
      name: "contact-shadow-platform",
    });
  }

  const roomBox = getRoomFoundationBox(roomRoot, roomGroundReference);
  if (!roomBox.isEmpty()) {
    const roomCenter = roomBox.getCenter(new THREE.Vector3());
    const roomSize = roomBox.getSize(new THREE.Vector3());
    addShadow({
      center: roomCenter,
      width: roomSize.x * 1.22,
      depth: roomSize.z * 1.22,
      y: groundTopY + 0.012,
      material: materials.room,
      name: "contact-shadow-room",
    });
    addGroundContactArea({
      center: roomCenter,
      width: roomSize.x,
      depth: roomSize.z,
      falloff: 0.9,
      strength: 0.18,
    });
  }

  environmentRoot?.updateWorldMatrix(true, true);
  environmentRoot?.traverse((child) => {
    if (!child.isMesh) return;

    const name = child.name;
    const box = new THREE.Box3().setFromObject(child);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    if (/^ENV_Tree_.*_Trunk$/.test(name)) {
      const shadowWidth = THREE.MathUtils.clamp(size.x * 0.8, 0.9, 2.0);
      const shadowDepth = THREE.MathUtils.clamp(size.z * 0.8, 0.75, 1.65);
      addShadow({
        center,
        width: shadowWidth,
        depth: shadowDepth,
        y: groundTopY + 0.016,
        material: materials.tree,
        name: `contact-shadow-${name}`,
      });
      addGroundContactArea({
        center,
        width: shadowWidth,
        depth: shadowDepth,
        falloff: 0.82,
        strength: 0.44,
      });
    } else if (/^ENV_Bush_.*_Base$/.test(name)) {
      const shadowWidth = THREE.MathUtils.clamp(size.x * 0.92, 0.9, 2.5);
      const shadowDepth = THREE.MathUtils.clamp(size.z * 0.92, 0.8, 2.1);
      addShadow({
        center,
        width: shadowWidth,
        depth: shadowDepth,
        y: groundTopY + 0.014,
        material: materials.bush,
        name: `contact-shadow-${name}`,
      });
      addGroundContactArea({
        center,
        width: shadowWidth,
        depth: shadowDepth,
        falloff: 0.68,
        strength: 0.34,
      });
    } else if (/^ENV_Hedge_/.test(name)) {
      const shadowWidth = THREE.MathUtils.clamp(size.x * 0.8, 0.85, 2.6);
      const shadowDepth = THREE.MathUtils.clamp(size.z * 0.8, 0.7, 1.9);
      addShadow({
        center,
        width: shadowWidth,
        depth: shadowDepth,
        y: groundTopY + 0.013,
        material: materials.hedge,
        name: `contact-shadow-${name}`,
      });
      addGroundContactArea({
        center,
        width: shadowWidth,
        depth: shadowDepth,
        falloff: 0.62,
        strength: 0.3,
      });
    }
  });

  applyGroundContactAreas(groundMesh, groundContactAreas);

  scene.add(group);
  return group;
}

function applyGroundContactAreas(groundMesh, contactAreas) {
  const materials = Array.isArray(groundMesh?.material)
    ? groundMesh.material
    : [groundMesh?.material];

  materials.forEach((material) => {
    const boxUniform = material?.uniforms?.uContactBoxes;
    const paramsUniform = material?.uniforms?.uContactParams;
    if (!boxUniform || !paramsUniform) return;

    boxUniform.value.forEach((bounds) => bounds.set(0, 0, 0, 0));
    paramsUniform.value.forEach((params) => params.set(0, 0));

    contactAreas.slice(0, 32).forEach((area, index) => {
      boxUniform.value[index].copy(area.bounds);
      paramsUniform.value[index].copy(area.params);
    });
  });
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

function getGrassInfluenceZones(
  environmentRoot,
  roomRoot,
  roomGroundReference,
) {
  const zones = [];

  environmentRoot?.updateWorldMatrix(true, true);
  environmentRoot?.traverse((child) => {
    if (!child.isMesh) return;

    let settings = null;
    if (child.name.startsWith("ENV_Path_Stone_")) {
      settings = {
        falloff: 0.86,
        rejection: 0.28,
        minHeight: 0.5,
        shade: 0.5,
      };
    } else if (/^ENV_Tree_.*_Trunk$/.test(child.name)) {
      settings = {
        falloff: 0.92,
        rejection: 0.2,
        minHeight: 0.52,
        shade: 0.72,
      };
    } else if (/^ENV_Bush_.*_Base$/.test(child.name)) {
      settings = {
        falloff: 0.82,
        rejection: 0.14,
        minHeight: 0.58,
        shade: 0.58,
      };
    } else if (/^ENV_Hedge_/.test(child.name)) {
      settings = {
        falloff: 0.72,
        rejection: 0.12,
        minHeight: 0.62,
        shade: 0.52,
      };
    }

    if (!settings) return;
    const box = new THREE.Box3().setFromObject(child);
    if (!box.isEmpty()) zones.push({ box, ...settings });
  });

  const roomEdges = getWorldInnerBoundaryEdges(roomGroundReference);
  if (roomEdges.length > 0) {
    zones.push({
      edges: roomEdges,
      falloff: 0.72,
      rejection: 0.2,
      minHeight: 0.5,
      shade: 0.46,
    });
  } else {
    const roomBox = getRoomFoundationBox(roomRoot, roomGroundReference);
    if (!roomBox.isEmpty()) {
      zones.push({
        box: roomBox,
        falloff: 0.92,
        rejection: 0.2,
        minHeight: 0.5,
        shade: 0.48,
      });
    }
  }

  return zones;
}

function getGrassZoneEffect(point, zones) {
  let rejection = 0;
  let heightScale = 1;
  let shade = 0;

  zones.forEach((zone) => {
    const distance = zone.edges
      ? distanceToEdges(point, zone.edges)
      : distanceToBoxXZ(point, zone.box);
    const influence = 1 - THREE.MathUtils.smoothstep(
      distance,
      0,
      zone.falloff,
    );

    rejection = Math.max(rejection, influence * zone.rejection);
    heightScale = Math.min(
      heightScale,
      THREE.MathUtils.lerp(1, zone.minHeight, influence),
    );
    shade = Math.max(shade, influence * zone.shade);
  });

  return { rejection, heightScale, shade };
}

function getGrassPatchMask(point) {
  const patchField =
    Math.sin(point.x * 0.43 + point.z * 0.19) *
      Math.cos(point.x * 0.23 - point.z * 0.37) *
      0.5 +
    0.5;

  return THREE.MathUtils.smoothstep(patchField, 0.68, 0.9);
}

function distanceToBoxXZ(point, box) {
  const dx = Math.max(box.min.x - point.x, 0, point.x - box.max.x);
  const dz = Math.max(box.min.z - point.z, 0, point.z - box.max.z);
  return Math.hypot(dx, dz);
}

function distanceToEdges(point, edges) {
  if (edges.length === 0) return Number.POSITIVE_INFINITY;

  let minimumDistanceSq = Number.POSITIVE_INFINITY;
  edges.forEach(({ start, end }) => {
    minimumDistanceSq = Math.min(
      minimumDistanceSq,
      distanceToSegmentSq(point, start, end),
    );
  });

  return Math.sqrt(minimumDistanceSq);
}

function getFilteredWorldBox(root, predicate = () => true) {
  const result = new THREE.Box3();
  if (!root) return result;

  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    if (!child.isMesh || !predicate(child)) return;

    const childBox = new THREE.Box3().setFromObject(child);
    if (!childBox.isEmpty()) result.union(childBox);
  });

  return result;
}

function getRoomFoundationBox(roomRoot, roomGroundReference) {
  const boundaryBox = getInnerBoundaryBox(roomGroundReference);
  if (!boundaryBox.isEmpty()) return boundaryBox;

  const foundationMesh = roomRoot?.getObjectByName("texture-one");
  if (foundationMesh) return new THREE.Box3().setFromObject(foundationMesh);

  return getFilteredWorldBox(
    roomRoot,
    (mesh) => mesh.name !== "grass-ground",
  );
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

function getWorldInnerBoundaryEdges(mesh) {
  if (!mesh?.isMesh) return [];

  const boundaryEdges = getWorldBoundaryEdges(mesh);
  const worldBox = new THREE.Box3().setFromObject(mesh);
  const epsilon = 0.08;

  return boundaryEdges.filter(({ start, end }) => {
    const midpointX = (start.x + end.x) * 0.5;
    const midpointZ = (start.z + end.z) * 0.5;
    const touchesOuterBoundary =
      Math.abs(midpointX - worldBox.min.x) < epsilon ||
      Math.abs(midpointX - worldBox.max.x) < epsilon ||
      Math.abs(midpointZ - worldBox.min.z) < epsilon ||
      Math.abs(midpointZ - worldBox.max.z) < epsilon;

    return !touchesOuterBoundary;
  });
}

function getInnerBoundaryBox(mesh) {
  const box = new THREE.Box3();
  getWorldInnerBoundaryEdges(mesh).forEach(({ start, end }) => {
    box.expandByPoint(start);
    box.expandByPoint(end);
  });
  return box;
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
