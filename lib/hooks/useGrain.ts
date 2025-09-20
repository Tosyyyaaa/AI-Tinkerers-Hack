import { useEffect, useRef } from 'react';

/**
 * Custom hook that generates static noise texture on a canvas element
 * for neo-futuristic matte grain effect
 */
export const useGrain = (
  opacity: number = 0.08,
  density: number = 0.5,
  size: number = 2
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for grain texture
    const width = 400;
    const height = 400;
    canvas.width = width;
    canvas.height = height;

    // Generate static noise pattern
    const generateGrain = () => {
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        if (Math.random() < density) {
          // Create grain pixel
          const intensity = Math.random() * 255;
          data[i] = intensity;     // Red
          data[i + 1] = intensity; // Green  
          data[i + 2] = intensity; // Blue
          data[i + 3] = opacity * 255; // Alpha
        } else {
          // Transparent pixel
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    generateGrain();
  }, [opacity, density, size]);

  return canvasRef;
};
