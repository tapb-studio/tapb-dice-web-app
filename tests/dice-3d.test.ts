import { describe, it, expect } from "vitest";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import {
  VALID_3D_DICE_TYPES,
  createDiceGeometry,
  createDiceShape,
  createDicePhysicsBody,
  createDicePhysicsWorld,
  calculateDiceRotation,
  getFaceNormalForValue,
  createDiceMesh,
  applyDiceRollImpulse,
  getDiceBounds,
  type Dice3DType,
} from "../lib/dice-3d";

describe("3D Polyhedral Dice System (lib/dice-3d.ts)", () => {
  describe("Dice Types and Constants", () => {
    it("exports all standard D&D dice types", () => {
      expect(VALID_3D_DICE_TYPES).toEqual([
        "d4",
        "d6",
        "d8",
        "d10",
        "d12",
        "d20",
        "d100",
      ]);
    });
  });

  describe("createDiceGeometry", () => {
    it.each(VALID_3D_DICE_TYPES)(
      "creates a valid Three.js BufferGeometry for %s",
      (diceType) => {
        const geometry = createDiceGeometry(diceType);
        expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
        expect(geometry.attributes.position).toBeDefined();
        expect(geometry.attributes.position.count).toBeGreaterThan(0);
        expect(geometry.attributes.normal).toBeDefined();
        expect(geometry.attributes.uv).toBeDefined();
      }
    );

    it("has the expected vertex count for polyhedral faces", () => {
      // d4: 4 triangles * 3 = 12 vertices
      expect(createDiceGeometry("d4").attributes.position.count).toBe(12);
      // d6: 6 faces * 2 triangles * 3 = 36 vertices
      expect(createDiceGeometry("d6").attributes.position.count).toBe(36);
      // d8: 8 triangles * 3 = 24 vertices
      expect(createDiceGeometry("d8").attributes.position.count).toBe(24);
      // d10: 10 kite faces * 2 triangles * 3 = 60 vertices
      expect(createDiceGeometry("d10").attributes.position.count).toBe(60);
      // d12: 12 pentagons * 3 triangles * 3 = 108 vertices
      expect(createDiceGeometry("d12").attributes.position.count).toBe(108);
      // d20: 20 triangles * 3 = 60 vertices
      expect(createDiceGeometry("d20").attributes.position.count).toBe(60);
      // d100: 10 kite faces * 2 triangles * 3 = 60 vertices
      expect(createDiceGeometry("d100").attributes.position.count).toBe(60);
    });

    it("throws an error for unsupported dice type", () => {
      expect(() => createDiceGeometry("d30" as Dice3DType)).toThrow(
        /Unsupported dice type/
      );
    });
  });

  describe("getDiceBounds", () => {
    it.each(VALID_3D_DICE_TYPES)(
      "calculates positive bounding box dimensions for %s",
      (diceType) => {
        const bounds = getDiceBounds(diceType);
        expect(bounds.x).toBeGreaterThan(0.5);
        expect(bounds.y).toBeGreaterThan(0.5);
        expect(bounds.z).toBeGreaterThan(0.5);
        expect(bounds.radius).toBeGreaterThan(0.5);
      }
    );
  });

  describe("createDiceShape (Cannon-es physics)", () => {
    it.each(VALID_3D_DICE_TYPES)(
      "creates a valid Cannon-es physics shape for %s",
      (diceType) => {
        const shape = createDiceShape(diceType);
        expect(shape).toBeDefined();
        if (diceType === "d6") {
          expect(shape).toBeInstanceOf(CANNON.Box);
        } else {
          expect(shape).toBeInstanceOf(CANNON.ConvexPolyhedron);
          const poly = shape as CANNON.ConvexPolyhedron;
          expect(poly.vertices.length).toBeGreaterThan(0);
          expect(poly.faces.length).toBeGreaterThan(0);
        }
      }
    );

    it("correctly sets vertex counts for polyhedra shapes", () => {
      const d4Shape = createDiceShape("d4") as CANNON.ConvexPolyhedron;
      expect(d4Shape.vertices.length).toBe(4);
      expect(d4Shape.faces.length).toBe(4);

      const d8Shape = createDiceShape("d8") as CANNON.ConvexPolyhedron;
      expect(d8Shape.vertices.length).toBe(6);
      expect(d8Shape.faces.length).toBe(8);

      const d10Shape = createDiceShape("d10") as CANNON.ConvexPolyhedron;
      expect(d10Shape.vertices.length).toBe(12);

      const d12Shape = createDiceShape("d12") as CANNON.ConvexPolyhedron;
      expect(d12Shape.vertices.length).toBe(20);

      const d20Shape = createDiceShape("d20") as CANNON.ConvexPolyhedron;
      expect(d20Shape.vertices.length).toBe(12);
      expect(d20Shape.faces.length).toBe(20);
    });
  });

  describe("createDicePhysicsBody", () => {
    it.each(VALID_3D_DICE_TYPES)(
      "creates a dynamic body with mass and shape for %s",
      (diceType) => {
        const body = createDicePhysicsBody(diceType, { mass: 2 });
        expect(body).toBeInstanceOf(CANNON.Body);
        expect(body.mass).toBe(2);
        expect(body.shapes.length).toBeGreaterThan(0);
        expect(body.material).toBeDefined();
      }
    );
  });

  describe("createDicePhysicsWorld", () => {
    it("creates a physics world with gravity, floor and 4 boundary walls", () => {
      const { world, floor, walls } = createDicePhysicsWorld({
        trayWidth: 16,
        trayDepth: 12,
        wallHeight: 3,
      });

      expect(world).toBeInstanceOf(CANNON.World);
      expect(world.gravity.y).toBeLessThan(0); // Gravity points down

      // Floor body
      expect(floor).toBeInstanceOf(CANNON.Body);
      expect(floor.mass).toBe(0); // Static

      // 4 walls (left, right, top/front, bottom/back)
      expect(walls).toHaveLength(4);
      walls.forEach((wall) => {
        expect(wall.mass).toBe(0); // Static boundary
      });

      // Advance world simulation without errors
      expect(() => world.step(1 / 60)).not.toThrow();
    });
  });

  describe("calculateDiceRotation & getFaceNormalForValue", () => {
    it.each([
      { diceType: "d4" as Dice3DType, testValues: [1, 2, 3, 4] },
      { diceType: "d6" as Dice3DType, testValues: [1, 2, 3, 4, 5, 6] },
      { diceType: "d8" as Dice3DType, testValues: [1, 4, 8] },
      { diceType: "d10" as Dice3DType, testValues: [1, 5, 10] },
      { diceType: "d12" as Dice3DType, testValues: [1, 6, 12] },
      { diceType: "d20" as Dice3DType, testValues: [1, 10, 20] },
      { diceType: "d100" as Dice3DType, testValues: [10, 50, 100] },
    ])("aligns target face normal with +Y (up) vector for $diceType", ({ diceType, testValues }) => {
      const up = new THREE.Vector3(0, 1, 0);

      for (const val of testValues) {
        const normal = getFaceNormalForValue(diceType, val);
        expect(normal.length()).toBeCloseTo(1, 4);

        const quat = calculateDiceRotation(diceType, val, 0);
        const transformedNormal = normal.clone().applyQuaternion(quat);

        // Transformed normal should point up (+Y)
        expect(transformedNormal.dot(up)).toBeGreaterThan(0.98);
      }
    });

    it("supports applying custom or randomized yaw while preserving the up vector", () => {
      const up = new THREE.Vector3(0, 1, 0);
      const val = 20;
      const normal = getFaceNormalForValue("d20", val);

      const yawAngle = Math.PI / 3; // 60 degrees yaw
      const quat = calculateDiceRotation("d20", val, yawAngle);
      const transformedNormal = normal.clone().applyQuaternion(quat);

      // Even with yaw, dot product with (0, 1, 0) remains 1.0!
      expect(transformedNormal.dot(up)).toBeGreaterThan(0.98);
    });
  });

  describe("createDiceMesh", () => {
    it.each(VALID_3D_DICE_TYPES)(
      "creates a THREE.Mesh with castShadow and receiveShadow enabled for %s",
      (diceType) => {
        const mesh = createDiceMesh(diceType);
        expect(mesh).toBeInstanceOf(THREE.Mesh);
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
        expect(mesh.geometry).toBeDefined();
        expect(mesh.material).toBeDefined();
      }
    );
  });

  describe("applyDiceRollImpulse", () => {
    it("applies linear and angular velocity impulses to Cannon body", () => {
      const body = createDicePhysicsBody("d20");
      expect(body.velocity.length()).toBe(0);
      expect(body.angularVelocity.length()).toBe(0);

      applyDiceRollImpulse(body);

      expect(body.velocity.length()).toBeGreaterThan(0);
      expect(body.angularVelocity.length()).toBeGreaterThan(0);
    });
  });
});
