import type { ReactNode } from "react";
import "./Toolbar.css";

export interface ToolbarProps {
  children?: ReactNode;
}

export function Toolbar({ children }: ToolbarProps) {
  return <div className="dt-toolbar">{children}</div>;
}

export interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function ToolbarButton({ label, active, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={["dt-toolbar__button", active && "dt-active"].filter(Boolean).join(" ")}
      onClick={onClick}
      title={label}
    >
      {label}
    </button>
  );
}

export function ToolbarSeparator() {
  return <div className="dt-toolbar__separator" />;
}
