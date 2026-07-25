/**
 * Dados de contato/institucionais não existem hoje no schema da empresa
 * (backend não tem campos de telefone/endereço/horário). Até que isso seja
 * modelado no backend, ficam configuráveis por variável de ambiente do
 * frontend — nunca hardcoded como se fossem dados reais de uma empresa.
 */
export const SITE = {
  brand: 'AP Auto Prime',
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '',
  address: process.env.NEXT_PUBLIC_ADDRESS ?? '',
  businessHours: process.env.NEXT_PUBLIC_BUSINESS_HOURS ?? '',
  // Empresa exibida na home pública enquanto não existe um domínio/rota por
  // empresa — ver docs/audit.md e o backlog de multi-empresa.
  defaultCompanySlug: process.env.NEXT_PUBLIC_DEFAULT_COMPANY_SLUG ?? 'autoprime-demo',
};

export function whatsappHref(message: string): string | null {
  if (!SITE.whatsappNumber) return null;
  const digits = SITE.whatsappNumber.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
