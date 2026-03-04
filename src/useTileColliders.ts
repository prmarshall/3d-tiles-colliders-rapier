import { useEffect, useRef } from "react";
import { useRapier } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import type { Object3D } from "three";
import { TileColliderSync } from "./TileColliderSync.js";
import type { TileColliderSyncCallbacks } from "./TileColliderSync.js";
import type { RapierModule, RapierWorld } from "./types.js";

export interface UseTileCollidersOptions {
  /** Friction applied to all trimesh colliders. Default: 1.0 */
  friction?: number;
  /** Restitution (bounciness) applied to all trimesh colliders. Default: 0.0 */
  restitution?: number;
  /** Callbacks for collider lifecycle events. */
  callbacks?: TileColliderSyncCallbacks;
  /**
   * useFrame priority for the sync pass.
   * Should run after tiles have updated. Default: 0
   */
  priority?: number;
}

/**
 * React Three Fiber hook that syncs Rapier trimesh colliders
 * with a streaming 3D Tiles group.
 *
 * @param group - The Object3D group containing tile meshes
 *   (typically `tilesRenderer.group`). Pass `null` while loading.
 * @param options - Configuration for friction, restitution, and callbacks.
 *
 * @example
 * ```tsx
 * import { useTileColliders } from '3d-tiles-colliders-rapier/react';
 *
 * function Scene({ tilesGroup }) {
 *   useTileColliders(tilesGroup, { friction: 1.5 });
 *   return null;
 * }
 * ```
 */
export function useTileColliders(
  group: Object3D | null,
  options: UseTileCollidersOptions = {},
) {
  const { world, rapier } = useRapier();
  const syncRef = useRef<TileColliderSync | null>(null);
  const callbacksRef = useRef(options.callbacks);
  callbacksRef.current = options.callbacks;

  // Keep refs current without re-creating the sync instance
  const worldRef = useRef(world);
  const rapierRef = useRef(rapier);
  worldRef.current = world;
  rapierRef.current = rapier;

  // Stable callback wrapper that reads from ref
  const stableCallbacks = useRef<TileColliderSyncCallbacks>({
    onColliderCreated: (...args) =>
      callbacksRef.current?.onColliderCreated?.(...args),
    onColliderRemoved: (...args) =>
      callbacksRef.current?.onColliderRemoved?.(...args),
    onFirstSync: (...args) => callbacksRef.current?.onFirstSync?.(...args),
  }).current;

  useEffect(() => {
    const sync = new TileColliderSync(
      rapierRef.current as unknown as RapierModule,
      worldRef.current as unknown as RapierWorld,
      {
        friction: options.friction,
        restitution: options.restitution,
        callbacks: stableCallbacks,
      },
    );
    syncRef.current = sync;

    return () => {
      sync.dispose();
      syncRef.current = null;
    };
  }, [options.friction, options.restitution, stableCallbacks]);

  useFrame(() => {
    if (!group || !syncRef.current) return;
    syncRef.current.sync(group);
  }, options.priority ?? 0);
}
