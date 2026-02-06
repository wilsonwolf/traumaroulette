import { useState, useRef, useCallback } from 'react';

export function useVoiceRecorder(maxSeconds = 60) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(null);
  const intervalRef = useRef(null);
  const maxTimerRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      intervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);

      maxTimerRef.current = setTimeout(() => {
        stopRecording();
      }, maxSeconds * 1000);

      return true;
    } catch {
      return false;
    }
  }, [maxSeconds]);

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

      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        setDuration(0);
        resolve({ blob, duration: finalDuration });
      };

      mediaRecorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);

    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
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
