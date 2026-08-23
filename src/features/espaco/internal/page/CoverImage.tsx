// LM Notion — renderiza a capa da pagina. Aceita "gradient:<css>" ou URL de imagem.

interface CoverImageProps {
  cover: string
  position?: number
  className?: string
  style?: React.CSSProperties
}

export function isGradient(cover: string): boolean {
  return cover.startsWith('gradient:')
}

export function coverBackground(cover: string): string {
  return isGradient(cover) ? cover.slice('gradient:'.length) : `url("${cover}")`
}

export default function CoverImage({ cover, position = 50, className = '', style }: CoverImageProps) {
  const grad = isGradient(cover)
  return (
    <div
      className={`w-full bg-cover bg-no-repeat ${className}`}
      style={{
        backgroundImage: coverBackground(cover),
        backgroundPosition: grad ? undefined : `center ${position}%`,
        backgroundSize: grad ? 'cover' : 'cover',
        ...style,
      }}
    />
  )
}
