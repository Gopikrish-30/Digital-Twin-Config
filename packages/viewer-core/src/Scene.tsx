import { useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { MathUtils, type Object3D } from "three";
import "./Scene.css";

export type TransformTool = "select" | "move" | "rotate" | "scale";

export interface SceneProps {
  /** true in the configurator (gizmos, selection), false on the read-only client dashboard. */
  editMode: boolean;
  /** Active toolbar tool. Only meaningful in edit mode; the dashboard never sets this. */
  tool?: TransformTool;
  children?: ReactNode;
}

const TOOL_TO_GIZMO_MODE = {
  move: "translate",
  rotate: "rotate",
  scale: "scale",
} as const;

interface OrbitControlsHandle {
  enabled: boolean;
}

// Shared render target for both the configurator and the client dashboard (see
// Project-documentation.md §6 — same package, `editMode` toggles authoring affordances).
//
// Viewport chrome (grid, axis gizmo, transform tool) is deliberately modeled after
// Blender's viewport: an adaptive fading cell/section grid, a top-right orientation
// gizmo you can click to snap views, and move/rotate/scale gizmos (G/R/S) on the
// active selection. Until real AssetInstance selection exists (M2+), `tool` drives
// the gizmo on whichever mesh in `children` gets clicked.
export function Scene({ editMode, tool = "select", children }: SceneProps) {
  const [selected, setSelected] = useState<Object3D | null>(null);
  const [orbitControls, setOrbitControls] = useState<OrbitControlsHandle | null>(null);

  const gizmoMode = tool === "select" ? null : TOOL_TO_GIZMO_MODE[tool];

  return (
    <div className="dt-viewport">
      <Canvas
        camera={{ position: [12, 12, 12], fov: 50, near: 0.1, far: 2000 }}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow />

        <AdaptiveGrid />

        <SelectableRegistry onSelect={setSelected}>{children}</SelectableRegistry>

        {editMode && gizmoMode && selected ? (
          <TransformControls
            object={selected}
            mode={gizmoMode}
            translationSnap={0.5}
            rotationSnap={MathUtils.degToRad(15)}
            scaleSnap={0.1}
            onMouseDown={() => orbitControls && (orbitControls.enabled = false)}
            onMouseUp={() => orbitControls && (orbitControls.enabled = true)}
          />
        ) : null}

        <OrbitControls
          ref={setOrbitControls}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={150}
        />

        <GizmoHelper alignment="top-right" margin={[64, 64]}>
          <GizmoViewport axisColors={["#e05252", "#5fbf6b", "#4f7fe0"]} labelColor="#1b1d21" />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}

// Blender's viewport grid gets coarser as you zoom out and finer as you zoom in,
// which is what keeps grid lines from shrinking to sub-pixel width and shimmering/
// "blurring" at a distance. A fixed cellSize can't do that — this swaps between a
// few fixed tiers based on camera distance from the origin so line density on
// screen stays roughly constant regardless of zoom.
const GRID_TIERS = [
  { maxDistance: 25, cellSize: 1, sectionSize: 10, fadeDistance: 40 },
  { maxDistance: 120, cellSize: 10, sectionSize: 100, fadeDistance: 220 },
  { maxDistance: Infinity, cellSize: 100, sectionSize: 1000, fadeDistance: 2000 },
];

function AdaptiveGrid() {
  const [tierIndex, setTierIndex] = useState(0);

  useFrame(({ camera }) => {
    // Distance from the world origin, not the orbit target — fine while nothing
    // pans the view off-center; revisit if/when panning becomes a real feature.
    const distance = camera.position.length();
    const next = GRID_TIERS.findIndex((t) => distance < t.maxDistance);
    if (next !== tierIndex) {
      setTierIndex(next);
    }
  });

  const { cellSize, sectionSize, fadeDistance } = GRID_TIERS[tierIndex];

  return (
    <Grid
      infiniteGrid
      followCamera
      cellSize={cellSize}
      cellThickness={0.5}
      sectionSize={sectionSize}
      sectionThickness={1.25}
      fadeDistance={fadeDistance}
      fadeStrength={1.5}
      cellColor="#4b4e55"
      sectionColor="#6b7280"
    />
  );
}

// Makes meshes among `children` clickable/selectable so the toolbar's
// move/rotate/scale tool has something real to attach a TransformControls gizmo
// to, without yet depending on the M2 instance/selection data model. Click empty
// space (the grid) to deselect.
function SelectableRegistry({
  children,
  onSelect,
}: {
  children?: ReactNode;
  onSelect: (object: Object3D | null) => void;
}) {
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e.object);
      }}
      onPointerMissed={() => onSelect(null)}
    >
      {children}
    </group>
  );
}
