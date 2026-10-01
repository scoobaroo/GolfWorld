export const controls = { x: 0, z: 0, yaw: 0, pitch: 0.25, keys: new Set<string>(), jump: false, punch: false, crouch: false };
export function resetControls(): void {
  controls.x = 0; controls.z = 0; controls.keys.clear();
  controls.jump = false; controls.punch = false; controls.crouch = false;
}
export function isTextInputEvent(event: KeyboardEvent): boolean {
  return [event.target, document.activeElement].some((target) => target instanceof Element &&
    target.closest('input, textarea, select, [contenteditable="true"], gmp-basic-place-autocomplete, gmp-place-autocomplete'));
}
export function isGoogleInputEvent(event: KeyboardEvent): boolean {
  return [event.target, document.activeElement].some((target) => target instanceof Element &&
    target.closest('gmp-basic-place-autocomplete, gmp-place-autocomplete'));
}
export function movementInput(): { forward: number; side: number; jump: boolean; punch: boolean; crouch: boolean } {
  const keys = controls.keys;
  const forward = controls.z + Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const side = controls.x + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const length = Math.max(1, Math.hypot(forward, side));
  const result = { forward: forward / length, side: side / length, jump: controls.jump, punch: controls.punch, crouch: controls.crouch || keys.has('KeyC') };
  controls.jump = false; controls.punch = false;
  return result;
}
