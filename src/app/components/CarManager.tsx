'use client';

import { useState } from 'react';
import { useTuro } from '../lib/contexts/TuroContext';
import { Car } from '../lib/types/turo';

export default function CarManager() {
  const { cars, addCar, removeCar, toggleCarSelection, selectedCars } = useTuro();
  const [isAddingCar, setIsAddingCar] = useState(false);
  const [newCar, setNewCar] = useState<Omit<Car, 'id'>>({
    name: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    purchasePrice: 0,
    purchaseDate: undefined,
    saleDate: undefined,
    salePrice: undefined,
    saleType: undefined,
    status: 'active'
  });

  const handleToggleAll = () => {
    const allSelected = cars.length === selectedCars.length;
    if (allSelected) {
      // Deselect all cars
      cars.forEach(car => {
        if (selectedCars.includes(car.id)) {
          toggleCarSelection(car.id);
        }
      });
    } else {
      // Select all cars
      cars.forEach(car => {
        if (!selectedCars.includes(car.id)) {
          toggleCarSelection(car.id);
        }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addCar(newCar);
      setIsAddingCar(false);
      resetForm();
    } catch (error) {
      console.error('Error adding car:', error);
      alert('Failed to add car. Please try again.');
    }
  };

  const resetForm = () => {
    setNewCar({
      name: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      purchasePrice: 0,
      purchaseDate: undefined,
      saleDate: undefined,
      salePrice: undefined,
      saleType: undefined,
      status: 'active'
    });
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Not set';
    // Ensure we're working with a YYYY-MM-DD format
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      console.error('Invalid date format:', dateStr);
      return 'Invalid date';
    }
    const [_, year, month, day] = match.map(Number);
    // Create date at noon UTC to avoid timezone issues
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return date.toLocaleDateString();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'purchaseDate' | 'saleDate') => {
    const value = e.target.value;
    // Ensure the date is in YYYY-MM-DD format
    if (value && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.error('Invalid date format:', value);
      return;
    }
    setNewCar({ ...newCar, [field]: value || undefined });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">Fleet Management</h2>
          <button
            onClick={handleToggleAll}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            {cars.length === selectedCars.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <button
          onClick={() => setIsAddingCar(!isAddingCar)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {isAddingCar ? 'Cancel' : 'Add New Car'}
        </button>
      </div>

      {isAddingCar && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={newCar.name}
                onChange={(e) => setNewCar({ ...newCar, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Make</label>
              <input
                type="text"
                value={newCar.make}
                onChange={(e) => setNewCar({ ...newCar, make: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Model</label>
              <input
                type="text"
                value={newCar.model}
                onChange={(e) => setNewCar({ ...newCar, model: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Year</label>
              <input
                type="number"
                value={newCar.year}
                onChange={(e) => setNewCar({ ...newCar, year: parseInt(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Purchase Price</label>
              <input
                type="number"
                value={newCar.purchasePrice}
                onChange={(e) => setNewCar({ ...newCar, purchasePrice: parseFloat(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Purchase Date</label>
              <input
                type="date"
                value={newCar.purchaseDate || ''}
                onChange={(e) => handleDateChange(e, 'purchaseDate')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Add Car
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {cars.map((car) => (
          <div
            key={car.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded"
          >
            <div className="flex items-center space-x-4">
              <input
                type="checkbox"
                checked={selectedCars.includes(car.id)}
                onChange={() => toggleCarSelection(car.id)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <h3 className="font-medium">{car.name}</h3>
                <p className="text-sm text-gray-500">
                  {car.year} {car.make} {car.model}
                </p>
                <p className="text-xs text-gray-400">
                  Purchased: {formatDate(car.purchaseDate)} for {' '}
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(car.purchasePrice)}
                </p>
              </div>
            </div>
            <button
              onClick={() => removeCar(car.id)}
              className="text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 