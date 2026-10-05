import { Link } from 'react-router-dom';

// Uses the institutionally approved ALU logo asset as-is (NFR04).
export default function Logo({ to = '/', className = 'h-8', showProduct = true, productClass = 'text-ink' }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="ALU Ventures home">
      <img src="/alu-logo.png" alt="African Leadership University" className={`${className} w-auto rounded-[3px]`} />
      {showProduct && (
        <span className={`hidden border-l border-current/20 pl-2.5 text-sm font-semibold tracking-tight sm:inline ${productClass}`}>
          Ventures
        </span>
      )}
    </Link>
  );
}
