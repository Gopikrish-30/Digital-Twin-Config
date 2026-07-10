import type { ReactNode } from "react";
import "./StatusBar.css";

export interface StatusBarProps {
  children?: ReactNode;
}

export function StatusBar({ children }: StatusBarProps) {
  return <div className="dt-status-bar">{children}</div>;
}
