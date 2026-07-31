// clock.js
import * as THREE from "three";

class ClockManager {
  constructor() {
    if (typeof window !== "undefined" && ClockManager._instance) {
      return ClockManager._instance;
    }
    ClockManager._instance = this;

    this.hourHand = null;
    this.minuteHand = null;
    this.secondsHand = null; // 👈 NEW
  }

  setHourHand(mesh) {
    this.hourHand = mesh;
    this.hourHand.userData.initialRotation =
      this.hourHand.userData.initialRotation ||
      new THREE.Euler().copy(mesh.rotation);
  }

  setMinuteHand(mesh) {
    this.minuteHand = mesh;
    this.minuteHand.userData.initialRotation =
      this.minuteHand.userData.initialRotation ||
      new THREE.Euler().copy(mesh.rotation);
  }

  setSecondsHand(mesh) {
    this.secondsHand = mesh;
    this.secondsHand.userData.initialRotation =
      this.secondsHand.userData.initialRotation ||
      new THREE.Euler().copy(mesh.rotation);
  }

  updateClockHands() {
    if (!this.hourHand || !this.minuteHand || !this.secondsHand) return;

    const now = new Date();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const millis = now.getMilliseconds();

    // ^ If you prefer absolutely smooth motion, fold the milliseconds
    //   into seconds:  seconds + millis / 1000

    const hourAngle = (hours + minutes / 60) * ((2 * Math.PI) / 12);
    const minuteAngle = (minutes + seconds / 60) * ((2 * Math.PI) / 60);
    const secondAngle = (seconds + millis / 1000) * ((2 * Math.PI) / 60);

    this.hourHand.rotation.z = -hourAngle;
    this.minuteHand.rotation.z = -minuteAngle;
    this.secondsHand.rotation.z = -secondAngle;
  }
}

const clockManagerInstance = new ClockManager();
export default clockManagerInstance;
