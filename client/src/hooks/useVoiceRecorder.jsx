/**
 * @file useVoiceRecorder.jsx
 * @description Custom React hook wrapping the browser MediaRecorder API for voice note recording.
 *
 * Handles microphone permission requests, audio capture in WebM format, duration
 * tracking, an automatic max-length safety timeout, and clean resource teardown
 * (stopping media tracks to release the microphone).
 *
 * The hook exposes three actions:
 *   - `startRecording()` -- requests mic access and begins recording
 *   - `stopRecording()` -- stops and returns a Blob + duration
 *   - `cancelRecording()` -- aborts without returning data
 */

import { useState, useRef, useCallback } from 'react';

/**
 * @typedef {Object} VoiceRecorderState
 * @property {boolean} isRecording - Whether recording is currently in progress.
 * @property {number} duration - Elapsed recording time in whole seconds.
 * @property {Function} startRecording - Begin recording; resolves to true on success, false on failure.
 * @property {Function} stopRecording - Stop and return { blob, duration }; resolves to null if inactive.
 * @property {Function} cancelRecording - Abort recording and discard all captured data.
 */

/**
 * Custom hook for recording voice notes using the MediaRecorder API.
 *
 * Captures audio as `audio/webm` and provides real-time duration updates.
 * A safety timeout automatically stops the recording after `maxSeconds` to
 * prevent excessively large files.
 *
 * @param {number} [maxSeconds=60] - Maximum recording duration in seconds before auto-stop.
 * @returns {VoiceRecorderState} Recording state and control functions.
 */
export function useVoiceRecorder(maxSeconds = 60) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  /** @type {React.MutableRefObject<MediaRecorder|null>} Active MediaRecorder instance */
  const mediaRecorderRef = useRef(null);
  /** @type {React.MutableRefObject<Blob[]>} Accumulated audio data chunks */
  const chunksRef = useRef([]);
  /** @type {React.MutableRefObject<number|null>} Timestamp (ms) when recording began */
  const startTimeRef = useRef(null);
  /** @type {React.MutableRefObject<number|null>} Interval ID for duration display updates */
  const intervalRef = useRef(null);
  /** @type {React.MutableRefObject<number|null>} Timeout ID for max-duration auto-stop */
  const maxTimerRef = useRef(null);

  /**
   * Requests microphone access and starts recording audio.
   *
   * Sets up the MediaRecorder with `audio/webm` MIME type, begins capturing
   * data chunks, starts a duration display interval (every 500ms), and arms
   * the max-duration safety timeout.
   *
   * @async
   * @returns {Promise<boolean>} True if recording started successfully, false if
   *   microphone access was denied or an error occurred.
   */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Collect audio data chunks as they become available
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      // Update the displayed duration every 500ms
      intervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);

      // Safety: auto-stop after maxSeconds to prevent huge recordings
      maxTimerRef.current = setTimeout(() => {
        stopRecording();
      }, maxSeconds * 1000);

      return true;
    } catch {
      // Microphone access denied or other error
      return false;
    }
  }, [maxSeconds]);

  /**
   * Stops the current recording and returns the captured audio.
   *
   * Clears all timers, waits for the MediaRecorder's `onstop` event to fire
   * (which is when the final data chunk is flushed), assembles the Blob from
   * all chunks, and releases the microphone by stopping all media tracks.
   *
   * @returns {Promise<{ blob: Blob, duration: number }|null>} The recorded audio
   *   blob and its duration in seconds, or null if no recording was active.
   */
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);

      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        setIsRecording(false);
        resolve(null);
        return;
      }

      // Capture final duration before the async onstop fires
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      mediaRecorder.onstop = () => {
        // Assemble all chunks into a single Blob
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Release the microphone by stopping all audio tracks
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        setDuration(0);
        resolve({ blob, duration: finalDuration });
      };

      mediaRecorder.stop();
    });
  }, []);

  /**
   * Aborts the current recording and discards all captured audio data.
   *
   * Unlike `stopRecording`, this does not return the recorded blob. It still
   * properly releases the microphone by stopping all media tracks.
   */
  const cancelRecording = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);

    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      // Release the microphone in the onstop handler
      mediaRecorder.onstop = () => {
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.stop();
    }
    chunksRef.current = [];
    setIsRecording(false);
    setDuration(0);
  }, []);

  return { isRecording, duration, startRecording, stopRecording, cancelRecording };
}
