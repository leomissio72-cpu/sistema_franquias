export interface ApelidoRule {
  apelido: string;
  category: string;
  keywords: string[];
}

export const APELIDO_RULES: ApelidoRule[] = [
  {
    apelido: "Contas de Água",
    category: "Utilidades (Água, Luz, Net)",
    keywords: [
      "agua", "água", "sabesp", "saae", "sanepar", "copasa", "cedae", "casan",
      "deso", "corsan", "cagece", "embasa", "daae", "semae", "saneago", "dandep"
    ],
  },
  {
    apelido: "Energia Elétrica",
    category: "Utilidades (Água, Luz, Net)",
    keywords: [
      "enel", "luz", "energia", "light", "cemig", "copel", "cpfl", "neoenergia",
      "equatorial", "eletrobras", "celesc", "energisa", "elektro", "edp", "celpe", "coelba"
    ],
  },
  {
    apelido: "Aluguel & Condomínio",
    category: "Aluguel e Condomínio",
    keywords: [
      "aluguel", "locacao", "locação", "imobiliaria", "imobiliária",
      "condominio", "condomínio", "quinto andar", "loft", "sindico", "síndico"
    ],
  },
  {
    apelido: "Internet & Telefone",
    category: "Utilidades (Água, Luz, Net)",
    keywords: [
      "vivo", "claro", "tim", "oi", "net", "fibra", "telecom", "telefonia",
      "internet", "algar", "algar telecom", "embratel", "brisanet"
    ],
  },
  {
    apelido: "Impostos & Tributos",
    category: "Impostos e Taxas",
    keywords: [
      "darf", "das", "gps", "fgts", "simples nacional", "inss", "iptu", "iss",
      "icms", "tributo", "receita federal", "pge", "taxa fiscal", "daj"
    ],
  },
  {
    apelido: "Sistemas & Software",
    category: "Sistemas e Tecnologia",
    keywords: [
      "google", "microsoft", "aws", "vindi", "stone", "totvs", "conta azul",
      "omie", "software", "sistema", "saas", "github", "chatgpt", "openai",
      "slack", "zoom", "hubspot", "rd station", "plugchat", "hostgator", "locaweb"
    ],
  },
  {
    apelido: "Folha & Salários",
    category: "Salários e Pró-labore",
    keywords: [
      "folha", "salario", "salário", "prolabore", "pro-labore", "rescisao",
      "rescisão", "pagamento funcionario", "holerite", "adiantamento salarial",
      "decimo terceiro", "13o salario"
    ],
  },
  {
    apelido: "Vale Transporte",
    category: "Vale Transporte",
    keywords: [
      "vt", "sptrans", "riocard", "passagem", "transporte", "valecard",
      "ticket transporte", "autopass", "cartao transporte", "fetranspor"
    ],
  },
  {
    apelido: "Tarifas Bancárias",
    category: "Tarifas Bancárias",
    keywords: [
      "tarifa", "manutenção conta", "pacote servicos", "anuidade", "taxa bancaria",
      "encargos", "juros sobre saldo", "tarifa pix", "cesta servicos"
    ],
  },
  {
    apelido: "Royalties & Taxa de Franquia",
    category: "Royalties e Taxas de Franquia",
    keywords: [
      "royalty", "royalties", "taxa franquia", "fundo propaganda", "fundo de marketing"
    ],
  },
];

export function detectApelido(desc: string, currentCategory?: string): { apelido: string; category: string } {
  const norm = String(desc || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const rule of APELIDO_RULES) {
    if (rule.keywords.some((kw) => norm.includes(kw))) {
      return { apelido: rule.apelido, category: rule.category };
    }
  }

  // Fallback: build nickname from category or clean words
  if (currentCategory && currentCategory !== "Outras Despesas" && currentCategory !== "Outros") {
    return { apelido: currentCategory, category: currentCategory };
  }

  const cleanWords = norm
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !["pagamento", "pix", "ted", "doc", "compra", "debito", "credito", "agencia", "conta", "transferencia", "envio"].includes(w)
    );

  if (cleanWords.length > 0) {
    const raw = cleanWords
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return { apelido: raw, category: currentCategory || "Outras Despesas" };
  }

  return { apelido: "Geral", category: currentCategory || "Outras Despesas" };
}
