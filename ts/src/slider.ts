export interface SliderElements {
  container: HTMLDivElement;
  slider: HTMLInputElement;
  valueDisplay: HTMLSpanElement;
}

export function createSlider(
  label: string,
  min: number,
  max: number,
  value: number,
  step: number
): SliderElements {
  const container = document.createElement('div');
  container.className = 'slider-control';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '4px';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.style.minWidth = '12px';
  container.appendChild(labelEl);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min.toString();
  slider.max = max.toString();
  slider.step = step.toString();
  slider.style.width = '80px';
  slider.style.flexShrink = '0';
  // Ensure value snaps to nearest step
  const snappedValue = Math.round((value - min) / step) * step + min;
  slider.value = snappedValue.toString();
  container.appendChild(slider);

  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'value-display';
  valueDisplay.textContent = snappedValue.toFixed(2);
  valueDisplay.style.fontSize = '12px';
  valueDisplay.style.minWidth = '35px';
  container.appendChild(valueDisplay);

  return { container, slider, valueDisplay };
}
