import * as THREE from "three";
import * as CANNON from "cannon-es";

export type Dice3DType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export const VALID_3D_DICE_TYPES: Dice3DType[] = [
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "d20",
  "d100",
];

export const DICE_THEME_COLORS: Record<Dice3DType, number> = {
  d4: 0xe11d48, // Rose / Crimson
  d6: 0x2563eb, // Sapphire Blue
  d8: 0x059669, // Emerald Green
  d10: 0x7c3aed, // Royal Purple
  d12: 0xd97706, // Amber / Gold
  d20: 0xdc2626, // Ruby Red
  d100: 0x0891b2, // Cyan / Obsidian Teal
};

export const CRIT_HIT_COLOR = 0xf59e0b; // Radiant Gold
export const CRIT_FAIL_COLOR = 0x7f1d1d; // Dark Blood Red

/**
 * Creates a pentagonal trapezohedron geometry for d10 and d100 dice.
 */
export function createD10Geometry(radius = 1.1, height = 1.35): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];

  // Vertex 0: Top apex
  vertices.push(0, height, 0);
  // Vertex 1: Bottom apex
  vertices.push(0, -height, 0);

  // 5 upper belt vertices (indices 2..6)
  const h = height * 0.18;
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5;
    vertices.push(radius * Math.cos(angle), h, radius * Math.sin(angle));
  }

  // 5 lower belt vertices (indices 7..11), offset by 36 deg (PI / 5)
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5 + Math.PI / 5;
    vertices.push(radius * Math.cos(angle), -h, radius * Math.sin(angle));
  }

  // 5 Upper kite faces (each split into 2 triangles)
  for (let i = 0; i < 5; i++) {
    const uCurr = 2 + i;
    const uNext = 2 + ((i + 1) % 5);
    const lCurr = 7 + i;

    indices.push(0, uCurr, lCurr);
    indices.push(0, lCurr, uNext);
  }

  // 5 Lower kite faces (each split into 2 triangles)
  for (let i = 0; i < 5; i++) {
    const lCurr = 7 + i;
    const lNext = 7 + ((i + 1) % 5);
    const uNext = 2 + ((i + 1) % 5);

    indices.push(1, lNext, uNext);
    indices.push(1, uNext, lCurr);
  }

  const uvs = new Float32Array(indices.length * 2);
  for (let i = 0; i < indices.length; i += 3) {
    uvs[i * 2] = 0.5;
    uvs[i * 2 + 1] = 1.0;
    uvs[(i + 1) * 2] = 0.0;
    uvs[(i + 1) * 2 + 1] = 0.0;
    uvs[(i + 2) * 2] = 1.0;
    uvs[(i + 2) * 2 + 1] = 0.0;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  const nonIndexed = geom.toNonIndexed();
  nonIndexed.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

/**
 * Creates the appropriate Three.js BufferGeometry for the given polyhedral dice type.
 * Geometries are non-indexed with position, normal, and uv attributes.
 */
export function createDiceGeometry(diceType: string): THREE.BufferGeometry {
  const normalized = diceType.toLowerCase() as Dice3DType;

  if (!VALID_3D_DICE_TYPES.includes(normalized)) {
    throw new Error(
      `Unsupported dice type: "${diceType}". Supported types: ${VALID_3D_DICE_TYPES.join(", ")}`
    );
  }

  let geometry: THREE.BufferGeometry;

  switch (normalized) {
    case "d4":
      geometry = new THREE.TetrahedronGeometry(1.2);
      break;
    case "d6":
      geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
      break;
    case "d8":
      geometry = new THREE.OctahedronGeometry(1.2);
      break;
    case "d10":
    case "d100":
      geometry = createD10Geometry(1.1, 1.35);
      break;
    case "d12":
      geometry = new THREE.DodecahedronGeometry(1.2);
      break;
    case "d20":
      geometry = new THREE.IcosahedronGeometry(1.2);
      break;
  }

  if (geometry.index) {
    geometry = geometry.toNonIndexed();
  }

  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Calculates bounding dimensions and radius for a dice type.
 */
export function getDiceBounds(diceType: string): {
  x: number;
  y: number;
  z: number;
  radius: number;
} {
  const geom = createDiceGeometry(diceType);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  const bbox = geom.boundingBox!;
  const sphere = geom.boundingSphere!;
  return {
    x: bbox.max.x - bbox.min.x,
    y: bbox.max.y - bbox.min.y,
    z: bbox.max.z - bbox.min.z,
    radius: sphere.radius,
  };
}

/**
 * Converts a Three.js BufferGeometry into a CANNON.ConvexPolyhedron.
 * Deduplicates vertices and enforces counter-clockwise face winding viewed from the outside.
 */
export function geometryToConvexPolyhedron(
  geometry: THREE.BufferGeometry
): CANNON.ConvexPolyhedron {
  const position = geometry.attributes.position;
  if (!position) {
    throw new Error("Geometry must have a position attribute");
  }

  const vertices: CANNON.Vec3[] = [];
  const faces: number[][] = [];
  const vertexMap = new Map<string, number>();

  function getVertexIndex(x: number, y: number, z: number): number {
    const key = `${x.toFixed(4)}_${y.toFixed(4)}_${z.toFixed(4)}`;
    const existing = vertexMap.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const idx = vertices.length;
    vertices.push(new CANNON.Vec3(x, y, z));
    vertexMap.set(key, idx);
    return idx;
  }

  const numTriangles = geometry.index
    ? geometry.index.count / 3
    : position.count / 3;

  for (let i = 0; i < numTriangles; i++) {
    let a: number, b: number, c: number;
    if (geometry.index) {
      a = geometry.index.getX(i * 3);
      b = geometry.index.getX(i * 3 + 1);
      c = geometry.index.getX(i * 3 + 2);
    } else {
      a = i * 3;
      b = i * 3 + 1;
      c = i * 3 + 2;
    }

    const idx0 = getVertexIndex(
      position.getX(a),
      position.getY(a),
      position.getZ(a)
    );
    const idx1 = getVertexIndex(
      position.getX(b),
      position.getY(b),
      position.getZ(b)
    );
    const idx2 = getVertexIndex(
      position.getX(c),
      position.getY(c),
      position.getZ(c)
    );

    // Skip degenerate triangles where vertices coincide
    if (idx0 === idx1 || idx1 === idx2 || idx2 === idx0) {
      continue;
    }

    const v0 = vertices[idx0];
    const v1 = vertices[idx1];
    const v2 = vertices[idx2];

    const cb = new CANNON.Vec3();
    const ab = new CANNON.Vec3();
    v2.vsub(v1, cb);
    v0.vsub(v1, ab);
    cb.cross(ab, cb); // normal

    const center = new CANNON.Vec3(
      (v0.x + v1.x + v2.x) / 3,
      (v0.y + v1.y + v2.y) / 3,
      (v0.z + v1.z + v2.z) / 3
    );

    // Ensure counter-clockwise winding when viewed from outside
    if (cb.dot(center) < 0) {
      faces.push([idx0, idx2, idx1]);
    } else {
      faces.push([idx0, idx1, idx2]);
    }
  }

  return new CANNON.ConvexPolyhedron({ vertices, faces });
}

/**
 * Creates the appropriate Cannon-es physics shape for the dice type.
 * Uses CANNON.Box for d6 for optimal box-box / box-plane collisions,
 * and CANNON.ConvexPolyhedron for polyhedral shapes.
 */
export function createDicePhysicsShape(diceType: string): CANNON.Shape {
  const normalized = diceType.toLowerCase() as Dice3DType;

  if (!VALID_3D_DICE_TYPES.includes(normalized)) {
    throw new Error(`Unsupported dice type: "${diceType}"`);
  }

  if (normalized === "d6") {
    // Half extents for 1.4x1.4x1.4 cube
    return new CANNON.Box(new CANNON.Vec3(0.7, 0.7, 0.7));
  }

  const geometry = createDiceGeometry(normalized);
  return geometryToConvexPolyhedron(geometry);
}

// Alias for backwards/test compatibility
export const createDiceShape = createDicePhysicsShape;

export interface DiceMaterialOptions {
  isCritHit?: boolean;
  isCritFail?: boolean;
  color?: number | string;
  targetValue?: number;
}

/**
 * Creates a stylish fantasy D&D MeshStandardMaterial with sharp faceted shading.
 */
export function createDiceMaterial(
  diceType: string,
  options: DiceMaterialOptions = {}
): THREE.Material {
  const normalized = diceType.toLowerCase() as Dice3DType;

  if (options.isCritHit) {
    return new THREE.MeshStandardMaterial({
      color: CRIT_HIT_COLOR,
      roughness: 0.2,
      metalness: 0.45,
      emissive: new THREE.Color(0xb45309),
      emissiveIntensity: 0.35,
      flatShading: true,
    });
  }

  if (options.isCritFail) {
    return new THREE.MeshStandardMaterial({
      color: CRIT_FAIL_COLOR,
      roughness: 0.4,
      metalness: 0.1,
      emissive: new THREE.Color(0x450a0a),
      emissiveIntensity: 0.4,
      flatShading: true,
    });
  }

  const baseColor =
    options.color !== undefined
      ? options.color
      : DICE_THEME_COLORS[normalized] ?? 0xdc2626;

  return new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.25,
    metalness: 0.2,
    flatShading: true,
  });
}

/**
 * Creates a Three.js Mesh with shadow support and polyhedral styling.
 */
export function createDiceMesh(
  diceType: string,
  options: DiceMaterialOptions = {}
): THREE.Mesh {
  const normalized = diceType.toLowerCase() as Dice3DType;
  const geometry = createDiceGeometry(normalized);
  const material = createDiceMaterial(normalized, options);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Add edge wireframe for enhanced polyhedral contrast
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const edgesMaterial = new THREE.LineBasicMaterial({
    color: options.isCritHit ? 0xfef08a : 0xffffff,
    transparent: true,
    opacity: 0.35,
  });
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
  mesh.add(edges);

  return mesh;
}

export interface DicePhysicsBodyOptions {
  mass?: number;
  position?: { x: number; y: number; z: number };
}

/**
 * Creates a dynamic Cannon-es body configured for dice simulation.
 */
export function createDicePhysicsBody(
  diceType: string,
  options: DicePhysicsBodyOptions = {}
): CANNON.Body {
  const normalized = diceType.toLowerCase() as Dice3DType;
  const shape = createDiceShape(normalized);
  const mass = options.mass ?? 1.0;
  const diceMaterial = new CANNON.Material("dice");

  const body = new CANNON.Body({
    mass,
    shape,
    material: diceMaterial,
    linearDamping: 0.1,
    angularDamping: 0.15,
  });

  if (options.position) {
    body.position.set(
      options.position.x,
      options.position.y,
      options.position.z
    );
  }

  return body;
}

export interface DicePhysicsWorldOptions {
  trayWidth?: number;
  trayDepth?: number;
  wallHeight?: number;
  wallThickness?: number;
  gravity?: number;
}

export interface DicePhysicsWorldResult {
  world: CANNON.World;
  floor: CANNON.Body;
  walls: CANNON.Body[];
}

/**
 * Creates a Cannon-es physics world with floor and 4 boundary walls.
 */
export function createDicePhysicsWorld(
  options: DicePhysicsWorldOptions = {}
): DicePhysicsWorldResult {
  const width = options.trayWidth ?? 14;
  const depth = options.trayDepth ?? 14;
  const wallHeight = options.wallHeight ?? 6;
  const gravityY = options.gravity ?? -9.82;
  const wallThickness = options.wallThickness ?? 1.0;

  const world = new CANNON.World();
  world.gravity.set(0, gravityY, 0);

  // Floor plane at y = 0
  const floorMaterial = new CANNON.Material("floor");
  const floor = new CANNON.Body({ mass: 0, material: floorMaterial });
  floor.addShape(new CANNON.Plane());
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  const halfW = width / 2;
  const halfD = depth / 2;
  const halfH = wallHeight / 2;

  const walls: CANNON.Body[] = [];
  const wallMaterial = new CANNON.Material("wall");

  function addWall(
    hx: number,
    hy: number,
    hz: number,
    px: number,
    py: number,
    pz: number
  ) {
    const wall = new CANNON.Body({ mass: 0, material: wallMaterial });
    wall.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    wall.position.set(px, py, pz);
    world.addBody(wall);
    walls.push(wall);
  }

  // 4 walls
  addWall(
    halfW + wallThickness,
    halfH,
    wallThickness / 2,
    0,
    halfH,
    -halfD - wallThickness / 2
  ); // North / Back
  addWall(
    halfW + wallThickness,
    halfH,
    wallThickness / 2,
    0,
    halfH,
    halfD + wallThickness / 2
  ); // South / Front
  addWall(
    wallThickness / 2,
    halfH,
    halfD + wallThickness,
    -halfW - wallThickness / 2,
    halfH,
    0
  ); // West / Left
  addWall(
    wallThickness / 2,
    halfH,
    halfD + wallThickness,
    halfW + wallThickness / 2,
    halfH,
    0
  ); // East / Right

  // Contact materials for realistic tabletop bounces
  const diceMaterial = new CANNON.Material("dice");
  const floorContact = new CANNON.ContactMaterial(diceMaterial, floorMaterial, {
    restitution: 0.35,
    friction: 0.3,
  });
  const wallContact = new CANNON.ContactMaterial(diceMaterial, wallMaterial, {
    restitution: 0.5,
    friction: 0.2,
  });
  world.addContactMaterial(floorContact);
  world.addContactMaterial(wallContact);

  return { world, floor, walls };
}

// Backward-compatible physics tray function
export function createPhysicsTray(
  world: CANNON.World,
  dimensions: { width?: number; length?: number; wallHeight?: number } = {}
): { floorBody: CANNON.Body; wallBodies: CANNON.Body[] } {
  const result = createDicePhysicsWorld({
    trayWidth: dimensions.width ?? 14,
    trayDepth: dimensions.length ?? 14,
    wallHeight: dimensions.wallHeight ?? 8,
  });

  // Re-add to provided world
  world.addBody(result.floor);
  result.walls.forEach((w) => world.addBody(w));

  return {
    floorBody: result.floor,
    wallBodies: result.walls,
  };
}

// Unique face normals computation and caching
function computeUniqueFaceNormals(geometry: THREE.BufferGeometry): THREE.Vector3[] {
  const pos = geometry.attributes.position;
  const normals: THREE.Vector3[] = [];

  for (let i = 0; i < pos.count; i += 3) {
    const v0 = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const v1 = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const v2 = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

    const cb = new THREE.Vector3().subVectors(v2, v1);
    const ab = new THREE.Vector3().subVectors(v0, v1);
    const n = new THREE.Vector3().crossVectors(cb, ab).normalize();

    const center = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);
    if (n.dot(center) < 0) {
      n.negate();
    }

    const exists = normals.some((existing) => existing.dot(n) > 0.95);
    if (!exists) {
      normals.push(n);
    }
  }

  return normals;
}

const FACE_NORMALS_CACHE = new Map<Dice3DType, THREE.Vector3[]>();

/**
 * Returns the local outward-pointing normal for the face corresponding to the given roll value.
 */
export function getFaceNormalForValue(
  diceType: string,
  value: number
): THREE.Vector3 {
  const normalized = diceType.toLowerCase() as Dice3DType;
  let normals = FACE_NORMALS_CACHE.get(normalized);

  if (!normals) {
    normals = computeUniqueFaceNormals(createDiceGeometry(normalized));
    FACE_NORMALS_CACHE.set(normalized, normals);
  }

  let idx: number;
  if (normalized === "d100") {
    idx = value >= 10 && value % 10 === 0 ? Math.floor(value / 10) - 1 : value - 1;
  } else {
    idx = value - 1;
  }

  idx = ((idx % normals.length) + normals.length) % normals.length;
  return normals[idx].clone();
}

/**
 * Calculates a rotation quaternion that orients the die so that the face
 * corresponding to value points directly up (+Y), with optional yaw.
 */
export function calculateDiceRotation(
  diceType: string,
  value: number,
  yawAngle = 0
): THREE.Quaternion {
  const normal = getFaceNormalForValue(diceType, value);
  const up = new THREE.Vector3(0, 1, 0);

  // Align face normal to +Y
  const qAlign = new THREE.Quaternion().setFromUnitVectors(normal, up);

  if (yawAngle !== 0) {
    const qYaw = new THREE.Quaternion().setFromAxisAngle(up, yawAngle);
    return qYaw.multiply(qAlign);
  }

  return qAlign;
}

/**
 * Aligns a die's current resting orientation to smoothly point targetValue upwards,
 * preserving the current landing yaw.
 */
export function alignDiceToTarget(
  currentQuat: THREE.Quaternion,
  diceType: Dice3DType | string,
  targetValue: number
): THREE.Quaternion {
  const normal = getFaceNormalForValue(diceType, targetValue);
  const currentFaceNormal = normal.clone().applyQuaternion(currentQuat);
  const up = new THREE.Vector3(0, 1, 0);
  const deltaQuat = new THREE.Quaternion().setFromUnitVectors(currentFaceNormal, up);
  return deltaQuat.multiply(currentQuat);
}

/**
 * Applies linear and angular velocity impulses to a Cannon body.
 */
export function applyDiceRollImpulse(
  body: CANNON.Body,
  options: {
    impulseStrength?: number;
    angularStrength?: number;
    force?: number;
    torque?: number;
    startX?: number;
    startZ?: number;
  } = {}
): void {
  const impulse = options.impulseStrength ?? options.force ?? 8;
  const angular = options.angularStrength ?? options.torque ?? 25;

  const startX = options.startX ?? (Math.random() - 0.5) * 4;
  const startZ = options.startZ ?? 3 + Math.random() * 2;

  const vx = -startX * 1.5 + (Math.random() - 0.5) * 4;
  const vy = -(Math.random() * 3 + 2);
  const vz = -startZ * 1.8 - Math.random() * impulse;
  body.velocity.set(vx, vy, vz);

  const wx = (Math.random() - 0.5) * angular;
  const wy = (Math.random() - 0.5) * angular;
  const wz = (Math.random() - 0.5) * angular;
  body.angularVelocity.set(wx, wy, wz);

  body.wakeUp();
}

export interface DiceInstance {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  diceType: Dice3DType;
  edges?: THREE.LineSegments;
}

/**
 * Creates a combined Three.js Mesh and Cannon-es Body pair for a polyhedral die.
 */
export function createDiceInstance(
  diceType: string,
  options: DiceMaterialOptions = {}
): DiceInstance {
  const normalized = diceType.toLowerCase() as Dice3DType;
  const mesh = createDiceMesh(normalized, options);
  const body = createDicePhysicsBody(normalized);

  return { mesh, body, diceType: normalized };
}

export interface ThrowOptions {
  origin?: { x: number; y: number; z: number };
  spread?: number;
}

/**
 * Throws multiple dice into the tray with randomized positions, linear impulse, and tumbling spin.
 */
export function throwDice(
  diceInstances: Array<{ body: CANNON.Body; mesh?: THREE.Object3D }>,
  options: ThrowOptions = {}
): void {
  const origin = options.origin ?? { x: 0, y: 7.5, z: 0 };
  const spread = options.spread ?? 2.0;

  diceInstances.forEach((dice, idx) => {
    const angle = (idx / diceInstances.length) * 2 * Math.PI + Math.random() * 0.5;
    const dist = (Math.random() * 0.5 + 0.5) * spread;
    const x = origin.x + Math.cos(angle) * dist;
    const z = origin.z + Math.sin(angle) * dist;
    const y = origin.y + Math.random() * 2.0;

    dice.body.position.set(x, y, z);
    dice.body.quaternion.setFromEuler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    const toCenterX = -x * (1.2 + Math.random());
    const toCenterZ = -z * (1.2 + Math.random());
    dice.body.velocity.set(
      toCenterX + (Math.random() - 0.5) * 3,
      -4 - Math.random() * 3,
      toCenterZ + (Math.random() - 0.5) * 3
    );

    dice.body.angularVelocity.set(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30
    );

    dice.body.wakeUp();

    if (dice.mesh) {
      dice.mesh.position.set(
        dice.body.position.x,
        dice.body.position.y,
        dice.body.position.z
      );
      dice.mesh.quaternion.set(
        dice.body.quaternion.x,
        dice.body.quaternion.y,
        dice.body.quaternion.z,
        dice.body.quaternion.w
      );
    }
  });
}

/**
 * Copies position and rotation from Cannon-es body to Three.js Object3D.
 */
export function syncMeshWithBody(mesh: THREE.Object3D, body: CANNON.Body): void {
  mesh.position.set(body.position.x, body.position.y, body.position.z);
  mesh.quaternion.set(
    body.quaternion.x,
    body.quaternion.y,
    body.quaternion.z,
    body.quaternion.w
  );
}

/**
 * Checks whether all dice in the list have settled.
 */
export function areDiceSettled(
  diceList: Array<{ body: CANNON.Body }>,
  velocityThreshold = 0.15,
  angularThreshold = 0.25
): boolean {
  if (diceList.length === 0) return true;
  return diceList.every((die) => {
    const v = die.body.velocity.length();
    const w = die.body.angularVelocity.length();
    return v < velocityThreshold && w < angularThreshold;
  });
}
