import type { Request, Response, NextFunction } from "express";

/**
 * Barreiras contra acesso automatizado à API: limite de requisições por
 * endereço, recusa de robôs e ferramentas de script conhecidas, e bloqueio
 * temporário de quem procura páginas que este sistema não tem.
 * São barreiras de atrito: reduzem ataques comuns, não substituem senha forte.
 */

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 900; // o painel consulta o servidor a cada poucos segundos
const BLOCK_MS = 15 * 60 * 1000;

const hits = new Map<string, { count: number; resetAt: number }>();
const blocked = new Map<string, number>();

// Robôs de busca, coletores de dados para IA e bibliotecas de automação
const AUTOMATION = /(bot|crawler|spider|scrapy|python|curl|wget|httpclient|okhttp|go-http|java\/|libwww|aiohttp|httpx|axios|node-fetch|postman|insomnia|gptbot|claudebot|ccbot|bytespider|perplexity|headless|phantomjs|selenium|puppeteer|playwright)/i;

// Caminhos que só um programa de varredura pediria
const BAIT = /^\/(wp-|wordpress|xmlrpc|phpmyadmin|admin\.php|administrator|\.env|\.git|\.aws|config\.(php|json|yml)|backup|vendor\/|cgi-bin|shell|actuator|server-status)/i;

export function clientAddress(req: Request): string {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "desconhecido";
}

function sweep(now: number) {
  if (hits.size > 5000) for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key);
  if (blocked.size > 5000) for (const [key, until] of blocked) if (until <= now) blocked.delete(key);
}

export function apiGuard(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const address = clientAddress(req);
  const path = req.path || "";
  sweep(now);

  const blockedUntil = blocked.get(address) || 0;
  if (blockedUntil > now) {
    res.setHeader("Retry-After", String(Math.ceil((blockedUntil - now) / 1000)));
    return res.status(429).json({ error: "Muitas requisições. Tente novamente mais tarde." });
  }

  // Quem pede página-isca é varredura automática: resposta neutra e bloqueio temporário.
  if (BAIT.test(path) || BAIT.test(path.replace(/^\/api/, ""))) {
    blocked.set(address, now + BLOCK_MS);
    return res.status(404).json({ error: "Não encontrado." });
  }

  if (!path.startsWith("/api/")) return next();

  // A verificação de saúde fica livre para monitoramento.
  if (path !== "/api/health") {
    const agent = String(req.headers["user-agent"] || "");
    if (!agent || AUTOMATION.test(agent)) {
      return res.status(403).json({ error: "Acesso automatizado não permitido." });
    }
  }

  const entry = hits.get(address);
  if (!entry || entry.resetAt <= now) {
    hits.set(address, { count: 1, resetAt: now + WINDOW_MS });
  } else if (++entry.count > MAX_REQUESTS) {
    blocked.set(address, now + BLOCK_MS);
    res.setHeader("Retry-After", String(Math.ceil(BLOCK_MS / 1000)));
    return res.status(429).json({ error: "Muitas requisições. Tente novamente mais tarde." });
  }
  next();
}
