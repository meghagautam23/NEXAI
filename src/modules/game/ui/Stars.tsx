export function Stars({ n, small, animate }: { n: number; small?: boolean; animate?: boolean }) {
  return (
    <span className={`stars${small ? ' small' : ''}${animate ? ' animate' : ''}`} aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map(i => (
        <svg key={i} viewBox="0 0 24 24" className={i < n ? 'on' : 'off'} style={{ animationDelay: `${0.25 + i * 0.3}s` }}>
          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
        </svg>
      ))}
    </span>
  );
}
