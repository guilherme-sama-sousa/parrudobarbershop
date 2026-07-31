interface LogoProps {
  logoUrl?: string | null
  compact?: boolean
}

export function Logo({ logoUrl, compact = false }: LogoProps) {
  if (logoUrl) {
    return (
      <span className="brand-logo brand-logo-image">
        {/* A URL será substituída pela logo enviada pelo proprietário. */}
        <img src={logoUrl} alt="Parrudo Barbershop" />
      </span>
    )
  }

  return (
    <span className={`brand-logo ${compact ? 'brand-logo-compact' : ''}`}>
      <span className="brand-mark">P</span>
      <span>
        <strong>PARRUDO</strong>
        <small>BARBERSHOP</small>
      </span>
    </span>
  )
}
