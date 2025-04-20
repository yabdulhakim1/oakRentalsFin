'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  const linkClass = (path: string) => {
    return `px-4 py-2 rounded-lg transition-colors ${
      isActive(path)
        ? 'bg-indigo-100 text-indigo-700 font-medium'
        : 'text-gray-600 hover:bg-gray-100'
    }`;
  };

  return (
    <nav className="bg-white shadow">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-16">
          <div className="flex space-x-2">
            <Link href="/" className={linkClass('/')}>
              Dashboard
            </Link>
            <Link href="/roi" className={linkClass('/roi')}>
              ROI Analysis
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
} 