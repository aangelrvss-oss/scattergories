type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};

export function isFullscreenSupported(doc: Document = document): boolean {
  const d = doc as FsDocument;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function getFullscreenElement(doc: Document = document): Element | null {
  const d = doc as FsDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/** Activa o desactiva la pantalla completa. Devuelve el nuevo estado. */
export async function toggleFullscreen(element: HTMLElement, doc: Document = document): Promise<boolean> {
  const d = doc as FsDocument;
  const el = element as FsElement;
  if (getFullscreenElement(doc)) {
    if (d.exitFullscreen) await d.exitFullscreen();
    else await d.webkitExitFullscreen?.();
    return false;
  }
  if (el.requestFullscreen) await el.requestFullscreen();
  else await el.webkitRequestFullscreen?.();
  return true;
}
