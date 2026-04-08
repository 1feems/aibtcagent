import { resolve } from "node:path";

export function getQuantumMapPrimaryDatasetUrl(): string {
  return process.env.AIBTC_QUANTUM_MAP_PRIMARY_URL ??
    "https://quantum-power-map.p-d07.workers.dev/data.json";
}

export function getQuantumMapFallbackDatasetUrl(): string {
  return process.env.AIBTC_QUANTUM_MAP_FALLBACK_URL ??
    "https://quantum-power-map.clank-ai-agent.workers.dev/data.json";
}

export function getQuantumMapLocalDatasetPath(baseDir?: string): string {
  if (process.env.AIBTC_QUANTUM_MAP_LOCAL_DATASET_PATH) {
    return process.env.AIBTC_QUANTUM_MAP_LOCAL_DATASET_PATH;
  }

  return resolve(baseDir ?? process.cwd(), "../quantum-visualizer/public/data.json");
}
