import React from "react";

export default function NavButton({
  color = "primary",
  text = "",
  onClick = () => {},
  ariaLabel = "nav-button",
  id = "",
  buttons = [],
}) {
  const isCssColor =
    typeof color === "string" &&
    (color.startsWith("#") || color.startsWith("rgb") || color.startsWith("hsl"));

  const isActive = Array.isArray(buttons) && buttons.includes(id);

  // If active, force Bootstrap warning; otherwise keep prior behavior
  const className = `btn ${isActive ? "btn-warning" : (!isCssColor ? `btn-${color}` : "")}`.trim();

  const style = {
    padding: "4px 12px",
    borderRadius: 4,
    fontWeight: "400",
    fontSize: "0.9 7rem",
    // Only apply custom CSS color when NOT active
    ...(isCssColor && !isActive ? { backgroundColor: color, borderColor: color } : {}),
  };

  const hasText = String(text || "").trim().length > 0;

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => onClick(id)}
      aria-label={ariaLabel}
    >
      {hasText && <span>{text}</span>}
    </button>
  );
}
