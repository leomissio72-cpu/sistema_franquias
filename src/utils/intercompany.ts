import type { ConciliationItem, IntercompanyRule, ManualEntry } from "../types";

export interface IntercompanyMatchContext {
  tenantId: string;
  businessId?: string;
}

export function normalizeIntercompanyText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function compact(value: unknown): string {
  return normalizeIntercompanyText(value).replace(/[^a-z0-9]/g, "");
}

function hasMatch(values: string[] | undefined, haystack: string, compactHaystack: string): boolean {
  return (values || []).some((value) => {
    const normalized = normalizeIntercompanyText(value);
    if (!normalized) return false;
    return haystack.includes(normalized) || compactHaystack.includes(compact(normalized));
  });
}

export function ruleMatchesItem(
  rule: IntercompanyRule,
  item: Pick<ConciliationItem, "desc" | "counterpartyDocument" | "sourceAccount" | "destinationAccount">,
  context: IntercompanyMatchContext,
): boolean {
  if (!rule.active) return false;
  if (rule.scope === "empresa" && (!rule.businessId || rule.businessId !== context.businessId)) return false;
  if (rule.scope === "unidade" && (!rule.tenantId || rule.tenantId !== context.tenantId)) return false;

  const values = [item.desc, item.counterpartyDocument, item.sourceAccount, item.destinationAccount];
  const haystack = normalizeIntercompanyText(values.filter(Boolean).join(" "));
  const compactHaystack = compact(haystack);
  return hasMatch(rule.terms, haystack, compactHaystack)
    || hasMatch(rule.counterpartyDocuments, haystack, compactHaystack)
    || hasMatch(rule.counterpartyAccounts, haystack, compactHaystack);
}

export function findIntercompanyRule(
  item: Pick<ConciliationItem, "desc" | "counterpartyDocument" | "sourceAccount" | "destinationAccount">,
  rules: IntercompanyRule[] = [],
  context: IntercompanyMatchContext,
): IntercompanyRule | undefined {
  return rules.find((rule) => ruleMatchesItem(rule, item, context));
}

export function classifyIntercompanyItem(
  item: ConciliationItem,
  rules: IntercompanyRule[] = [],
  context: IntercompanyMatchContext,
): ConciliationItem {
  const rule = findIntercompanyRule(item, rules, context);
  if (!rule) return item;
  return {
    ...item,
    isIntercompany: true,
    intercompanyRuleId: rule.id,
    intercompanyReason: `Regra "${rule.name}"`,
    categoria: "Transferência entre empresas",
    match: "Marcada para não entrar no DRE",
    label: "Intercompany",
    tone: "amber",
    toDre: false,
  };
}

export function isIntercompanyEntry(entry: Pick<ManualEntry, "isIntercompany" | "excludedFromDre" | "catId" | "catName">): boolean {
  return Boolean(
    entry.isIntercompany
    || entry.excludedFromDre
    || entry.catId === "intercompany"
    || normalizeIntercompanyText(entry.catName) === "transferencia entre empresas",
  );
}
