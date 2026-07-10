import type { ReactNode } from "react";
import "./Panel.css";

export interface PanelProps {
  title?: string;
  children?: ReactNode;
}

export function Panel({ title, children }: PanelProps) {
  return (
    <div className="dt-panel">
      {title ? <div className="dt-panel__title">{title}</div> : null}
      <div className="dt-panel__body">{children}</div>
    </div>
  );
}
