import { Mesh, Vector3 } from "three";
import type { Object3D } from "three";
import type {
  RapierCollider,
  RapierColliderDesc,
  RapierWorld,
  RapierModule,
} from "./types.js";

export interface TileColliderSyncCallbacks {
  /** Called when a collider is created for a tile mesh. */
  onColliderCreated?: (meshUuid: string, collider: RapierCollider) => void;
  /** Called when a collider is removed (tile unloaded by LOD). */
  onColliderRemoved?: (meshUuid: string) => void;
  /** Called once when the first batch of meshes is processed. */
  onFirstSync?: (meshCount: number) => void;
}

export interface TileColliderSyncOptions {
  /** Friction applied to all trimesh colliders. Default: 1.0 */
  friction?: number;
  /** Restitution (bounciness) applied to all trimesh colliders. Default: 0.0 */
  restitution?: number;
  /** Callbacks for collider lifecycle events. */
  callbacks?: TileColliderSyncCallbacks;
}

/**
 * LOD-aware physics sync for 3D Tiles.
 *
 * Tracks visible tile meshes by UUID. Each frame, call `sync(group)` to:
 * - Create Rapier trimesh colliders for newly loaded tile meshes
 * - Remove colliders for meshes unloaded by LOD transitions
 *
 * Works with any Three.js Object3D group containing meshes (designed for
 * 3d-tiles-renderer's `tilesRenderer.group`).
 */
export class TileColliderSync {
  private world: RapierWorld;
  private rapier: RapierModule;
  private colliderMap = new Map<string, RapierCollider>();
  private friction: number;
  private restitution: number;
  private callbacks: TileColliderSyncCallbacks;
  private firstSyncDone = false;

  constructor(
    rapier: RapierModule,
    world: RapierWorld,
    options: TileColliderSyncOptions = {},
  ) {
    this.rapier = rapier;
    this.world = world;
    this.friction = options.friction ?? 1.0;
    this.restitution = options.restitution ?? 0.0;
    this.callbacks = options.callbacks ?? {};
  }

  /** Number of active colliders currently tracked. */
  get colliderCount(): number {
    return this.colliderMap.size;
  }

  /**
   * Diff visible meshes against tracked colliders.
   * Call this once per frame after tiles have updated.
   */
  sync(group: Object3D): void {
    // Collect current visible meshes
    const currentMeshes = new Map<string, Mesh>();
    group.traverse((child) => {
      if ((child as Mesh).isMesh) {
        currentMeshes.set(child.uuid, child as Mesh);
      }
    });

    // Remove colliders for meshes no longer visible
    for (const [uuid, collider] of this.colliderMap) {
      if (!currentMeshes.has(uuid)) {
        this.world.removeCollider(collider, true);
        this.colliderMap.delete(uuid);
        this.callbacks.onColliderRemoved?.(uuid);
      }
    }

    // Add colliders for new meshes
    for (const [uuid, mesh] of currentMeshes) {
      if (this.colliderMap.has(uuid)) continue;

      const collider = this.createTrimeshCollider(mesh);
      if (collider) {
        this.colliderMap.set(uuid, collider);
        this.callbacks.onColliderCreated?.(uuid, collider);
      }
    }

    if (!this.firstSyncDone && currentMeshes.size > 0) {
      this.firstSyncDone = true;
      this.callbacks.onFirstSync?.(currentMeshes.size);
    }
  }

  /**
   * Remove all tracked colliders from the Rapier world.
   * Call this on cleanup / unmount.
   */
  dispose(): void {
    for (const [uuid, collider] of this.colliderMap) {
      this.world.removeCollider(collider, true);
      this.callbacks.onColliderRemoved?.(uuid);
    }
    this.colliderMap.clear();
    this.firstSyncDone = false;
  }

  private createTrimeshCollider(mesh: Mesh): RapierCollider | null {
    const geo = mesh.geometry;
    if (!geo) return null;

    const posAttr = geo.getAttribute("position");
    if (!posAttr) return null;

    // Bake world matrix into vertices
    mesh.updateWorldMatrix(true, false);
    const worldMatrix = mesh.matrixWorld;

    const v = new Vector3();
    const vertices = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      v.applyMatrix4(worldMatrix);
      vertices[i * 3] = v.x;
      vertices[i * 3 + 1] = v.y;
      vertices[i * 3 + 2] = v.z;
    }

    // Build index array
    let indices: Uint32Array;
    if (geo.index) {
      indices = new Uint32Array(geo.index.array);
    } else {
      // Non-indexed geometry: sequential triangles
      indices = new Uint32Array(posAttr.count);
      for (let i = 0; i < posAttr.count; i++) indices[i] = i;
    }

    const desc = this.rapier.ColliderDesc.trimesh(vertices, indices);
    if (!desc) return null;

    desc.friction = this.friction;
    desc.restitution = this.restitution;

    return this.world.createCollider(desc as RapierColliderDesc);
  }
}
