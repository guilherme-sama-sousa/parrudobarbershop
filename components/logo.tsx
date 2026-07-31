interface LogoProps {
  logoUrl?: string | null
  compact?: boolean
}

export function Logo({ logoUrl, compact = false }: LogoProps) {
  return (
    <span className={`brand-logo brand-logo-image ${compact ? 'brand-logo-compact' : ''}`}>
      {/* Usa a logo oficial; o painel (Configurações > URL da logo) pode substituir. */}
      <img src={logoUrl || '/logo.png'} alt="Parrudo Barbershop" />
    </span>
  )
}
