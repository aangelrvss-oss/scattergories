/** Texto que se copia al portapapeles para compartir la ronda. */
export function formatRoundText(letter: string | null, categories: readonly string[], round?: number): string {
  const lines: string[] = [];
  if (round && round > 0) lines.push(`Ronda ${round}`);
  if (letter) lines.push(`Letra: ${letter}`);
  if (categories.length > 0) {
    if (lines.length > 0) lines.push('');
    categories.forEach((category, i) => lines.push(`${i + 1}. ${category}`));
  }
  return lines.join('\n');
}

/** Copia texto usando la API moderna y, si falla, un textarea temporal. */
export async function copyText(text: string, doc: Document = document): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* probamos el método clásico */
  }
  try {
    const textarea = doc.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    doc.body.appendChild(textarea);
    textarea.select();
    const ok = doc.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
