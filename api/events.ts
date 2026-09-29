export default function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ sse: false, message: "SSE desativado no ambiente serverless; use atualização por consulta." });
}
