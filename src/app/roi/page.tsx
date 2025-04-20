'use client';

import ROITable from '../components/ROITable';
import { useTuro } from '../lib/contexts/TuroContext';
import ROIGraph from '../components/ROIGraph';
import ROISummary from '../components/ROISummary';

export default function ROIPage() {
  const { cars } = useTuro();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Return on Investment Analysis</h1>
        <p className="text-gray-600">
          Track the complete lifecycle and ROI of your {cars.length} vehicle{cars.length !== 1 ? 's' : ''}.
        </p>
      </div>

      <div className="grid gap-8">
        <ROISummary />
        <ROIGraph />
        <ROITable />
      </div>
    </main>
  );
} 