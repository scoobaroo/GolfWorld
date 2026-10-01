# Local avatar movement

The current slice uses the installed Rapier character controller in all three
playable environments: hub, Meadow Run, and WGS84 neighborhoods. The home editor
keeps its overhead editing camera. No engine, network, or sport stack was added.

- Camera-relative WASD/arrows and the touch joystick share one input path.
  Diagonals normalize, acceleration smooths movement, and fixed physics ticks
  avoid making movement speed depend on rendering frame rate.
- Space/Jump launches a grounded standing avatar at 4.8 m/s with 9.81 m/s² gravity.
  A short jump buffer and ground grace help input timing; midair inputs cannot
  repeatedly launch the avatar. Head impacts stop upward motion.
- C/Crouch reduces the capsule from 1.8 m to 1.2 m and walking speed from 2.6 m/s
  to 1.15 m/s. An overlap query prevents standing up through an overhead solid.
- F/Punch plays a procedural right-arm pose. At the contact phase, a short swept
  sphere selects the first solid obstacle. Dynamic props receive an impulse at
  the hit position. Walls shield objects behind them; there is no damage system.
- Local clubhouse/course tree trunks and mapped building triangle meshes collide.
  The controller slides, climbs small steps, and pushes movable practice crates.
  Mapped water remains an impassable boundary; the current geographic ground is flat.
- Brief dust/contact puffs accompany steps, landings, and solid punches. The
  camera samples interpolated rendered movement, independently of HUD updates.
- Blur, hidden tabs, mode changes, and phone overlays clear input. Each joystick
  owns its pointer, allowing independent touches on action buttons.

## Golf integration

Golf places the player beside the tee on entry and beside each newly settled
lie once. It does not force that position every frame. Return to ball explicitly
re-enters the stance. Walking/actions work between shots and during flight;
the existing ball camera continues following the flight, then returns to the
player camera. E or the Swing button starts the existing two-phase swing.

The UI and local shot command both require a grounded, standing, non-punching
avatar within 2.6 m horizontally and 0.4 m vertically of the lie. Movement input
pauses during the swing. Collision groups and query filters exclude the scoring
ball from player movement and punches, so ordinary actions cannot alter strokes.
Avatar state and props are session-only and do not change the saved-data schema.

TODO for the planned Colyseus work: validate player movement, grounded state,
stance proximity, and action timing on the server before accepting a shot. The
client's local avatar snapshot must not be trusted as authoritative state.

## Validation

`character-motor.test.ts` exercises real Rapier jump/landing, wall collision,
low-ceiling crouch, solid-hit occlusion, and scoring-ball exclusion. Store tests
reject remote/airborne/crouched/punching shots. `movement.spec.ts` checks the real
rendered avatar and rig, keyboard/touch controls, props, course proximity,
automatic next-lie stance, mobile HUD separation, and mapped-building collisions.
Existing golf, home editor, geographic travel, and offline PWA checks remain relevant.

Rapier's [character controller guide](https://rapier.rs/docs/user_guides/javascript/character_controller/)
describes the movement/collision model; implementation uses the API bundled with
the installed 0.19.2 version rather than assuming newer APIs.
