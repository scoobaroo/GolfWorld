export const controls = { x: 0, z: 0, yaw: 0, pitch: 0.25, keys: new Set<string>() };
export function resetControls(): void { controls.x = 0; controls.z = 0; controls.keys.clear(); }
