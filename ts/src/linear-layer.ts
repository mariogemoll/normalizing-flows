import { createSlider } from './slider';
import type { Transformation } from './transformation';

/**
 * Initializes a linear layer: y = scale * x + shift
 * Sets up the editor UI in the container and returns the transformation
 */
export function initLinearLayer(
  container: HTMLElement,
  onChange: () => void,
  initialScale = 1.0,
  initialShift = 0.0
): Transformation {
  let scale = initialScale;
  let shift = initialShift;

  // Set up the editor UI
  const scaleSlider = createSlider('scale', -0.5, 2.5, scale, 0.03);
  const shiftSlider = createSlider('shift', -1.5, 1.5, shift, 0.03);

  container.appendChild(scaleSlider.container);
  container.appendChild(shiftSlider.container);

  scaleSlider.slider.addEventListener('input', () => {
    scale = parseFloat(scaleSlider.slider.value);
    onChange();
  });

  shiftSlider.slider.addEventListener('input', () => {
    shift = parseFloat(shiftSlider.slider.value);
    onChange();
  });

  // Return the transformation that uses the mutable state
  return {
    f: (x: number): number => scale * x + shift,
    df: (): number => scale,
    fInv: (y: number): number => (y - shift) / scale,
    dfInv: (): number => 1 / scale
  };
}
