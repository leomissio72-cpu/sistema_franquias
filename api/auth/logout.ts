import { clearSessionCookies, isTrustedRequest, json } from "../_store";

export default function handler(req: any, res: any) {
  if (req.method !== "POST" && req.method !== "DELETE" && req.method !== "OPTIONS") {
    return json(res, 405, { error: "Método não permitido." });
  }
  if (!isTrustedRequest(req)) return json(res, 403, { error: "Origem não autorizada." });
  res.setHeader("Set-Cookie", clearSessionCookies());
  return json(res, 200, { success: true });
}
