# 3d-tiles-colliders-rapier

LOD-aware physics sync — dynamically creates and destroys [Rapier](https://rapier.rs/) trimesh colliders from streaming [3D Tiles](https://github.com/NASA-AMMOS/3DTilesRendererJS).

As tiles load and unload during LOD transitions, this library keeps the physics world in sync: new tile meshes get trimesh colliders, unloaded tiles have their colliders removed. No manual tracking required.

## Install

```bash
npm install 3d-tiles-colliders-rapier
```

Peer dependencies: `three` (>=0.150) and `@dimforge/rapier3d-compat` (>=0.12).

For the React hook, also install `@react-three/fiber` and `@react-three/rapier`.

## Usage

### Vanilla Three.js + Rapier

```ts
import RAPIER from "@dimforge/rapier3d-compat";
import { TileColliderSync } from "3d-tiles-colliders-rapier";

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

const sync = new TileColliderSync(RAPIER, world, {
  friction: 1.5,
  callbacks: {
    onFirstSync: (count) => console.log(`${count} tile colliders created`),
  },
});

// In your render loop, after tilesRenderer.update():
function animate() {
  tilesRenderer.update();
  sync.sync(tilesRenderer.group);
  world.step();
  requestAnimationFrame(animate);
}

// On cleanup:
sync.dispose();
```

### React Three Fiber

```tsx
import { useTileColliders } from "3d-tiles-colliders-rapier/react";

function TilePhysics({ tilesGroup }) {
  useTileColliders(tilesGroup, {
    friction: 1.5,
    callbacks: {
      onFirstSync: (count) => console.log(`${count} tile colliders created`),
    },
  });
  return null;
}
```

## API

### `TileColliderSync`

The core class. Framework-agnostic (Three.js + Rapier only).

```ts
new TileColliderSync(rapier, world, options?)
```

| Option        | Type                        | Default | Description                          |
| ------------- | --------------------------- | ------- | ------------------------------------ |
| `friction`    | `number`                    | `1.0`   | Friction for all trimesh colliders   |
| `restitution` | `number`                    | `0.0`   | Bounciness for all trimesh colliders |
| `callbacks`   | `TileColliderSyncCallbacks` | `{}`    | Lifecycle callbacks                  |

**Methods:**

- `sync(group: Object3D)` — Diff meshes and update colliders. Call once per frame.
- `dispose()` — Remove all colliders from the Rapier world.
- `colliderCount` — Number of active colliders.

### `useTileColliders` (React hook)

R3F wrapper around `TileColliderSync`. Requires `@react-three/rapier` context.

```ts
useTileColliders(group: Object3D | null, options?)
```

Accepts the same options as `TileColliderSync` plus:

| Option     | Type     | Default | Description                           |
| ---------- | -------- | ------- | ------------------------------------- |
| `priority` | `number` | `0`     | `useFrame` priority for the sync pass |

## How it works

Each frame, `sync()` traverses the tile group and collects visible meshes by UUID. It diffs this set against the previous frame:

1. **New meshes** — Extracts vertex positions, bakes the world matrix, builds a `Float32Array` of world-space vertices and a `Uint32Array` index buffer, then creates a Rapier trimesh collider.
2. **Removed meshes** — Deletes the corresponding collider from the Rapier world.

This handles LOD transitions transparently: when the tile renderer swaps a parent tile for higher-detail children (or vice versa), the physics colliders update to match.

## License

MIT
