import { useEffect, useState } from "react";
import { Scene, type TransformTool } from "@digital-twin/viewer-core";
import {
  BorderLayout,
  MenuBar,
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  AccordionSection,
  StatusBar,
} from "@digital-twin/ui";
import "./App.css";

// M1 editor shell: the dockable layout (menu bar, toolbar, hierarchy panel,
// viewport, properties panel, status bar) ported as our own components in
// packages/ui (see its NOTICE.md). No real placement/selection yet — that's
// M2; this proves the chrome around the viewport first.
function App() {
  const [tool, setTool] = useState<TransformTool>("select");

  // Blender's actual keybinds (G/R/S), not the Maya/Unity W/E/R convention —
  // matches the "exact same as Blender" ask. Escape returns to select, same as
  // Blender's transform-cancel behavior.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case "g":
          setTool("move");
          break;
        case "r":
          setTool("rotate");
          break;
        case "s":
          setTool("scale");
          break;
        case "escape":
          setTool("select");
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <BorderLayout
      north={
        <>
          <MenuBar items={["File", "Edit", "View", "Help"]} />
          <Toolbar>
            <ToolbarButton label="Select" active={tool === "select"} onClick={() => setTool("select")} />
            <ToolbarButton label="Move (G)" active={tool === "move"} onClick={() => setTool("move")} />
            <ToolbarButton label="Rotate (R)" active={tool === "rotate"} onClick={() => setTool("rotate")} />
            <ToolbarButton label="Scale (S)" active={tool === "scale"} onClick={() => setTool("scale")} />
            <ToolbarSeparator />
            <ToolbarButton label="Import GLB" />
          </Toolbar>
        </>
      }
      west={
        <AccordionSection title="Hierarchy">
          <p className="app-empty-hint">No assets placed yet — asset library + placement lands in M2.</p>
        </AccordionSection>
      }
      east={
        <>
          <AccordionSection title="Transform">
            <p className="app-empty-hint">Click the box in the viewport, then G/R/S (or the toolbar) to transform it.</p>
          </AccordionSection>
          <AccordionSection title="Parameters" defaultOpen={false}>
            <p className="app-empty-hint">Parameter/department panel lands in M4.</p>
          </AccordionSection>
        </>
      }
      south={
        <StatusBar>
          <span>Ready</span>
          <span>Tool: {tool}</span>
        </StatusBar>
      }
      center={
        <Scene editMode tool={tool}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#5b8def" />
          </mesh>
        </Scene>
      }
    />
  );
}

export default App;
