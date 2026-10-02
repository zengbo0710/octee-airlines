import { useState } from "react";
import { Link, useLocation } from "react-router";
import type { User } from "../types";

interface SiteHeaderProps {
  user: User | null;
  onOpenAccount: () => void;
  onLogout: () => void;
}

const navigation = [
  ["Destinations", "/destinations"],
  ["Book", "/book"],
  ["Flight status", "/status"],
  ["Reviews", "/reviews"],
] as const;

export function SiteHeader({ user, onOpenAccount, onLogout }: SiteHeaderProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <Link className="brand flex items-center" to="/" aria-label="Octee Airlines home" onClick={() => setMenuOpen(false)}>
        <span className="brand-mark">o</span>
        <span>octee<small>Airlines</small></span>
      </Link>
      <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen((open) => !open)}>Menu</button>
      <nav className="desktop-nav" aria-label="Main navigation">
        {navigation.map(([label, route]) => (
          <Link key={route} to={route} aria-current={location.pathname === route ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      <div className="account-tools">
        <span id="account-summary">{user ? `${user.username} · ${user.octmiles_balance.toLocaleString()} Octmiles` : "Guest passenger"}</span>
        {user ? (
          <>
            <Link className="button button-small" to="/account">My account</Link>
            <button className="button button-small button-quiet" type="button" onClick={onLogout}>Log out</button>
          </>
        ) : (
          <button className="button button-small" type="button" onClick={onOpenAccount}>Log in</button>
        )}
      </div>
      <nav id="mobile-nav" className={`mobile-nav${menuOpen ? " open" : ""}`} aria-label="Mobile navigation">
        {navigation.map(([label, route]) => <Link key={route} to={route} onClick={() => setMenuOpen(false)}>{label}</Link>)}
      </nav>
    </header>
  );
}
