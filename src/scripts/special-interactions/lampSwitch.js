import gsap from "gsap";
import appState from "../core/AppState.js";
import audioManager from "../core/audio.js";
import themeManager from "../themeManager.js";

const LAMP_RAYCAST_NAME = "lamp-five-raycast";
const LAMP_STRING_NAME = "lampstring-five";
const STRING_PULL_DISTANCE = 0.035;

export function setupLampSwitch(sceneRoot) {
  const lampRaycast = sceneRoot.getObjectByName(LAMP_RAYCAST_NAME);
  const lampString = sceneRoot.getObjectByName(LAMP_STRING_NAME);

  if (!lampRaycast || !lampString) {
    console.warn(
      "Lamp switch setup missing lamp-five-raycast or lampstring-five.",
    );
    return null;
  }

  lampRaycast.userData.interactive = true;

  if (!appState.raycasterObjects.includes(lampRaycast)) {
    appState.addRaycasterObject(lampRaycast);
  }

  const restingY = lampString.position.y;
  const pulledY = restingY - STRING_PULL_DISTANCE;
  let isNightMode = themeManager.isDarkMode;

  function handleRaycastIntersection(intersectedObject) {
    if (!isLampHit(intersectedObject)) return false;

    isNightMode = !isNightMode;
    audioManager.playClick();

    gsap.to(lampString.position, {
      y: isNightMode ? pulledY : restingY,
      duration: 0.35,
      ease: isNightMode ? "back.out(2.0)" : "power2.out",
    });

    themeManager.setTheme(isNightMode);
    return true;
  }

  function isLampHit(object) {
    let current = object;

    while (current) {
      if (current === lampRaycast || current.name === LAMP_RAYCAST_NAME) {
        return true;
      }

      current = current.parent;
    }

    return false;
  }

  return {
    handleRaycastIntersection,
  };
}
