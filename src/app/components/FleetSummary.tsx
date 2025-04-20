'use client';

import { useTuro } from '../lib/contexts/TuroContext';

export default function FleetSummary() {
  const { getFleetStats } = useTuro();
  const stats = getFleetStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Revenue</h3>
        <p className="text-3xl font-bold text-green-600">${stats.totalRevenue.toFixed(2)}</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Expenses</h3>
        <p className="text-3xl font-bold text-red-600">${stats.totalExpenses.toFixed(2)}</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Profit</h3>
        <p className={`text-3xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          ${stats.profit.toFixed(2)}
        </p>
      </div>
    </div>
  );
} 