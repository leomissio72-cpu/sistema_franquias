export function repairMojibake(value: string): string {
  const text = String(value ?? "");
  if (!/(?:Ã|Â|â|�)/.test(text)) return text;
  try {
    const bytes = Uint8Array.from(Array.from(text), (char) => char.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const markerCount = (input: string) => (input.match(/(?:Ã|Â|â|�)/g) || []).length;
    return markerCount(repaired) < markerCount(text) ? repaired : text;
  } catch {
    return text;
  }
}

export function decodeBankText(bytes: Uint8Array, headerSample = ""): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.slice(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.slice(2));
  }
  if (/CHARSET\s*:\s*1252|ENCODING\s*:\s*USASCII/i.test(headerSample)) {
    try {
      return new TextDecoder("windows-1252").decode(bytes);
    } catch {
      // Browser runtimes without the optional decoder continue with UTF-8.
    }
  }
  try {
    return repairMojibake(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    // ISO-8859-1 and Windows-1252 have the same practical fallback for bank text;
    // Windows-1252 also decodes the common Brazilian punctuation correctly.
    return repairMojibake(new TextDecoder("windows-1252").decode(bytes));
  }
}
