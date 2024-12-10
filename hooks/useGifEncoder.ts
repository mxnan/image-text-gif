/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';

interface Frame {
  data: CanvasImageSource | BufferSource | string;
  delay?: number;
}

interface GifOptions {
  width: number;
  height: number;
  frames: Frame[];
  options?: Record<string, any>;
}

export const useGifEncoder = () => {
  const [isEncoding, setIsEncoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const encodeGif = useCallback(async ({ width, height, frames, options = {} }: GifOptions) => {
    try {
      setIsEncoding(true);
      setError(null);

      // Create a new worker instance
      const worker = new Worker(new URL('../utils/gifWorker.ts', import.meta.url));

      const result = await new Promise<Blob>((resolve, reject) => {
        worker.onmessage = (event) => {
          const { type, data, error } = event.data;
          
          if (type === 'error') {
            reject(new Error(error));
            return;
          }

          const blob = new Blob([data], { type: 'image/gif' });
          resolve(blob);
        };

        worker.onerror = (error) => {
          reject(new Error(error.message));
        };

        // Send data to worker
        worker.postMessage({
          frames,
          width,
          height,
          options
        });
      });

      // Clean up
      worker.terminate();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to encode GIF');
      throw err;
    } finally {
      setIsEncoding(false);
    }
  }, []);

  return {
    encodeGif,
    isEncoding,
    error
  };
}; 