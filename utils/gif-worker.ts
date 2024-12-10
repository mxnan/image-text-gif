/* eslint-disable @typescript-eslint/no-explicit-any */
import { encode } from 'modern-gif';

// Define worker context and types
const ctx: Worker = self as any;

interface WorkerMessage {
  type: 'generate';
  width: number;
  height: number;
  imageData: ArrayBuffer;
  animationConfig: {
    duration: number;
    fps: number;
    textData: Array<{
      text: string;
      fontSize: number;
      left: number;
      top: number;
      color: string;
      fontFamily: string;
      fontWeight: string | number;
      opacity: number;
      rotation: number;
      zIndex: number;
    }>;
  };
  options?: Record<string, any>;
}

interface Frame {
  data: Uint8ClampedArray;
  delay: number;
}

// Helper function to create and setup canvas
const createCanvas = (width: number, height: number) => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { 
    alpha: true,
    willReadFrequently: true 
  });
  if (!context) throw new Error('Failed to get canvas context');
  return { canvas, context };
};

// Generate frames for the animation
async function generateFrames(
  width: number,
  height: number,
  imageData: ArrayBuffer,
  config: WorkerMessage['animationConfig']
): Promise<Frame[]> {
  const {  context } = createCanvas(width, height);
  const frames: Frame[] = [];
  const frameCount = Math.ceil(config.duration * config.fps);
  const frameDelay = Math.floor(1000 / config.fps);

  // Create ImageBitmap from the image data
  const blob = new Blob([imageData], { type: 'image/png' });
  const image = await createImageBitmap(blob);

  // Generate each frame
  for (let i = 0; i < frameCount; i++) {
    const progress = i / frameCount;
    
    // Clear canvas
    context.clearRect(0, 0, width, height);
    
    // Draw base image
    context.drawImage(image, 0, 0);
    
    // Draw text elements
    config.textData.forEach((textItem) => {
      context.save();
      
      context.font = `${textItem.fontWeight} ${textItem.fontSize}px ${textItem.fontFamily}`;
      context.fillStyle = textItem.color;
      context.globalAlpha = textItem.opacity * progress;
      
      // Apply transformations
      context.translate(textItem.left, textItem.top);
      context.rotate((textItem.rotation * Math.PI) / 180);
      
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(textItem.text, 0, 0);
      
      context.restore();
    });

    // Get frame data
    const frameData = context.getImageData(0, 0, width, height);
    frames.push({
      data: frameData.data,
      delay: frameDelay
    });
  }

  // Cleanup
  image.close();

  return frames;
}

// Handle messages from main thread
ctx.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  try {
    const { width, height, imageData, animationConfig, options = {} } = event.data;

    // Generate animation frames
    const frames = await generateFrames(
      width,
      height,
      imageData,
      animationConfig
    );

    // Encode frames to GIF
    const output = await encode({
      width,
      height,
      frames,
      format: 'blob',
      ...options
    });

    // Send encoded GIF back to main thread
    ctx.postMessage({ type: 'success', data: output });
  } catch (error) {
    ctx.postMessage({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export {};