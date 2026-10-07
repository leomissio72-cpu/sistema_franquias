import app from "./src/serverBackend.ts";
import path from "path";
import express from "express";

function resolvePort(): number {
  const portArgIndex = process.argv.findIndex((arg) => arg === "--port" || arg === "-p");
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = Number(process.argv[portArgIndex + 1]);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.APP_PORT) {
    return Number(process.env.APP_PORT);
  }
  // Nginx owns port 8080 in the AI Studio container; app server must run on 3000
  if (process.env.PORT && process.env.PORT !== "8080") {
    return Number(process.env.PORT);
  }
  return 3000;
}

const PORT = resolvePort();

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Gestão de Franquias Server] Running on http://0.0.0.0:${PORT}`);
  });

  server.on("error", (err: any) => {
    console.error("[Gestão de Franquias Server] Server error:", err);
    if (err.code === "EADDRINUSE") {
      process.exit(1);
    }
  });
}

startServer().catch((err) => {
  console.error("[Gestão de Franquias Server] Failed to start:", err);
});

export default app;
