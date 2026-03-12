import {useCallback, useEffect, useRef, useState} from 'react';

type CameraStatus =
  | {state: 'idle'}
  | {state: 'requesting'}
  | {state: 'active'}
  | {state: 'blocked'; message: string};

type UseUserCameraResult = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  start: () => Promise<void>;
  stop: () => void;
};

export default function useUserCamera(): UseUserCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>({state: 'idle'});

  const stop = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }

    setStatus({state: 'idle'});
  }, []);

  const start = useCallback(async () => {
    setStatus({state: 'requesting'});

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: 'user'},
        audio: false
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      setStatus({state: 'active'});
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : 'Camera permission was denied or no camera is available.';
      setStatus({state: 'blocked', message});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setStatus({state: 'requesting'});

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {facingMode: 'user'},
          audio: false
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        setStatus({state: 'active'});
      } catch (e) {
        if (cancelled) return;
        const message =
          e instanceof Error
            ? e.message
            : 'Camera permission was denied or no camera is available.';
        setStatus({state: 'blocked', message});
      }
    };

    void run();

    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  return {videoRef, status, start, stop};
}
