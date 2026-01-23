'use client';

import React from 'react';

interface ProfileContentProps {
  children: React.ReactNode;
}

export default function ProfileContent({ children }: ProfileContentProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar - Empty */}
      <div className="w-60 border-r flex flex-col px-4" />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
