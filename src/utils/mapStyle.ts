import L from "leaflet";

/** Fundo do mapa: OpenStreetMap, que não exige chave de acesso. */
export function addBaseLayer(map: L.Map): void {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Rótulo curto do pino: os dígitos do código ("LV-01" → "01") ou a inicial do nome. */
function markerLabel(unit: { code?: string; name?: string }): string {
  const digits = (unit.code || "").match(/\d+/g)?.pop();
  if (digits) return digits.slice(-2).padStart(2, "0");
  return (unit.name || "?").trim().charAt(0).toUpperCase();
}

/** Pino circular com o número da unidade; a cor indica a situação (saudável ou atenção). */
export function unitMarkerIcon(unit: { code?: string; name?: string; status?: string }): L.DivIcon {
  const healthy = unit.status === "green";
  return L.divIcon({
    className: "unit-pin-wrapper",
    html: `<div class="unit-pin ${healthy ? "unit-pin--ok" : "unit-pin--warn"}" title="${escapeHtml(unit.name)}"><span>${escapeHtml(markerLabel(unit))}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

interface PopupData {
  brand?: string;
  brandColor?: string;
  name: string;
  address?: string;
  rows: Array<{ label: string; value: string; tone?: "positive" | "negative" }>;
  actionLabel: string;
  onAction: () => void;
}

/** Conteúdo do balão da unidade, igual nas telas Início e Rede. */
export function unitPopup(data: PopupData): HTMLElement {
  const root = document.createElement("div");
  root.className = "unit-popup";
  root.innerHTML = `
    ${data.brand ? `<div class="unit-popup__brand" style="color:${escapeHtml(data.brandColor || "#3c63da")}">${escapeHtml(data.brand)}</div>` : ""}
    <div class="unit-popup__name">${escapeHtml(data.name)}</div>
    ${data.address ? `<div class="unit-popup__address">${escapeHtml(data.address)}</div>` : ""}
    <dl class="unit-popup__rows">
      ${data.rows
        .map(
          (row) =>
            `<div><dt>${escapeHtml(row.label)}</dt><dd class="${row.tone ? `is-${row.tone}` : ""}">${escapeHtml(row.value)}</dd></div>`,
        )
        .join("")}
    </dl>`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "unit-popup__action";
  button.innerText = data.actionLabel;
  button.onclick = data.onAction;
  root.appendChild(button);
  return root;
}
