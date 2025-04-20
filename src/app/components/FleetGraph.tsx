'use client';

import { useTuro } from '../lib/contexts/TuroContext';
import { useEffect, useMemo } from 'react';

export default function FleetGraph() {
  const { getMonthlyStats, selectedCars, timeRange, transactions } = useTuro();
  const monthlyData = getMonthlyStats();

  // Debug logs
  useEffect(() => {
    console.log('FleetGraph Debug:', {
      selectedCars,
      selectedYear: timeRange.selectedYear,
      totalTransactions: transactions.length,
      monthlyData,
      sampleTransactions: transactions.slice(0, 2)
    });

    // Log transactions for the selected year
    const yearTransactions = transactions.filter(t => {
      const year = new Date(t.date).getFullYear();
      const isSelectedYear = year === timeRange.selectedYear;
      const isSelectedCar = selectedCars.includes(t.carId);
      return isSelectedYear && isSelectedCar;
    });

    console.log('Transactions for selected year:', {
      year: timeRange.selectedYear,
      count: yearTransactions.length,
      transactions: yearTransactions.slice(0, 2)
    });
  }, [transactions, selectedCars, timeRange, monthlyData]);

  // Calculate max value for graph scaling
  const maxValue = useMemo(() => {
    const max = Math.max(
      ...monthlyData.map(data => Math.max(data.totalRevenue, data.totalExpenses, Math.abs(data.profit)))
    );
    // Round up to nearest 1000 and add some padding
    return Math.ceil(max / 1000) * 1000 + 1000;
  }, [monthlyData]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Helper function to calculate bar height
  const getBarHeight = (value: number) => {
    if (value <= 0) return 0;
    // Use 350px as the maximum height for better scaling
    return (value / maxValue) * 350;
  };

  // If no data, show message
  if (monthlyData.every(data => data.totalRevenue === 0 && data.totalExpenses === 0)) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow">
        <p className="text-gray-500">
          No data found for {timeRange.selectedYear}. Make sure you have:
          <ul className="list-disc list-inside mt-2">
            <li>Selected at least one car ({selectedCars.length} cars selected)</li>
            <li>Transactions in {timeRange.selectedYear}</li>
          </ul>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="h-[400px] relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 w-20 flex flex-col justify-between text-xs text-gray-600">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="text-right pr-2">
              ${((5 - i) * maxValue / 5).toLocaleString()}
            </div>
          ))}
        </div>

        {/* Graph area */}
        <div className="absolute left-20 top-0 right-4 bottom-8 border-l border-b border-gray-200">
          {/* Grid lines */}
          <div className="absolute inset-0">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-full border-t border-gray-100"
                style={{ bottom: `${(i * 20)}%` }}
              />
            ))}
          </div>

          <div className="relative w-full h-full flex items-end">
            {monthlyData.map((data, i) => (
              <div key={i} className="relative flex-1 h-full flex flex-col justify-end items-center group">
                {/* Grid line */}
                <div className="absolute inset-0 border-r border-gray-100" />
                
                <div className="relative w-full flex justify-center items-end space-x-1">
                  {/* Revenue bar with tooltip */}
                  <div className="w-4 relative group">
                    <div
                      className="w-full bg-green-500 transition-all duration-200 hover:w-5"
                      style={{
                        height: `${getBarHeight(data.totalRevenue)}px`,
                        minHeight: data.totalRevenue > 0 ? '2px' : '0'
                      }}
                    />
                    {/* Revenue tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-black/90 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none shadow-lg backdrop-blur-sm border border-white/10 transition-opacity z-50">
                      Revenue: ${data.totalRevenue.toLocaleString()}
                    </div>
                  </div>

                  {/* Profit and Expenses stack */}
                  <div className="w-4 relative">
                    {/* Expenses bar with tooltip */}
                    <div className="relative group">
                      <div
                        className="w-full bg-red-500 transition-all duration-200 hover:w-5"
                        style={{
                          height: `${getBarHeight(data.totalExpenses)}px`,
                          minHeight: data.totalExpenses > 0 ? '2px' : '0',
                          display: data.totalExpenses > 0 ? 'block' : 'none'
                        }}
                      />
                      {/* Expenses tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 absolute left-full top-0 ml-2 bg-black/90 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none shadow-lg backdrop-blur-sm border border-white/10 transition-opacity z-50">
                        Expenses: ${data.totalExpenses.toLocaleString()}
                      </div>
                    </div>
                    
                    {/* Profit bar with tooltip */}
                    <div className="relative group">
                      <div
                        className={`w-full ${data.profit >= 0 ? 'bg-blue-500' : 'bg-orange-500'} transition-all duration-200 hover:w-5`}
                        style={{
                          height: `${getBarHeight(Math.abs(data.profit))}px`,
                          minHeight: data.profit !== 0 ? '2px' : '0'
                        }}
                      />
                      {/* Profit tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 absolute left-full bottom-0 ml-2 bg-black/90 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none shadow-lg backdrop-blur-sm border border-white/10 transition-opacity z-50">
                        Profit: ${data.profit.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Month label */}
                <div className="absolute -bottom-8 text-xs text-gray-600">{months[i]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="absolute top-0 right-4 flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 mr-1"></div>
            Revenue
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 mr-1"></div>
            Expenses
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 mr-1"></div>
            Profit
          </div>
        </div>
      </div>
    </div>
  );
} 