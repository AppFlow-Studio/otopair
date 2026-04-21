/**
 * VehicleTireSelector3D
 *
 * PURPOSE: Low-poly procedural 3D car + 4 tappable tire meshes. Tap a tire
 *          to toggle it in the parent's selected set. Selected tires glow
 *          in OtoPair blue. Camera idles with a subtle yaw so the scene
 *          feels alive without needing orbit controls.
 *
 * REQUIRES native modules `expo-gl` + `expo-three` + `three`. Needs a dev
 * build (`npx expo run:ios`) — will crash in any binary that doesn't bundle
 * ExponentGLObjectManager.
 *
 * USED IN: app/(tire-booking)/index.tsx
 */

import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as THREE from "three";

import type { TirePosition } from "@/stores/useTireBookingStore";

// ============================================================================
// CONSTANTS
// ============================================================================

const BODY_COLOR = 0x2c3640;
const WINDOW_COLOR = 0x0b1620;
const TIRE_COLOR = 0x1a1a1a;
const TIRE_SELECTED_COLOR = 0x5299fe;
const HUB_COLOR = 0xbfc3c9;

const WHEEL_RADIUS = 0.36;
const WHEEL_THICKNESS = 0.22;

// Tire positions in the scene (x = left/right, z = front/back).
const POSITION_COORDS: Record<TirePosition, { x: number; z: number }> = {
  FL: { x: -0.9, z: 1.25 },
  FR: { x: 0.9, z: 1.25 },
  RL: { x: -0.9, z: -1.25 },
  RR: { x: 0.9, z: -1.25 },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface Props {
  selected: TirePosition[];
  onTogglePosition: (p: TirePosition) => void;
}

export function VehicleTireSelector3D({ selected, onTogglePosition }: Props) {
  // Scene refs — build the scene once in onContextCreate and hold onto
  // references so later state changes can update materials/positions.
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const tireMeshRefs = useRef<Record<TirePosition, THREE.Mesh | null>>({
    FL: null,
    FR: null,
    RL: null,
    RR: null,
  });
  const layoutRef = useRef<{ w: number; h: number }>({ w: 1, h: 1 });
  const frameHandleRef = useRef<number | null>(null);
  const selectedRef = useRef<TirePosition[]>(selected);

  // Keep a ref of the latest `selected` so the render loop (onContextCreate
  // closure) can read it without re-binding.
  useEffect(() => {
    selectedRef.current = selected;
    // Push selection state into each tire material immediately.
    for (const pos of ["FL", "FR", "RL", "RR"] as TirePosition[]) {
      const mesh = tireMeshRefs.current[pos];
      if (!mesh) continue;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const isSel = selected.includes(pos);
      mat.color.setHex(isSel ? TIRE_SELECTED_COLOR : TIRE_COLOR);
      mat.emissive.setHex(isSel ? TIRE_SELECTED_COLOR : 0x000000);
      mat.emissiveIntensity = isSel ? 0.55 : 0;
      mesh.scale.setScalar(isSel ? 1.1 : 1);
    }
  }, [selected]);

  const onContextCreate = useCallback(async (gl: import("expo-gl").ExpoWebGLRenderingContext) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    // eslint-disable-next-line no-console
    console.log("[VehicleTireSelector3D] onContextCreate", { width, height });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f7fb);

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(3.6, 3.2, 3.6);
    camera.lookAt(0, 0.3, 0);

    // Ground disk — MeshBasicMaterial so it renders regardless of lights.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 48),
      new THREE.MeshBasicMaterial({ color: 0xe6eaf2 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    scene.add(ground);

    // Car body — MeshBasicMaterial variants are self-lit and always visible.
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.55, 3.2),
      new THREE.MeshBasicMaterial({ color: BODY_COLOR }),
    );
    chassis.position.y = 0.15;
    scene.add(chassis);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.55, 1.85),
      new THREE.MeshBasicMaterial({ color: 0x3b4756 }),
    );
    cabin.position.set(0, 0.65, -0.1);
    scene.add(cabin);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.48, 0.5, 0.8),
      new THREE.MeshBasicMaterial({ color: WINDOW_COLOR }),
    );
    windshield.position.set(0, 0.7, 0.55);
    scene.add(windshield);

    const rearWin = new THREE.Mesh(
      new THREE.BoxGeometry(1.48, 0.5, 0.45),
      new THREE.MeshBasicMaterial({ color: WINDOW_COLOR }),
    );
    rearWin.position.set(0, 0.7, -0.9);
    scene.add(rearWin);

    // Tires — keep MeshStandardMaterial for the emissive glow on select,
    // but add lights so they're not black.
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(4, 6, 3);
    scene.add(key);

    const positions: TirePosition[] = ["FL", "FR", "RL", "RR"];
    for (const pos of positions) {
      const coord = POSITION_COORDS[pos];
      const group = new THREE.Group();
      group.position.set(coord.x, -0.1, coord.z);

      const tireMat = new THREE.MeshStandardMaterial({
        color: TIRE_COLOR,
        roughness: 0.85,
        metalness: 0,
        emissive: 0x000000,
        emissiveIntensity: 0,
      });
      const tireMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_THICKNESS, 32),
        tireMat,
      );
      tireMesh.rotation.z = Math.PI / 2;
      tireMesh.userData.tirePosition = pos;
      tireMesh.name = `tire_${pos}`;
      group.add(tireMesh);

      // Hub.
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(
          WHEEL_RADIUS * 0.45,
          WHEEL_RADIUS * 0.45,
          WHEEL_THICKNESS * 1.02,
          24,
        ),
        new THREE.MeshBasicMaterial({ color: HUB_COLOR }),
      );
      hub.rotation.z = Math.PI / 2;
      group.add(hub);

      scene.add(group);
      tireMeshRefs.current[pos] = tireMesh;
    }

    const renderer = new Renderer({ gl, width, height, pixelRatio: 1 });
    renderer.setClearColor(0xf5f7fb, 1);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Apply initial selection state.
    for (const pos of positions) {
      const mesh = tireMeshRefs.current[pos];
      if (!mesh) continue;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const isSel = selectedRef.current.includes(pos);
      mat.color.setHex(isSel ? TIRE_SELECTED_COLOR : TIRE_COLOR);
      mat.emissive.setHex(isSel ? TIRE_SELECTED_COLOR : 0x000000);
      mat.emissiveIntensity = isSel ? 0.55 : 0;
      mesh.scale.setScalar(isSel ? 1.1 : 1);
    }

    // Render loop — subtle yaw idle.
    const start = Date.now();
    const animate = () => {
      frameHandleRef.current = requestAnimationFrame(animate);
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;
      const t = (Date.now() - start) / 1000;
      const yaw = Math.sin(t * 0.5) * 0.08;
      sceneRef.current.rotation.y = yaw;
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      gl.endFrameEXP();
    };
    animate();
  }, []);

  // Cleanup render loop on unmount.
  useEffect(() => {
    return () => {
      if (frameHandleRef.current != null) cancelAnimationFrame(frameHandleRef.current);
    };
  }, []);

  // Raycast tap → nearest tire mesh → toggle.
  const handleTap = useCallback(
    (x: number, y: number) => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const { w, h } = layoutRef.current;
      if (!scene || !camera || w <= 0 || h <= 0) return;

      const ndcX = (x / w) * 2 - 1;
      const ndcY = -((y / h) * 2 - 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      const tires: THREE.Mesh[] = [];
      for (const pos of ["FL", "FR", "RL", "RR"] as TirePosition[]) {
        const m = tireMeshRefs.current[pos];
        if (m) tires.push(m);
      }
      const intersects = raycaster.intersectObjects(tires, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const pos = hit.userData.tirePosition as TirePosition | undefined;
        if (pos) onTogglePosition(pos);
      }
    },
    [onTogglePosition],
  );

  const tapGesture = useMemo(
    () => Gesture.Tap().runOnJS(true).onEnd((e) => handleTap(e.x, e.y)),
    [handleTap],
  );

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        layoutRef.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
      }}
    >
      <GestureDetector gesture={tapGesture}>
        <View style={StyleSheet.absoluteFill}>
          <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    borderRadius: 20,
    overflow: "hidden",
  },
});
