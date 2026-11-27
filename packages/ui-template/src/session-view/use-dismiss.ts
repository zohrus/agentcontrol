import { type RefObject, useEffect } from "react";

type Dismiss = {
  open: boolean;
  /** Presses inside this element do not dismiss. */
  inside: RefObject<HTMLElement | null>;
  onEscape: () => void;
  onOutsidePress: () => void;
};

/** While `open`: Escape, and a press outside of `inside`, dismiss it. */
export function useDismiss({ open, inside, onEscape, onOutsidePress }: Dismiss): void {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onEscape();
    };
    const onPress = (event: PointerEvent): void => {
      const { target } = event;
      if (target instanceof Node && !inside.current?.contains(target)) onOutsidePress();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [open, inside, onEscape, onOutsidePress]);
}
