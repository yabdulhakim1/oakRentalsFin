'use client';

import { useTuro } from '../lib/contexts/TuroContext';

export default function TimeFilter() {
  const { timeRange, setSelectedYear } = useTuro();

  // Years array
  const years = [
    { value: 0, label: 'All Years' },
    { value: 2024, label: '2024' },
    { value: 2025, label: '2025' },
    { value: 2026, label: '2026' }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col space-y-2 w-full">
          <h3 className="text-lg font-semibold text-gray-700">Select Year</h3>
          <div className="flex flex-wrap gap-2">
            {years.map((year) => (
              <button
                key={year.value}
                onClick={() => setSelectedYear(year.value)}
                className={`
                  px-4 py-2 rounded-md font-medium text-sm transition-all
                  ${timeRange.selectedYear === year.value
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {year.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 