import app from "./src/serverBackend.ts";
import path from "path";
import express from "express";

const PORT = Number(process.env.PORT) || 3000;

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
  });
}

startServer().catch((err) => {
  console.error("[Gestão de Franquias Server] Failed to start:", err);
});

export default app;
