import { json } from "../_store";

export default function handler(req: any, res: any) {
  if (req.method !== "POST" && req.method !== "DELETE" && req.method !== "OPTIONS") {
    return json(res, 405, { error: "Método não permitido." });
  }
  res.setHeader("Set-Cookie", "gestao_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return json(res, 200, { success: true });
}
