'use client';

import Link from 'next/link';

interface NavbarProps {
    isConnected: boolean;
    onLogout?: () => void;
}

export default function Navbar({ isConnected, onLogout }: NavbarProps) {
    return (
        <nav className="navbar">
            <div className="container navbar-content">
                <Link href="/" className="logo">
                    <div className="logo-icon">🛒</div>
                    <span>Seller Hub</span>
                </Link>

                <div>
                    {isConnected ? (
                        <button onClick={onLogout} className="btn btn-danger">
                            🚪 Logout
                        </button>
                    ) : (
                        <Link href="/api/auth" className="btn btn-primary">
                            🔗 Connect Shopee
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
