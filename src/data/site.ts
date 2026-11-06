export const SITE = {
  name: 'LetraLista',
  tagline: 'Generador de Scattergories en español',
  locale: 'es_ES',
  lang: 'es',
  themeColor: '#c7361a',
} as const;

export interface NavItem {
  href: string;
  label: string;
  /** Texto corto para el menú en móvil. */
  short: string;
}

export const NAV: readonly NavItem[] = [
  { href: '/', label: 'Generador', short: 'Jugar' },
  { href: '/generador-letras/', label: 'Letras al azar', short: 'Letras' },
  { href: '/categorias-stop/', label: 'Categorías para Stop', short: 'Categorías' },
  { href: '/tutti-frutti/', label: 'Tutti Frutti', short: 'Tutti Frutti' },
  { href: '/basta/', label: 'Basta', short: 'Basta' },
];
