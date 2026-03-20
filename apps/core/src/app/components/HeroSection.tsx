interface HeroSectionProps {
  className?: string;
}

export function HeroSection({ className = '' }: HeroSectionProps) {
  return (
    <div className={`text-center space-y-6 ${className}`}>
      <p className="text-sm md:text-base opacity-70 tracking-wide font-medium">
        dead simple secret sharing
      </p>
      <p className="text-xs md:text-sm opacity-40 leading-relaxed max-w-md mx-auto">
        Encrypted messages that self-destruct after 7 days.
        <br />
        Zero-knowledge means even we can&apos;t read them.
        <br />
        <span className="opacity-70">Just pick a name and share.</span>
      </p>
    </div>
  );
}
