# Normalizing Flows

Code accompanying [mariogemoll.com/normalizing-flows](https://mariogemoll.com/normalizing-flows).

A normalizing flow trained on the two-moons dataset, with interactive browser visualizations that
show the change-of-variables principle, the individual flow layers, training, and sample generation.

## Layout

- `py/` — PyTorch reference implementation and training notebook
  ([`normalizing-flows.ipynb`](py/normalizing-flows.ipynb)).
- `ts/` — TypeScript / TensorFlow.js port that powers the interactive widgets on the page. Entry
  point: `ts/src/page.ts`, bundled to `ts/dist/page.js` via esbuild. Trained weights live in
  `ts/model.json` / `ts/model.weights.bin`.
- `sh/checkpy.sh` — lint the Python code with ruff and verify the notebook.

## Python

```sh
cd py
uv sync
uv run jupyter lab normalizing-flows.ipynb
```

## TypeScript

```sh
cd ts
npm install
npm run build
```

Then open `ts/page.html` in a browser (WebGPU-capable recommended).
