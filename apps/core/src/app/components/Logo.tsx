interface LogoProps {
  className?: string;
}

export function Logo({ className = '' }: LogoProps) {
  return (
    <h1
      className={`text-2xl md:text-3xl font-bold text-glow ${className}`}
      style={{ color: 'var(--accent)' }}
    >
      dead-drop.xyz
    </h1>
  );
}
