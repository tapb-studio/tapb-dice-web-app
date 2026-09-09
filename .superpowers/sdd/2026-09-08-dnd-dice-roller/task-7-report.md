# Task 7 Report: 3D Physics Dice Canvas Component

## Overview
Implemented the 3D physics-driven dice rendering and simulation system for D&D polyhedral dice (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`), including 3D geometries, Cannon-es collision physics, sound effect integrations, and the responsive client React component. Dice use stylized faceted meshes with high-contrast edge bevels and 2D floating/badge HUD overlays for real-time roll status and critical highlights.

## Key Changes
1. **`lib/dice-3d.ts`**:
   - Geometries for all 7 standard polyhedral dice:
     - `d4`: Tetrahedron (`THREE.TetrahedronGeometry`) with 4 face groups and planar UVs.
     - `d6`: Box (`THREE.BoxGeometry`) with 6 distinct groups and UVs.
     - `d8`: Octahedron (`THREE.OctahedronGeometry`) with 8 face groups and planar UVs.
     - `d10` & `d100`: Custom pentagonal trapezohedron with 10 kite faces (20 triangles, 60 vertices) and planar UVs.
     - `d12`: Dodecahedron (`THREE.DodecahedronGeometry`) with 12 pentagonal face groups (36 triangles, 108 vertices) and planar UVs.
     - `d20`: Icosahedron (`THREE.IcosahedronGeometry`) with 20 triangular face groups and planar UVs.
   - Cannon-es physics shapes:
     - `CANNON.Box` for d6 cube.
     - `CANNON.ConvexPolyhedron` with outward-normal verification for polyhedra (`d4`, `d8`, `d10`, `d12`, `d20`, `d100`).
   - Face normal and rotation calculation helpers:
     - `getFaceNormalForValue`: Maps dice face values (including d100 tens/percentiles) to outward local normal vectors.
     - `calculateDiceRotation`: Returns orientation quaternion aligning any target face with the `+Y` (upward) camera vector, supporting custom/randomized yaw around the vertical axis.
     - `alignDiceToTarget`: Dynamically orients a tumbling/resting die to face the rolled target value upward while retaining its landing yaw.
   - Materials and visual styling:
     - Stylized faceted polyhedral meshes with flat-shading and high-contrast edge wireframe bevels (`THREE.LineSegments`).
     - High-contrast faceted materials with metallic edge lines and floating HUD result badges for dice numbers.
     - High-contrast faceted `THREE.MeshStandardMaterial` with configurable themes and critical hit/failure effects.
   - Physics world & tray boundaries:
     - `createDicePhysicsWorld`: World with floor body and 4 boundary walls.
     - `applyDiceRollImpulse`: Applies randomized downward/inward launch force and tumbling angular torque.

2. **`components/DiceCanvas.tsx`**:
   - Client React component (`"use client"`).
   - Responsive Three.js canvas tray with soft PCF shadows, warm directional torch spotlight, and cool ambient fill.
   - Dark velvet tray floor with rich mahogany frame and gold trim.
   - Integration with `lib/audio.ts`:
     - Plays `playDiceShakeSound` when roll is triggered.
     - Plays `playDiceHitSound` on table and wall collisions (throttled to avoid sound spam).
     - Plays `playCritHitSound` on Natural 20 and `playCritFailSound` on Natural 1.
   - Visual states (2D floating/badge HUD overlays):
     - Idle state: "Click Roll to cast dice" pill with dice icon.
     - Rolling state: "Rolling [notation]..." indicator badge.
     - Critical hit/failure celebratory banners.
   - Smooth settling animation aligning landed dice faces to `individualResults` and calling `onRollComplete`.
   - `ResizeObserver` for smooth resizing across mobile and desktop viewports.

3. **`tests/dice-3d.test.ts`**:
   - Comprehensive unit test suite covering:
     - All 7 dice types in `VALID_3D_DICE_TYPES`.
     - Geometry vertex counts, normal, and UV attributes.
     - Bounding box dimension calculations via `getDiceBounds`.
     - Cannon-es shapes and vertex counts (`CANNON.Box` & `CANNON.ConvexPolyhedron`).
     - Dynamic physics bodies and world boundaries (floor + 4 walls).
     - Upward vector alignment via `calculateDiceRotation` for all face values.
     - Impulse application and shadow configuration on meshes.

## Fix Round 1 (Review Feedback Addressed)

### Changes Implemented
1. **Resolved Stale Closure in `components/DiceCanvas.tsx`**:
   - Added `diceType: Dice3DType` directly to the `ActiveDie` interface so each active die retains its own dice type throughout its lifecycle.
   - Updated the `animate` loop settling logic to pass `item.diceType` to `alignDiceToTarget(item.mesh.quaternion, item.diceType, item.targetValue)`, preventing fallback to default "d20" due to stale closures.
   - Added mutable `rollTriggerRef` to always hold the latest `rollTrigger` prop without recreating the Three.js canvas effect.
   - In the settling completion block, read `rollTriggerRef.current` for `isCritHit` / `isCritFail` sound triggers and banner state.

2. **GPU Memory Leak Prevention & Hierarchy Disposal**:
   - Added `disposeHierarchy(obj: THREE.Object3D)` helper that traverses the complete object hierarchy (including `THREE.Mesh` and `THREE.LineSegments` wireframe edge children) to dispose all geometries and multi-materials.
   - Replaced shallow disposals with `disposeHierarchy` both when clearing old dice between throws and upon component unmount (including `frameGroup` visual tray borders).

3. **Critical Mesh Highlighting**:
   - Passed `isCritHit` and `isCritFail` to `createDiceMesh` on spawn, enabling radiant gold or dark blood red emissive glow and edge wireframe highlights on critical rolls.

4. **Visual Architecture Documentation**:
   - Documented that dice use stylized faceted meshes with flat-shading, high-contrast edge wireframe bevels (`THREE.LineSegments`), and 2D floating/badge HUD overlays.

## Verification
- `npx tsc --noEmit`: PASS (0 errors).
- `npx vitest run tests/dice-3d.test.ts`: PASS (49/49 tests passed).
- `npm test`: PASS (141/141 tests passed across all 7 test files).

## Commits
- `7f4c180`: `feat(3d): implement 3D physics dice canvas component`
- `580bbb8`: `fix(3d): address review findings for DiceCanvas stale closure, GPU cleanup, and crit styling`
