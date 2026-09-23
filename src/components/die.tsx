export function Die({ face, large = false }: { face: number; large?: boolean }) {
  const dots = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]][face] ?? [];
  return <span className={`die ${large ? 'die-large' : ''}`} role="img" aria-label={`Die showing ${face}`}><svg viewBox="0 0 30 30" aria-hidden="true">{dots.map(i => <circle key={i} cx={7 + (i % 3) * 8} cy={7 + Math.floor(i / 3) * 8} r="2.15" />)}</svg></span>;
}

