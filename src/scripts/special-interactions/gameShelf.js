import * as THREE from "three";
import appState from "../core/AppState.js";
import themeManager from "../themeManager.js";
import snapshot from "../../data/recentGames.json";
import layout from "../../data/gameShelfLayout.json";
import { arrangeShelfGames } from "./gameShelfLayout.js";
import { createGameCaseMaterial } from "../shaders/GameCaseShader.js";
import { createContactShadowMaterial } from "../shaders/EnvironmentShader.js";

// The books are baked into texture-six in the current RoomV3 export. Restrict
// removal to their measured bounds; the shelf and its baked UVs stay intact.
const BOOK_BOUNDS = new THREE.Box3(
  new THREE.Vector3(3.837, 1.61, -5.099),
  new THREE.Vector3(5.125, 2.13, -4.585),
);

// Printed spine labels stay legible when the cases are stored edge-first.
function createSpineTexture(game, index) {
  const colors = [
    "#45666b",
    "#314869",
    "#44484d",
    "#66513f",
    "#773f48",
    "#c2b79f",
    "#566448",
  ];
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colors[index % colors.length];
  ctx.fillRect(0, 0, 96, 1024);
  ctx.fillStyle = "#e1ddd1";
  ctx.fillRect(8, 12, 80, 90);
  ctx.fillStyle = "#25333e";
  ctx.textAlign = "center";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("PC", 48, 70);
  ctx.fillStyle = index % colors.length === 5 ? "#26313b" : "#f4f0e6";
  ctx.save();
  ctx.translate(48, 530);
  ctx.rotate(Math.PI / 2);
  ctx.font = "bold 38px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(game.name, 0, 0, 775);
  ctx.restore();
  ctx.font = "24px sans-serif";
  ctx.fillText("STEAM", 48, 985);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function removeEmbeddedShelfBooks(root) {
  const mesh = root.getObjectByName("texture-six");
  if (!mesh?.isMesh || !mesh.geometry.index) return false;
  root.updateMatrixWorld(true);
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const point = new THREE.Vector3();
  const inside = Array.from({ length: position.count }, (_, i) =>
    BOOK_BOUNDS.containsPoint(
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
    ),
  );
  const kept = [];
  let removed = 0;
  for (let i = 0; i < geometry.index.count; i += 3) {
    const a = geometry.index.getX(i);
    const b = geometry.index.getX(i + 1);
    const c = geometry.index.getX(i + 2);
    if (inside[a] && inside[b] && inside[c]) removed++;
    else kept.push(a, b, c);
  }
  // Stop safely if a later model export changes this part of the room.
  if (removed !== 306) {
    console.warn(
      `[Game shelf] Expected 306 book triangles, found ${removed}; keeping the original shelf.`,
    );
    return false;
  }
  mesh.geometry = geometry.clone();
  mesh.geometry.setIndex(kept);
  return true;
}

export function setupGameShelf(root) {
  if (!removeEmbeddedShelfBooks(root)) return null;
  const group = new THREE.Group();
  group.name = "recently-played-game-shelf";
  root.add(group);

  const fallbackMap = new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255]),
    1,
    1,
  );
  fallbackMap.needsUpdate = true;
  const makeMaterial = (color, map = null) => {
    return createGameCaseMaterial(
      color,
      map,
      themeManager.uMixRatio,
      fallbackMap,
    );
  };
  const shell = makeMaterial("#263745");
  const edge = makeMaterial("#526878");
  const coverGeometry = new THREE.PlaneGeometry(0.322, 0.483);
  const spineGeometry = new THREE.PlaneGeometry(0.048, 0.483);
  const shellGeometry = new THREE.BoxGeometry(0.35, 0.515, 0.055);

  const shelfGames = arrangeShelfGames(
    [...snapshot.games, ...(snapshot.featuredGames ?? [])],
    layout,
  );
  const uprightCount = Math.min(8, Math.max(0, shelfGames.length - 2));
  shelfGames.forEach((game, index) => {
    const gameCase = new THREE.Group();
    gameCase.name = `game-case-${game.appId}`;
    gameCase.userData.appId = game.appId;
    gameCase.rotation.order = "ZYX";
    gameCase.rotation.y = Math.PI / 2;
    if (index < uprightCount) {
      const lean = index === uprightCount - 1 ? -0.11 : 0;
      const spacing = 0.061;
      gameCase.rotation.z = lean;
      gameCase.position.set(
        3.96 + index * spacing,
        1.61 + 0.2575 * Math.cos(lean) + 0.0275 * Math.abs(Math.sin(lean)),
        -4.84 + [0, 0.008, -0.006][index % 3],
      );
    } else {
      const stackIndex = index - uprightCount;
      gameCase.rotation.z = Math.PI / 2;
      gameCase.position.set(
        Math.max(4.68, 3.96 + (uprightCount - 1) * 0.061 + 0.43) +
          [0, -0.012, 0.006, -0.005][stackIndex],
        1.61 + 0.0275 + stackIndex * 0.057,
        -4.84 + (stackIndex % 2) * 0.008,
      );
    }
    const texture = appState.textureLoader.load(game.cover);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      4,
      appState.renderer.capabilities.getMaxAnisotropy(),
    );
    const body = new THREE.Mesh(shellGeometry, [
      edge,
      shell,
      edge,
      shell,
      shell,
      shell,
    ]);
    gameCase.add(body);
    const front = new THREE.Mesh(
      coverGeometry,
      makeMaterial("#ffffff", texture),
    );
    front.position.z = 0.0285;
    gameCase.add(front);
    const spine = new THREE.Mesh(
      spineGeometry,
      makeMaterial("#ffffff", createSpineTexture(game, index)),
    );
    spine.rotation.y = -Math.PI / 2;
    spine.position.x = -0.1756;
    gameCase.add(spine);
    gameCase.traverse((child) => {
      if (!child.isMesh) return;
      child.name = `game-case-${game.appId}-raycast`;
      child.userData.gameShelf = true;
      child.userData.hoverGroup = "gameShelf";
      appState.addRaycasterObject(child);
    });
    group.add(gameCase);
  });

  // Soft contact shadows anchor the row and stack to the baked shelf surface.
  const shadowMaterial = createContactShadowMaterial({
    color: 0x251a14,
    opacity: 0.26,
  });
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const addShadow = (x, width) => {
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.name = "game-case-contact-shadow";
    shadow.position.set(x, 1.617, -4.84);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(width, 0.4, 1);
    group.add(shadow);
  };
  if (uprightCount)
    addShadow(
      3.96 + ((uprightCount - 1) * 0.061) / 2,
      uprightCount * 0.061 + 0.06,
    );
  addShadow(Math.max(4.68, 3.96 + (uprightCount - 1) * 0.061 + 0.43), 0.57);

  return { group };
}

export function initializeGameShelfPanel() {
  const dialog = document.createElement("dialog");
  dialog.className = "game-shelf-panel";
  dialog.setAttribute("aria-labelledby", "game-shelf-title");
  dialog.innerHTML = `
    <button class="game-shelf-close" type="button" aria-label="Close recently played games">×</button>
    <p class="game-shelf-eyebrow">A little downtime</p>
    <h2 id="game-shelf-title">Recently played</h2>
    <p class="game-shelf-intro">${snapshot.games.length} games from my recent Steam activity.</p>
    <div class="game-shelf-games"></div>
    <footer><a href="${snapshot.profileUrl}" target="_blank" rel="noopener noreferrer">My Steam profile ↗</a><span></span></footer>`;
  const list = dialog.querySelector(".game-shelf-games");
  snapshot.games.forEach((game) => {
    const link = document.createElement("a");
    link.className = "game-shelf-game";
    link.href = game.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const artwork = document.createElement("img");
    artwork.src = game.cover;
    artwork.alt = `${game.name} cover`;
    artwork.width = 600;
    artwork.height = 900;
    const title = document.createElement("h3");
    title.textContent = game.name;
    const detail = document.createElement("p");
    detail.textContent = `${game.hoursOnRecord} hrs total${game.lastPlayedLabel ? ` · Played ${game.lastPlayedLabel}` : ""}`;
    link.append(artwork, title, detail);
    list.append(link);
  });
  const date = new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Singapore",
  }).format(new Date(snapshot.fetchedAt));
  dialog.querySelector("footer span").textContent = `Updated ${date}`;
  document.body.append(dialog);
  let previousFocus;
  let previousControlsEnabled;
  let previousRaycastEnabled;
  dialog
    .querySelector("button")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    event.stopPropagation();
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    appState.cameraManager.controls.enabled = previousControlsEnabled;
    if (previousRaycastEnabled) appState.enableRaycast();
    previousFocus?.focus();
  });
  return () => {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    if (previousFocus?.closest(".side-panel")) {
      previousFocus = document.querySelector(".hamburger-btn");
    }
    previousControlsEnabled = appState.cameraManager.controls.enabled;
    previousRaycastEnabled = appState.isRaycastEnabled;
    appState.cameraManager.controls.enabled = false;
    appState.raycasterController.clearHover();
    appState.disableRaycast();
    dialog.showModal();
  };
}
