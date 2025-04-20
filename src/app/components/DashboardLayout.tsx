'use client';

import FleetGraph from './FleetGraph';
import TuroSync from './TuroSync';

export default function DashboardLayout() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area - takes up 2/3 of the space on large screens */}
        <div className="lg:col-span-2">
          <FleetGraph />
        </div>
        
        {/* Sidebar area - takes up 1/3 of the space on large screens */}
        <div className="lg:col-span-1">
          <TuroSync />
        </div>
      </div>
    </div>
  );
} 