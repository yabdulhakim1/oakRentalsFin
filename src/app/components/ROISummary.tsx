'use client';

import { useTuro } from '../lib/contexts/TuroContext';

export default function ROISummary() {
  const { cars, getCarROI } = useTuro();

  // Calculate totals across all cars
  const totals = cars.reduce((acc, car) => {
    const roi = getCarROI(car.id);
    return {
      totalRevenue: acc.totalRevenue + roi.totalRevenue,
      totalExpenses: acc.totalExpenses + roi.totalExpenses,
      netProfit: acc.netProfit + roi.profit,
      totalInvestment: acc.totalInvestment + car.purchasePrice,
    };
  }, {
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalInvestment: 0,
  });

  // Calculate overall ROI
  const totalROI = totals.totalInvestment > 0 
    ? (totals.netProfit / totals.totalInvestment) * 100 
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Fleet Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">Total Revenue</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {formatCurrency(totals.totalRevenue)}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">Total Expenses</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {formatCurrency(totals.totalExpenses)}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">Net Profit</div>
          <div className={`mt-1 text-xl font-semibold ${totals.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totals.netProfit)}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">Total Investment</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {formatCurrency(totals.totalInvestment)}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">Total ROI</div>
          <div className={`mt-1 text-xl font-semibold ${totalROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercent(totalROI)}
          </div>
        </div>
      </div>
    </div>
  );
} 