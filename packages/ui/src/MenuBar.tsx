import "./MenuBar.css";

export interface MenuBarProps {
  title?: string;
  items?: string[];
}

// Static labels for now — dropdown behavior (File > Open, etc.) is a later pass
// once there are real commands to attach; this establishes the chrome/placement.
export function MenuBar({ title = "Digital Twin Configurator", items = [] }: MenuBarProps) {
  return (
    <div className="dt-menu-bar">
      <span className="dt-menu-bar__title">{title}</span>
      {items.map((item) => (
        <span key={item} className="dt-menu-bar__item">
          {item}
        </span>
      ))}
    </div>
  );
}
