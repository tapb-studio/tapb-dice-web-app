"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import {
  createDiceMesh,
  createDicePhysicsBody,
  createDicePhysicsWorld,
  applyDiceRollImpulse,
  alignDiceToTarget,
  type Dice3DType,
} from "@/lib/dice-3d";
import {
  playDiceShakeSound,
  playDiceHitSound,
  playCritHitSound,
  playCritFailSound,
} from "@/lib/audio";
import { Sparkles, Dices, AlertTriangle, Trophy } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useLanguage } from "@/lib/i18n";

export interface DiceCanvasRollTrigger {
  id: string;
  diceType: string;
  count: number;
  individualResults: number[];
  notation?: string;
  isCritHit?: boolean;
  isCritFail?: boolean;
}

export interface DiceCanvasProps {
  rollTrigger?: DiceCanvasRollTrigger | null;
  onRollComplete?: () => void;
  className?: string;
}

interface ActiveDie {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  diceType: Dice3DType;
  targetValue: number;
  settled: boolean;
  settleStartTime: number | null;
  targetQuat: THREE.Quaternion | null;
}

function disposeHierarchy(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
  });
}

export function DiceCanvas({
  rollTrigger,
  onRollComplete,
  className = "",
}: DiceCanvasProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isRolling, setIsRolling] = useState(false);
  const [hasRolledOnce, setHasRolledOnce] = useState(false);
  const [critStatus, setCritStatus] = useState<"hit" | "fail" | null>(null);

  const lastRollIdRef = useRef<string | null>(null);
  const rollTriggerRef = useRef(rollTrigger);
  rollTriggerRef.current = rollTrigger;
  const onRollCompleteRef = useRef(onRollComplete);
  onRollCompleteRef.current = onRollComplete;

  // Scene and Physics references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  const activeDiceRef = useRef<ActiveDie[]>([]);
  const renderedDiceRef = useRef<ActiveDie[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const rollStartTimeRef = useRef<number>(0);

  // Material and lighting references for dynamic theme switching
  const floorMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const frameMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const goldTrimMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Dynamic theme update for 3D tray
  useEffect(() => {
    const isLight = theme === "light";
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isLight ? 0xefeae0 : 0x0a0a0c);
    }
    if (floorMatRef.current) {
      floorMatRef.current.color.setHex(isLight ? 0x1a402d : 0x14121a);
    }
    if (frameMatRef.current) {
      frameMatRef.current.color.setHex(isLight ? 0x4a2a16 : 0x23140a);
    }
    if (goldTrimMatRef.current) {
      goldTrimMatRef.current.color.setHex(isLight ? 0xd4af37 : 0xd97706);
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.color.setHex(isLight ? 0xfff7ed : 0xdbeafe);
      ambientLightRef.current.intensity = isLight ? 0.95 : 0.65;
    }
    if (dirLightRef.current) {
      dirLightRef.current.color.setHex(0xffedd5);
      dirLightRef.current.intensity = isLight ? 1.5 : 1.4;
    }
  }, [theme]);

  // Initialize Three.js scene & Cannon-es physics world
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // 1. Scene setup
    const isLightInit = theme === "light";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isLightInit ? 0xefeae0 : 0x0a0a0c);
    sceneRef.current = scene;

    // 2. Camera setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 15, 12);
    camera.lookAt(0, -0.4, 0);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // 4. Lighting setup
    const ambientLight = new THREE.AmbientLight(isLightInit ? 0xfff7ed : 0xdbeafe, isLightInit ? 0.95 : 0.65);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffedd5, isLightInit ? 1.5 : 1.4);
    dirLight.position.set(6, 18, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 35;
    dirLight.shadow.camera.left = -9;
    dirLight.shadow.camera.right = 9;
    dirLight.shadow.camera.top = 8;
    dirLight.shadow.camera.bottom = -8;
    dirLight.shadow.bias = -0.0015;
    dirLightRef.current = dirLight;
    scene.add(dirLight);

    const rimLight = new THREE.PointLight(0xf59e0b, 0.8, 30);
    rimLight.position.set(-6, 9, -5);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0x38bdf8, 0.4, 25);
    fillLight.position.set(6, 6, -5);
    scene.add(fillLight);

    // 5. Visual Dice Tray
    const trayWidth = 15.0;
    const trayDepth = 11.0;
    const rimHeight = 1.4;
    const rimThickness = 0.6;

    const floorGeo = new THREE.PlaneGeometry(trayWidth, trayDepth);
    const floorMat = new THREE.MeshStandardMaterial({
      color: isLightInit ? 0x1a402d : 0x14121a,
      roughness: 0.85,
      metalness: 0.05,
    });
    floorMatRef.current = floorMat;
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const frameMat = new THREE.MeshStandardMaterial({
      color: isLightInit ? 0x4a2a16 : 0x23140a,
      roughness: 0.4,
      metalness: 0.15,
    });
    frameMatRef.current = frameMat;
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: isLightInit ? 0xd4af37 : 0xd97706,
      roughness: 0.3,
      metalness: 0.7,
    });
    goldTrimMatRef.current = goldTrimMat;

    const frameGroup = new THREE.Group();

    const topRim = new THREE.Mesh(
      new THREE.BoxGeometry(trayWidth + rimThickness * 2, rimHeight, rimThickness),
      frameMat
    );
    topRim.position.set(0, rimHeight / 2 - 0.2, -trayDepth / 2 - rimThickness / 2);
    topRim.castShadow = true;
    topRim.receiveShadow = true;
    frameGroup.add(topRim);

    const bottomRim = new THREE.Mesh(
      new THREE.BoxGeometry(trayWidth + rimThickness * 2, rimHeight, rimThickness),
      frameMat
    );
    bottomRim.position.set(0, rimHeight / 2 - 0.2, trayDepth / 2 + rimThickness / 2);
    bottomRim.castShadow = true;
    bottomRim.receiveShadow = true;
    frameGroup.add(bottomRim);

    const leftRim = new THREE.Mesh(
      new THREE.BoxGeometry(rimThickness, rimHeight, trayDepth),
      frameMat
    );
    leftRim.position.set(-trayWidth / 2 - rimThickness / 2, rimHeight / 2 - 0.2, 0);
    leftRim.castShadow = true;
    leftRim.receiveShadow = true;
    frameGroup.add(leftRim);

    const rightRim = new THREE.Mesh(
      new THREE.BoxGeometry(rimThickness, rimHeight, trayDepth),
      frameMat
    );
    rightRim.position.set(trayWidth / 2 + rimThickness / 2, rimHeight / 2 - 0.2, 0);
    rightRim.castShadow = true;
    rightRim.receiveShadow = true;
    frameGroup.add(rightRim);

    const lipThickness = 0.08;
    const lipHeight = 0.15;
    const topLip = new THREE.Mesh(
      new THREE.BoxGeometry(trayWidth, lipHeight, lipThickness),
      goldTrimMat
    );
    topLip.position.set(0, lipHeight / 2, -trayDepth / 2 + lipThickness / 2);
    frameGroup.add(topLip);

    const botLip = new THREE.Mesh(
      new THREE.BoxGeometry(trayWidth, lipHeight, lipThickness),
      goldTrimMat
    );
    botLip.position.set(0, lipHeight / 2, trayDepth / 2 - lipThickness / 2);
    frameGroup.add(botLip);

    scene.add(frameGroup);

    // 6. Physics World
    const { world } = createDicePhysicsWorld({
      trayWidth,
      trayDepth,
      wallHeight: 5,
      wallThickness: 1,
    });
    worldRef.current = world;

    // 7. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH, false);
        }
      }
    });
    resizeObserver.observe(container);

    // 8. Animation & Physics Loop
    let lastTime = performance.now();

    const animate = (time: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      // Advance physics simulation
      world.step(1 / 60, delta, 3);

      // Update active dice meshes and handle settling
      const activeDice = activeDiceRef.current;
      if (activeDice.length > 0) {
        let allSettled = true;
        const totalRollElapsed = time - rollStartTimeRef.current;

        for (const item of activeDice) {
          item.mesh.position.copy(item.body.position as unknown as THREE.Vector3);

          if (!item.settled) {
            allSettled = false;
            const linSpeed = item.body.velocity.length();
            const angSpeed = item.body.angularVelocity.length();

            // When physics slows down or after safety threshold, initiate smooth alignment
            const shouldAlign =
              (linSpeed < 0.8 && angSpeed < 1.0) || totalRollElapsed > 2200;

            if (!item.targetQuat) {
              item.mesh.quaternion.copy(
                item.body.quaternion as unknown as THREE.Quaternion
              );

              if (shouldAlign) {
                item.targetQuat = alignDiceToTarget(
                  item.mesh.quaternion,
                  item.diceType,
                  item.targetValue
                );
                item.settleStartTime = time;
              }
            } else {
              // Smooth slerp towards the exact upward face orientation
              item.mesh.quaternion.slerp(item.targetQuat, 0.16);

              // Dampen physics body
              item.body.velocity.scale(0.82, item.body.velocity);
              item.body.angularVelocity.scale(0.82, item.body.angularVelocity);

              const angle = item.mesh.quaternion.angleTo(item.targetQuat);
              const settleElapsed = item.settleStartTime ? time - item.settleStartTime : 0;

              if (angle < 0.02 || settleElapsed > 750 || totalRollElapsed > 3200) {
                item.mesh.quaternion.copy(item.targetQuat);
                item.body.quaternion.copy(
                  item.targetQuat as unknown as CANNON.Quaternion
                );
                item.body.sleep();
                item.settled = true;
              }
            }
          }
        }

        // Check if all dice finished settling
        if (allSettled && activeDice.length > 0) {
          setIsRolling(false);
          activeDiceRef.current = []; // Animation loop complete

          const currentTrigger = rollTriggerRef.current;
          if (currentTrigger?.isCritHit) {
            playCritHitSound();
            setCritStatus("hit");
          } else if (currentTrigger?.isCritFail) {
            playCritFailSound();
            setCritStatus("fail");
          } else {
            setCritStatus(null);
          }

          onRollCompleteRef.current?.();
        }
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      renderer.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      frameMat.dispose();
      goldTrimMat.dispose();
      disposeHierarchy(frameGroup);
      for (const item of renderedDiceRef.current) {
        scene.remove(item.mesh);
        disposeHierarchy(item.mesh);
        world.removeBody(item.body);
      }
      renderedDiceRef.current = [];
      activeDiceRef.current = [];
    };
  }, []);

  // Handle new roll triggers
  useEffect(() => {
    if (!rollTrigger || rollTrigger.id === lastRollIdRef.current) return;
    lastRollIdRef.current = rollTrigger.id;

    const scene = sceneRef.current;
    const world = worldRef.current;
    if (!scene || !world) return;

    // Clear previous rendered dice meshes and bodies
    for (const item of renderedDiceRef.current) {
      scene.remove(item.mesh);
      disposeHierarchy(item.mesh);
      world.removeBody(item.body);
    }
    renderedDiceRef.current = [];
    activeDiceRef.current = [];

    setIsRolling(true);
    setHasRolledOnce(true);
    setCritStatus(null);
    rollStartTimeRef.current = performance.now();

    // Sound effect on throw initiation
    playDiceShakeSound();

    const count = Math.min(Math.max(1, rollTrigger.count), 20);
    const results = rollTrigger.individualResults || [];
    const newActiveDice: ActiveDie[] = [];

    // Collision sound throttling tracker
    let lastSoundTime = 0;

    for (let i = 0; i < count; i++) {
      const targetValue = results[i] ?? 1;
      const isCritHit = Boolean(
        rollTrigger.isCritHit &&
          (rollTrigger.diceType.toLowerCase() === "d20" ? targetValue === 20 : true)
      );
      const isCritFail = Boolean(
        rollTrigger.isCritFail &&
          (rollTrigger.diceType.toLowerCase() === "d20" ? targetValue === 1 : true)
      );

      // Create visual mesh with critical styling (radiant gold or dark crimson glow)
      const mesh = createDiceMesh(rollTrigger.diceType as Dice3DType, {
        targetValue,
        isCritHit,
        isCritFail,
      });

      // Create physics body
      const body = createDicePhysicsBody(rollTrigger.diceType as Dice3DType);

      // Stagger spawn positions so dice don't overlap in air
      const cols = Math.min(count, 5);
      const col = i % cols;
      const row = Math.floor(i / cols);

      const startX = (col - (cols - 1) / 2) * 2.2 + (Math.random() - 0.5) * 0.6;
      const startY = 6.0 + row * 1.5 + Math.random() * 0.8;
      const startZ = 4.0 + (Math.random() - 0.5) * 1.0;

      body.position.set(startX, startY, startZ);

      // Apply randomized launch impulse & spin
      applyDiceRollImpulse(body, {
        startX,
        startZ,
        force: 9 + Math.random() * 4,
        torque: 32 + Math.random() * 8,
      });

      // Collision sound listener
      body.addEventListener("collide", () => {
        const now = performance.now();
        if (now - lastSoundTime > 65) {
          const speed = body.velocity.length();
          if (speed > 1.2) {
            lastSoundTime = now;
            playDiceHitSound();
          }
        }
      });

      scene.add(mesh);
      world.addBody(body);

      newActiveDice.push({
        mesh,
        body,
        diceType: rollTrigger.diceType.toLowerCase() as Dice3DType,
        targetValue,
        settled: false,
        settleStartTime: null,
        targetQuat: null,
      });
    }

    activeDiceRef.current = newActiveDice;
    renderedDiceRef.current = newActiveDice;
  }, [rollTrigger]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-0 select-none overflow-hidden rounded-2xl border border-stone-300/80 bg-stone-100 dark:border-amber-950/60 dark:bg-neutral-950 shadow-md dark:shadow-2xl transition-colors ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none cursor-default"
      />

      {/* Idle / Initial State Indicator */}
      {!hasRolledOnce && !isRolling && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 dark:bg-neutral-900/85 backdrop-blur-md border border-amber-500/50 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs sm:text-sm font-medium shadow-md animate-pulse">
            <Dices className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{t("diceTrayIdle")}</span>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-neutral-500 mt-2 font-mono">
            3D Physics Tray • D&D Polyhedral System
          </p>
        </div>
      )}

      {/* Active Rolling Badge */}
      {isRolling && (
        <div className="absolute top-3 left-3 pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/95 dark:bg-neutral-900/85 backdrop-blur-sm border border-stone-300 dark:border-neutral-700/60 text-stone-800 dark:text-neutral-300 text-xs font-mono shadow-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
            <span>{t("rolling")} {rollTrigger?.notation || `${rollTrigger?.count}${rollTrigger?.diceType}`}...</span>
          </div>
        </div>
      )}

      {/* Critical Hit / Natural 20 Celebration Banner */}
      {critStatus === "hit" && (
        <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none px-4">
          <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-stone-950 font-bold text-xs sm:text-sm tracking-wide shadow-xl shadow-amber-500/20 animate-bounce">
            <Trophy className="w-4 h-4 text-stone-950 shrink-0" />
            <span>CRITICAL HIT! NATURAL 20!</span>
          </div>
        </div>
      )}

      {/* Critical Failure / Natural 1 Banner */}
      {critStatus === "fail" && (
        <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none px-4">
          <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-red-600 text-white font-bold text-xs sm:text-sm tracking-wide shadow-xl shadow-red-600/30">
            <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            <span>CRITICAL FAILURE! NATURAL 1</span>
          </div>
        </div>
      )}

      {/* Settled Result Badge Overlay */}
      {!isRolling && hasRolledOnce && rollTrigger && rollTrigger.individualResults?.length > 0 && (
        <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none px-4">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-xl bg-white/95 dark:bg-neutral-900/90 backdrop-blur-md border border-amber-500/50 dark:border-amber-500/40 text-stone-900 dark:text-neutral-100 shadow-xl">
            <span className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold font-mono">
              {t("total")}:
            </span>
            <span className="font-mono text-base font-extrabold text-stone-900 dark:text-amber-200">
              {rollTrigger.individualResults.reduce((a, b) => a + b, 0)}
            </span>
            <span className="text-xs text-stone-500 dark:text-neutral-400 font-mono">
              [{rollTrigger.individualResults.join(", ")}]
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiceCanvas;
