/**
 * Security module for protecting application source code and runtime inspection in production.
 * Prevents F12, developer tools shortcuts, context menu inspection, and code sharing.
 */

export interface SecurityOptions {
  enableDevToolsBlock?: boolean;
  enableContextMenuBlock?: boolean;
  enableSourceViewBlock?: boolean;
  onViolation?: (action: string) => void;
}

let isInitialized = false;

export function initializeSecurityProtection(options: SecurityOptions = {}): () => void {
  if (typeof window === "undefined") return () => {};
  if (isInitialized) return () => {};
  isInitialized = true;

  const {
    enableDevToolsBlock = true,
    enableContextMenuBlock = true,
    enableSourceViewBlock = true,
    onViolation
  } = options;

  // Handler for keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // 1. F12 (DevTools)
    if (e.key === "F12" || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      notifyViolation("Atalho F12 (Ferramentas do Desenvolvedor) bloqueado por segurança.");
      return false;
    }

    // 2. Ctrl + Shift + I (Inspect) or Cmd + Option + I (Mac)
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      (e.key === "I" || e.key === "i" || e.keyCode === 73)
    ) {
      e.preventDefault();
      e.stopPropagation();
      notifyViolation("Inspeção de código bloqueada por segurança.");
      return false;
    }

    // 3. Ctrl + Shift + J (Console) or Cmd + Option + J (Mac)
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      (e.key === "J" || e.key === "j" || e.keyCode === 74)
    ) {
      e.preventDefault();
      e.stopPropagation();
      notifyViolation("Console de depuração bloqueado por segurança.");
      return false;
    }

    // 4. Ctrl + Shift + C (Inspect Element) or Cmd + Option + C (Mac)
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      (e.key === "C" || e.key === "c" || e.keyCode === 67)
    ) {
      e.preventDefault();
      e.stopPropagation();
      notifyViolation("Inspeção de elementos bloqueada por segurança.");
      return false;
    }

    // 5. Ctrl + U (View Source) or Cmd + Option + U (Mac)
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "U" || e.key === "u" || e.keyCode === 85)
    ) {
      e.preventDefault();
      e.stopPropagation();
      notifyViolation("Visualização de código-fonte bloqueada por segurança.");
      return false;
    }

    // 6. Ctrl + S (Save page)
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "S" || e.key === "s" || e.keyCode === 83)
    ) {
      e.preventDefault();
      e.stopPropagation();
      notifyViolation("Download e salvamento do código da página bloqueados.");
      return false;
    }
  };

  // Handler for context menu (Right click)
  const handleContextMenu = (e: MouseEvent) => {
    if (!enableContextMenuBlock) return;
    
    // Check if clicked element is an input or textarea (allow paste/cut for inputs if desired, or protect)
    const target = e.target as HTMLElement | null;
    const isInputField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
    
    if (!isInputField) {
      e.preventDefault();
      notifyViolation("Menu de contexto e inspeção bloqueados neste aplicativo.");
    }
  };

  function notifyViolation(message: string) {
    if (onViolation) {
      onViolation(message);
    }
    showSecurityToast(message);
  }

  // Attach global listeners
  if (enableDevToolsBlock || enableSourceViewBlock) {
    window.addEventListener("keydown", handleKeyDown, true);
  }
  if (enableContextMenuBlock) {
    window.addEventListener("contextmenu", handleContextMenu, true);
  }

  // Security warning in console if devtools is opened externally
  try {
    const bannerStyle = "color: #e11d48; font-size: 16px; font-weight: bold; background: #fff1f2; padding: 8px 14px; border-radius: 6px; border: 1px solid #fecdd3;";
    console.log("%c[SEGURANÇA ATIVA] Este sistema de Gestão de Franquias é protegido. A engenharia reversa e cópia de código são proibidas.", bannerStyle);
  } catch (_) {}

  // Cleanup function
  return () => {
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("contextmenu", handleContextMenu, true);
    isInitialized = false;
  };
}

let toastTimeout: any = null;

function showSecurityToast(message: string) {
  if (typeof document === "undefined") return;

  let toast = document.getElementById("security-protection-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "security-protection-toast";
    toast.className = "fixed bottom-5 right-5 z-[99999] flex items-center gap-3 px-4 py-3 rounded-xl bg-[#152238] text-white shadow-2xl border border-[#334155] text-xs font-semibold max-w-md transition-all duration-300 transform translate-y-0";
    toast.innerHTML = `
      <div class="h-7 w-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-3.5a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </div>
      <div class="flex-1">
        <div class="font-bold text-white flex items-center gap-1.5">
          <span>Ambiente Protegido</span>
          <span class="text-[10px] bg-rose-500/30 text-rose-300 px-1.5 py-0.5 rounded font-mono">F12 Bloqueado</span>
        </div>
        <div class="text-[11px] text-slate-300 mt-0.5" id="security-toast-message">${message}</div>
      </div>
    `;
    document.body.appendChild(toast);
  } else {
    const msgEl = document.getElementById("security-toast-message");
    if (msgEl) msgEl.innerText = message;
    toast.style.display = "flex";
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    if (toast) {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => {
        if (toast) toast.style.display = "none";
      }, 300);
    }
  }, 3500);
}
