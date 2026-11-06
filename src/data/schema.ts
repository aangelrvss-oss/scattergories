import type { FaqItem } from '../components/Faq.astro';

/** Datos estructurados de la aplicación web (schema.org). */
export function webApplication(site: URL, path: string, name: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: new URL(path, site).href,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Cualquiera (navegador web)',
    browserRequirements: 'Requiere JavaScript',
    inLanguage: 'es',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  };
}

export function faqPage(items: readonly FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
