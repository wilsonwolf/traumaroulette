/**
 * @file useTimer.jsx
 * @description Client-side countdown timer hook.
 *
 * Provides a countdown timer that calculates remaining time from a server-
 * provided end timestamp. The timer updates every 250ms for smooth display
 * and exposes warning (<=30s) and expired (<=0s) states.
 *
 * Designed to be driven by the server's `timer-start` socket event, which
 * provides an absolute `endTime` so all clients count down to the same moment
 * regardless of network latency.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * @typedef {Object} TimerState
 * @property {number|null} secondsLeft - Seconds remaining, or null when no timer is active.
 * @property {boolean} isWarning - True when 30 seconds or fewer remain.
 * @property {boolean} isExpired - True when the countdown has reached zero.
 * @property {Function} startTimer - Start counting down to the given end time.
 * @property {Function} stopTimer - Stop the timer and reset all state.
 */

/**
 * Custom hook providing a countdown timer with warning and expiration states.
 *
 * Uses `setInterval` at 250ms for smoother visual updates (more frequent than
 * once per second). The countdown is based on an absolute end timestamp rather
 * than a relative duration, ensuring accuracy across network delays.
 *
 * @returns {TimerState} Timer state and control functions.
 */
export function useTimer() {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [isWarning, setIsWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  /** @type {React.MutableRefObject<number|null>} Absolute end timestamp in ms */
  const endTimeRef = useRef(null);
  /** @type {React.MutableRefObject<number|null>} Interval ID for cleanup */
  const intervalRef = useRef(null);

  /**
   * Starts the countdown timer targeting the given end time.
   *
   * Any previously running timer is cleared before starting. The interval
   * runs every 250ms for smooth UI updates. When the remaining time drops
   * to 30s the warning flag is set; at 0s the timer self-stops and marks
   * itself as expired.
   *
   * @param {string|number|Date} endTime - The absolute time when the timer expires.
   *   Accepts anything parsable by `new Date()`.
   */
  const startTimer = useCallback((endTime) => {
    endTimeRef.current = new Date(endTime).getTime();
    setIsExpired(false);
    setIsWarning(false);

    // Clear any existing interval before starting a new one
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Update every 250ms for smooth countdown display
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      // Ceil so the display shows "1" for the last partial second rather than "0"
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      setSecondsLeft(remaining);

      // Activate warning state in the final 30 seconds
      if (remaining <= 30 && remaining > 0) {
        setIsWarning(true);
      }
      // Auto-stop when time runs out
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsExpired(true);
      }
    }, 250);
  }, []);

  /**
   * Stops the timer and resets all state back to initial values.
   * Safe to call even when no timer is running.
   */
  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSecondsLeft(null);
    setIsWarning(false);
    setIsExpired(false);
  }, []);

  // Cleanup: clear the interval when the component unmounts
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { secondsLeft, isWarning, isExpired, startTimer, stopTimer };
}
