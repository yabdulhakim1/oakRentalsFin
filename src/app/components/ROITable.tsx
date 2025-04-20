'use client';

import { useState } from 'react';
import { useTuro } from '../lib/contexts/TuroContext';
import { CarROI, Car } from '../lib/types/turo';

export default function ROITable() {
  const { cars, getCarROI, updateCar, selectedCars, toggleCarSelection } = useTuro();
  const [editingCar, setEditingCar] = useState<string | null>(null);

  if (!cars || cars.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Vehicle ROI Analysis</h2>
        </div>
        <div className="p-6 text-center text-gray-500">
          {cars ? "No vehicles found. Add a vehicle in the Fleet Management section." : "Loading..."}
        </div>
      </div>
    );
  }

  const sortedCars = [...cars].sort((a, b) => {
    try {
      const roiA = getCarROI(a.id);
      const roiB = getCarROI(b.id);
      return roiB.totalROI - roiA.totalROI;
    } catch (error) {
      console.error('Error calculating ROI:', error);
      return 0;
    }
  });

  // Filter cars based on selection
  const displayCars = selectedCars.length > 0 
    ? sortedCars.filter(car => selectedCars.includes(car.id))
    : sortedCars;

  console.log('Total cars:', cars.length); // Debug log
  console.log('Sorted cars:', sortedCars.length); // Debug log
  console.log('Display cars:', displayCars.length); // Debug log

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

  const getStatusBadge = (roi: CarROI) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (roi.status) {
      case 'active':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Active</span>;
      case 'sold':
        return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>Sold</span>;
      case 'totaled':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Totaled</span>;
    }
  };

  const handleSubmit = (car: Car, formData: FormData) => {
    const updatedCar = {
      ...car,
      purchasePrice: parseFloat(formData.get('purchasePrice') as string),
      purchaseDate: formData.get('purchaseDate') as string,
      saleType: formData.get('saleType') as 'sold' | 'totaled' | undefined,
    };

    if (updatedCar.saleType) {
      updatedCar.salePrice = parseFloat(formData.get('salePrice') as string);
      updatedCar.saleDate = formData.get('saleDate') as string;
    } else {
      delete updatedCar.salePrice;
      delete updatedCar.saleDate;
      delete updatedCar.saleType;
    }

    updateCar(updatedCar);
    setEditingCar(null);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Vehicle ROI Analysis</h2>
        <div className="text-sm text-gray-500">
          {selectedCars.length > 0 
            ? `${selectedCars.length} car${selectedCars.length > 1 ? 's' : ''} selected`
            : `${cars.length} total cars`}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedCars.length === cars.length}
                  onChange={() => {
                    if (selectedCars.length === cars.length) {
                      // Deselect all
                      cars.forEach(car => toggleCarSelection(car.id));
                    } else {
                      // Select all
                      cars.forEach(car => {
                        if (!selectedCars.includes(car.id)) {
                          toggleCarSelection(car.id);
                        }
                      });
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Info</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Info</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Expenses</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Profit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total ROI</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly ROI</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayCars.map((car) => {
              const roi = getCarROI(car.id);
              const isEditing = editingCar === car.id;

              if (isEditing) {
                return (
                  <tr key={car.id} className="bg-gray-50">
                    <td colSpan={10} className="px-6 py-4">
                      <form action={(formData) => handleSubmit(car, formData)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2 bg-gray-50 p-4 rounded-lg">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Purchase Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Purchase Price</label>
                                <input
                                  type="number"
                                  name="purchasePrice"
                                  defaultValue={car.purchasePrice}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Purchase Date</label>
                                <input
                                  type="date"
                                  name="purchaseDate"
                                  defaultValue={car.purchaseDate}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="col-span-2 bg-gray-50 p-4 rounded-lg">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Sale Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Sale Status</label>
                                <select
                                  name="saleType"
                                  defaultValue={car.saleType || ''}
                                  onChange={(e) => {
                                    const saleFields = document.getElementById('saleFields');
                                    if (saleFields) {
                                      saleFields.style.display = e.target.value ? 'block' : 'none';
                                    }
                                  }}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                >
                                  <option value="">Active (Not Sold)</option>
                                  <option value="sold">Sold</option>
                                  <option value="totaled">Totaled</option>
                                </select>
                              </div>
                              
                              <div className="col-span-2 space-y-4" id="saleFields" style={{ display: car.saleType ? 'block' : 'none' }}>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Sale Price</label>
                                  <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <span className="text-gray-500 sm:text-sm">$</span>
                                    </div>
                                    <input
                                      type="number"
                                      name="salePrice"
                                      defaultValue={car.salePrice || ''}
                                      placeholder="0.00"
                                      required={!!car.saleType}
                                      className="mt-1 block w-full pl-7 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Sale Date</label>
                                  <input
                                    type="date"
                                    name="saleDate"
                                    defaultValue={car.saleDate || new Date().toISOString().split('T')[0]}
                                    required={!!car.saleType}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex justify-end space-x-3">
                          <button
                            type="button"
                            onClick={() => setEditingCar(null)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border-2 border-indigo-600 rounded-md hover:bg-indigo-700 hover:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Save Changes
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={car.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedCars.includes(car.id)}
                      onChange={() => toggleCarSelection(car.id)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">{car.name}</div>
                      <div className="text-sm text-gray-500">{car.year} {car.make} {car.model}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(roi)}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatCurrency(roi.purchasePrice)}</div>
                    <div className="text-xs text-gray-500">{new Date(car.purchaseDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {roi.salePrice ? (
                      <>
                        <div className="text-sm text-gray-900">{formatCurrency(roi.salePrice)}</div>
                        <div className="text-xs text-gray-500">{new Date(car.saleDate!).toLocaleDateString()}</div>
                      </>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(roi.totalRevenue)}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(roi.totalExpenses)}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className={`text-sm font-medium ${roi.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(roi.profit)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className={`text-sm font-medium ${roi.totalROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(roi.totalROI)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className={`text-sm font-medium ${roi.monthlyROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(roi.monthlyROI)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <button
                      onClick={() => setEditingCar(car.id)}
                      className="inline-flex items-center px-4 py-2 border-2 border-indigo-600 text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 hover:border-indigo-700 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {car.saleType ? 'Update Sale Info' : 'Add Sale Info'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
} 