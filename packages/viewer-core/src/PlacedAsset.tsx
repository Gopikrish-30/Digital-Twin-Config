import { useGLTF } from "@react-three/drei";
import type { AssetInstance } from "@digital-twin/schema";

export interface PlacedAssetProps {
  instance: AssetInstance;
  glbUrl: string;
  selected?: boolean;
  onSelect?: (instanceId: string) => void;
}

// Renders one AssetInstance at its transform, referencing its AssetDefinition's GLB.
// Geometry is loaded/cached by useGLTF per glbUrl, so N instances of the same definition
// share one parsed scene graph (drei caches by url).
export function PlacedAsset({ instance, glbUrl, selected, onSelect }: PlacedAssetProps) {
  const { scene } = useGLTF(glbUrl);
  const { position, rotation, scale } = instance.transform;

  return (
    <primitive
      object={scene.clone(true)}
      position={position}
      rotation={[0, rotation, 0]}
      scale={scale}
      onClick={(e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onSelect?.(instance.id);
      }}
      // Selected instances get a slight emissive-ish visual cue via userData;
      // actual gizmo attachment happens in the configurator app, not here.
      userData={{ selected: Boolean(selected) }}
    />
  );
}
