import { loadAllGameData } from "../data/loader";
import { MapEditor } from "./MapEditor";

async function boot() {
  const status = document.getElementById("status");
  try {
    if (status) status.textContent = "Loading game data...";
    const data = await loadAllGameData();
    const canvas = document.getElementById("board") as HTMLCanvasElement;
    new MapEditor(canvas, data);
  } catch (err) {
    console.error(err);
    if (status) {
      status.textContent = `Failed to load: ${(err as Error).message}`;
      status.style.color = "#ffb4a8";
    }
  }
}

boot();
