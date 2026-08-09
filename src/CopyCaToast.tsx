import { useEffect, useState } from "react";

export default function CopyCaToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: number | undefined;

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button.ca, button.full-ca") : null;
      if (!target) return;

      setVisible(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), 1600);
    };

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 28,
        transform: "translateX(-50%)",
        zIndex: 9999,
        padding: "10px 16px",
        border: "1px solid #8d57ff",
        borderRadius: 10,
        background: "#131823",
        color: "#ffffff",
        fontSize: "0.8rem",
        fontWeight: 800,
        boxShadow: "0 14px 40px rgba(0,0,0,.38)",
        pointerEvents: "none",
      }}
    >
      CA Copied to clipboard
    </div>
  );
}
