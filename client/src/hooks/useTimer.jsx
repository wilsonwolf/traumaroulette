import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer() {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [isWarning, setIsWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const endTimeRef = useRef(null);
  const intervalRef = useRef(null);

  const startTimer = useCallback((endTime) => {
    endTimeRef.current = new Date(endTime).getTime();
    setIsExpired(false);
    setIsWarning(false);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 30 && remaining > 0) {
        setIsWarning(true);
      }
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsExpired(true);
      }
    }, 250);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSecondsLeft(null);
    setIsWarning(false);
    setIsExpired(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { secondsLeft, isWarning, isExpired, startTimer, stopTimer };
}
