export default async function handler(req: any, res: any) {
  try {
    const module = await import("../src/serverBackend");
    return module.default(req, res);
  } catch (error) {
    console.error("Gestão de Franquias API initialization error", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const message = error instanceof Error ? error.message : String(error);
    res.end(JSON.stringify({ error: "Falha ao inicializar a API.", detail: message.slice(0, 240) }));
  }
}
