'use client';

import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '../components/Sidebar';

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />
        <div className="flex-1 lg:ml-64">
          {/* Mobile top bar with menu toggle */}
          <div className="lg:hidden flex items-center p-4 border-b border-gray-200 bg-white">
            <button
              onClick={() => setIsOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="ml-3 font-bold">PLCAutoPilot</span>
          </div>
          {children}
        </div>
      </div>
    </SessionProvider>
  );
}
