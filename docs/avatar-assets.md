# Avatar asset provenance

The bundled starter uses Mixamo's **Michelle** character and idle/walk motion
from the **Soldier** character, distributed in the Three.js r180 examples.
Three's [skinning example](https://github.com/mrdoob/three.js/blob/r180/examples/webgpu_skinning.html)
credits Michelle to Mixamo; its
[animation blending example](https://github.com/mrdoob/three.js/blob/r180/examples/webgl_animation_skinning_blending.html)
credits Soldier to Mixamo.

Adobe's [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
permits royalty-free use of characters and animations in personal, commercial,
and nonprofit projects, including video games. These assets are not CC0.
Use them as part of GolfWorld, not as a standalone character/animation library.
No GTA assets are used.

Pinned inputs:

| Source | SHA-256 |
| --- | --- |
| [Michelle.glb](https://github.com/mrdoob/three.js/blob/r180/examples/models/gltf/Michelle.glb) | `7a87e15a99ccbc5e5877be66e1e4ecae0a581adcafa0cce1a5569f49909e968e` |
| [Soldier.glb](https://github.com/mrdoob/three.js/blob/r180/examples/models/gltf/Soldier.glb) | `dfb230fc1f942f259dd00281a1186953ad602fc5d69067ce63e24b2aa439736b` |

GolfWorld modifications: split the original mesh into independent skin,
shirt, trousers, and shoe material regions; retain its original embedded
texture pixels and normal maps; add a procedural golf cap; tint colors at
runtime. Retarget idle/walk rotations against the actual skin bind matrices,
including bone-axis/roll correction and the sources' different coordinate
systems. Freeze hips/root motion so Rapier controls the position and heading.
The idle and walk clips crossfade, and walking speed follows player movement.

To rebuild after obtaining the pinned inputs, use Python 3 with NumPy:

```sh
python3 scripts/prepare-golfer.py Michelle.glb Soldier.glb apps/web/public/models/golfer.glb
```

Python/NumPy are only needed for optional offline asset preparation; the game
still installs and runs with the documented pnpm commands. The prepared
asset is about 3.5 MB, 28,100 triangles, four material regions, a 65-bone rig,
and 512-pixel texture maps. It is served locally and cached by the PWA.

This is a smooth, stylized starter, not a photorealistic likeness or GTA 6
visual parity. A realistic custom avatar requires a dedicated head/body art
asset, facial detail, golf animations, and measured mobile performance.
Multiple players will also need lower-detail variants and animation budgets
before city-scale deployment.
