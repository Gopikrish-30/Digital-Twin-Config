import { useState, type CSSProperties, type ReactNode } from "react";
import "./BorderLayout.css";

export interface BorderLayoutProps {
  north?: ReactNode;
  south?: ReactNode;
  /** west/east panels are collapsible via a drag-handle strip, like a dockable editor sidebar. */
  west?: ReactNode;
  east?: ReactNode;
  center: ReactNode;
  westWidth?: number;
  eastWidth?: number;
  westDefaultCollapsed?: boolean;
  eastDefaultCollapsed?: boolean;
  className?: string;
}

// Dockable editor shell: north/south bars around a middle row of west/center/east.
// Region model follows the classic BorderLayout pattern used by desktop 3D editors
// (see packages/ui/NOTICE.md) — reimplemented here as a plain function component.
export function BorderLayout({
  north,
  south,
  west,
  east,
  center,
  westWidth = 260,
  eastWidth = 280,
  westDefaultCollapsed = false,
  eastDefaultCollapsed = false,
  className,
}: BorderLayoutProps) {
  const [westCollapsed, setWestCollapsed] = useState(westDefaultCollapsed);
  const [eastCollapsed, setEastCollapsed] = useState(eastDefaultCollapsed);

  return (
    <div className={["dt-border-layout", className].filter(Boolean).join(" ")}>
      {north ? <div className="dt-border-layout__north">{north}</div> : null}
      <div className="dt-border-layout__middle">
        {west ? (
          <div
            className={["dt-border-layout__west", westCollapsed && "dt-collapsed"]
              .filter(Boolean)
              .join(" ")}
            style={{ "--dt-region-width": `${westWidth}px` } as CSSProperties}
          >
            <div className="dt-border-layout__panel-content">{west}</div>
            <button
              type="button"
              className="dt-border-layout__handle"
              onClick={() => setWestCollapsed((c) => !c)}
              aria-label={westCollapsed ? "Expand panel" : "Collapse panel"}
              title={westCollapsed ? "Expand panel" : "Collapse panel"}
            >
              {westCollapsed ? "▸" : "◂"}
            </button>
          </div>
        ) : null}
        <div className="dt-border-layout__center">{center}</div>
        {east ? (
          <div
            className={["dt-border-layout__east", eastCollapsed && "dt-collapsed"]
              .filter(Boolean)
              .join(" ")}
            style={{ "--dt-region-width": `${eastWidth}px` } as CSSProperties}
          >
            <button
              type="button"
              className="dt-border-layout__handle"
              onClick={() => setEastCollapsed((c) => !c)}
              aria-label={eastCollapsed ? "Expand panel" : "Collapse panel"}
              title={eastCollapsed ? "Expand panel" : "Collapse panel"}
            >
              {eastCollapsed ? "◂" : "▸"}
            </button>
            <div className="dt-border-layout__panel-content">{east}</div>
          </div>
        ) : null}
      </div>
      {south ? <div className="dt-border-layout__south">{south}</div> : null}
    </div>
  );
}
