import { useState, type ReactNode } from "react";
import "./Accordion.css";

export interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}

// One collapsible section, e.g. "Transform" or "Parameters" inside a sidebar
// stack of sections — the sidebar tab/accordion pattern from doc §5's parameter panel.
export function AccordionSection({ title, defaultOpen = true, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="dt-accordion-section">
      <button
        type="button"
        className="dt-accordion-section__header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={["dt-accordion-section__caret", open && "dt-open"].filter(Boolean).join(" ")}>
          ▶
        </span>
        {title}
      </button>
      {open ? <div className="dt-accordion-section__body">{children}</div> : null}
    </div>
  );
}
