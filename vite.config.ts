import { defineConfig, Plugin } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dev-only middleware so the map editor can write straight back to
// data/maps/<id>.yaml. Local-only; not registered in production builds.
function mapSavePlugin(): Plugin {
  return {
    name: "map-save",
    configureServer(server) {
      server.middlewares.use("/api/save-map", (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const { id, yaml } = JSON.parse(body) as { id: string; yaml: string };
            if (!/^[a-z0-9_-]+$/i.test(id)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid map id" }));
              return;
            }
            const target = resolve(__dirname, "data/maps", `${id}.yaml`);
            fs.mkdirSync(dirname(target), { recursive: true });
            fs.writeFileSync(target, yaml, "utf8");
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, path: target }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: (e as Error).message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [mapSavePlugin()],
  server: { port: 5173, host: "127.0.0.1" },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        editor: resolve(__dirname, "editor.html"),
      },
    },
  },
  assetsInclude: ["**/*.yaml"],
});
