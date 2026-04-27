import { useEffect, useRef, useState } from "react";

export default function useAnimatedPresence(isOpen, exitDelay = 220, onExitComplete = null) {
  const [isMounted, setIsMounted] = useState(Boolean(isOpen));
  const [phase, setPhase] = useState(isOpen ? "open" : "closed");
  const timerRef = useRef(null);
  const onExitCompleteRef = useRef(onExitComplete);

  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isOpen) {
      setIsMounted(true);
      setPhase("open");
      return undefined;
    }

    if (!isMounted) {
      setPhase("closed");
      return undefined;
    }

    setPhase("closing");
    timerRef.current = setTimeout(() => {
      setIsMounted(false);
      setPhase("closed");
      if (typeof onExitCompleteRef.current === "function") {
        onExitCompleteRef.current();
      }
      timerRef.current = null;
    }, exitDelay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [exitDelay, isMounted, isOpen]);

  return {
    isMounted,
    isOpen: isMounted && phase === "open",
    isClosing: phase === "closing",
    phase
  };
}
