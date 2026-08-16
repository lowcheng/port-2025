// Backward-compatible bridge for any older imports. The outdoor assets now
// live together in env.glb and are handled by EnvironmentLoader.
export { loadEnvironment, loadEnvironment as loadTrees } from "./EnvironmentLoader.js";
