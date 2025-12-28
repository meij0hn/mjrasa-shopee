'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
    isConnected: boolean;
}

interface NavItem {
    href: string;
    icon: string;
    label: string;
}

const navItems: NavItem[] = [
    { href: '/', icon: '📊', label: 'Dashboard' },
    { href: '/products', icon: '📦', label: 'Products' },
    { href: '/orders', icon: '🛍️', label: 'Orders' },
];

export default function Sidebar({ isConnected }: SidebarProps) {
    const pathname = usePathname();

    if (!isConnected) {
        return null;
    }

    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="sidebar-icon">{item.icon}</span>
                            <span className="sidebar-label">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
