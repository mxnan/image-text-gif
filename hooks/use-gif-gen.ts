/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useCallback } from "react";
import { toast } from "sonner";

import { TextSet } from "@/types/text";
import {
  AnimationConfig,
  EASING_FUNCTIONS,
  ANIMATION_REGISTRY,
} from "@/registry/anim-reg";

interface GifOptions {
  images: string[];
  textData: TextSet[];
  previewWidth: number;
  previewHeight: number;
}

export function useGifGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedGif, setGeneratedGif] = useState<string | null>(null);

  const calculateAnimationProgress = (
    frameIndex: number,
    totalFrames: number,
    config: AnimationConfig
  ) => {
    const progress = frameIndex / totalFrames;
    const easingFunction = EASING_FUNCTIONS[config.easing];
    return easingFunction(progress);
  };

  const generateGif = useCallback(async (options: GifOptions) => {
    setIsGenerating(true);

    try {
      // Load base image at full resolution
      const baseImage = await new Promise<HTMLImageElement>(
        (resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = options.images[0];
        }
      );

      // Create temporary canvas to get image data
      const canvas = document.createElement("canvas");
      canvas.width = baseImage.naturalWidth;
      canvas.height = baseImage.naturalHeight;

      const ctx = canvas.getContext("2d", {
        willReadFrequently: true,
      });
      if (!ctx) throw new Error("Failed to get canvas context");

      // Draw base image to get its data
      ctx.drawImage(baseImage, 0, 0);
      
      // Convert the image to a blob first
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png', 1.0);
      });
      
      // Convert blob to array buffer
      const imageBuffer = await blob.arrayBuffer();

      // Create a new worker instance
      const worker = new Worker(
        new URL("../utils/gif-worker.ts", import.meta.url)
      );

      const gifBlob = await new Promise<Blob>((resolve, reject) => {
        worker.onmessage = (event) => {
          const { type, data, error } = event.data;
          if (type === "error") {
            reject(new Error(error));
            return;
          }
          resolve(data);
        };

        worker.onerror = (error) => {
          reject(new Error(error.message));
        };

        // Calculate scale factor for text
        const scaleFactor = baseImage.naturalWidth / options.previewWidth;

        // Send data to worker
        worker.postMessage(
          {
            type: "generate",
            width: canvas.width,
            height: canvas.height,
            imageData: imageBuffer,
            animationConfig: {
              duration: 2, // 2 seconds animation
              fps: 30, // 30 frames per second
              textData: options.textData.map((text) => ({
                ...text,
                fontSize: Math.round(text.fontSize * scaleFactor),
                left: canvas.width * (text.left / 100),
                top: canvas.height * (text.top / 100),
              })),
            },
            options: {
              maxColors: 256,
              quality: 10,
              dither: false,
            },
          },
          [imageBuffer]
        );
      });

      // Clean up
      worker.terminate();

      const gifUrl = URL.createObjectURL(gifBlob);
      setGeneratedGif(gifUrl);
      return gifUrl;
    } catch (error) {
      console.error("GIF generation error:", error);
      toast.error("Failed to generate GIF");
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generateGif, isGenerating, generatedGif, setGeneratedGif };
}
