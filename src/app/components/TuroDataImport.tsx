'use client';

import { useState } from 'react';
import { useTuro } from '../lib/contexts/TuroContext';
import { addTransactionsBatch, deleteTransactions, addCar, getCarByName, getTransactionByTripId } from '../lib/firebase/firebaseUtils';
import { Transaction, Car } from '../lib/types/turo';

interface PreviewData {
  tripId: string;
  carName: string;
  startDate: string;
  endDate: string;
  earnings: number;
  expenses: number;
  isValid: boolean;
  errors: string[];
  isNewCar: boolean;
}

interface ImportResult {
  transactionIds: string[];
  tripCount: number;
  transactionCount: number;
  timestamp: string;
}

export default function TuroDataImport() {
  const { cars, refreshCars } = useTuro();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  const validateRow = async (row: string[]): Promise<PreviewData> => {
    const errors: string[] = [];
    const [tripId, carName, startDate, endDate, earnings, expenses] = row;

    // Check if car exists
    let isNewCar = false;
    const existingCar = await getCarByName(carName);
    if (!existingCar) {
      isNewCar = true;
    }

    // Validate dates
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate)) {
      errors.push('Start date must be in YYYY-MM-DD format');
    }
    if (!dateRegex.test(endDate)) {
      errors.push('End date must be in YYYY-MM-DD format');
    }
    if (new Date(startDate) > new Date(endDate)) {
      errors.push('Start date cannot be after end date');
    }

    // Validate amounts
    const earningsNum = parseFloat(earnings);
    const expensesNum = parseFloat(expenses);
    if (isNaN(earningsNum)) {
      errors.push('Trip earnings must be a valid number');
    }
    if (isNaN(expensesNum)) {
      errors.push('Trip expenses must be a valid number');
    }
    if (earningsNum < 0) {
      errors.push('Trip earnings cannot be negative');
    }
    if (expensesNum < 0) {
      errors.push('Trip expenses cannot be negative');
    }

    return {
      tripId,
      carName,
      startDate,
      endDate,
      earnings: earningsNum,
      expenses: expensesNum,
      isValid: errors.length === 0,
      errors,
      isNewCar
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError('');
    setImportStatus('Reading file...');
    setPreviewData([]);
    setShowPreview(false);
    setLastImport(null);

    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
      
      // Validate header row
      const headerRow = rows[0];
      const expectedHeaders = ['Trip ID', 'Car Name', 'Start Date', 'End Date', 'Trip Earnings', 'Trip Expenses'];
      if (!headerRow || headerRow.length !== expectedHeaders.length || 
          !expectedHeaders.every((header, i) => headerRow[i].toLowerCase() === header.toLowerCase())) {
        throw new Error('Invalid CSV format. Please make sure the headers match the required format.');
      }

      // Validate and preview data rows
      setImportStatus('Validating data...');
      const preview = await Promise.all(rows.slice(1).map(row => validateRow(row)));
      setPreviewData(preview);
      setShowPreview(true);

      const validRows = preview.filter(row => row.isValid);
      const invalidRows = preview.filter(row => !row.isValid);
      const newCars = preview.filter(row => row.isNewCar);

      setImportStatus(
        `Found ${preview.length} trips (${validRows.length} valid, ${invalidRows.length} invalid)` +
        (newCars.length > 0 ? ` with ${newCars.length} new cars to be added` : '')
      );
    } catch (error: any) {
      console.error('Preview error:', error);
      setError(error.message || 'Failed to read file. Please check the format and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = async () => {
    if (!previewData.length) return;

    setIsImporting(true);
    setError('');
    setImportStatus('Importing data...');

    try {
      const validData = previewData.filter(row => row.isValid);
      const transactionIds: string[] = [];
      const newCarIds = new Map<string, string>();

      // First, add any new cars
      const newCars = validData.filter(row => row.isNewCar);
      if (newCars.length > 0) {
        setImportStatus(`Adding ${newCars.length} new cars...`);
        for (const row of newCars) {
          const carId = await addCar({
            name: row.carName,
            make: 'Unknown',
            model: 'Unknown',
            year: new Date().getFullYear(),
            status: 'active',
            purchasePrice: 0,
            purchaseDate: row.startDate
          });
          if (carId) {
            newCarIds.set(row.carName, carId);
          }
        }
        await refreshCars();
      }

      // Then add/update transactions
      setImportStatus('Processing transactions...');
      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const row of validData) {
        const existingCar = await getCarByName(row.carName);
        const carId = existingCar?.id || newCarIds.get(row.carName);
        
        if (!carId) {
          console.error(`Could not find car ID for ${row.carName}`);
          continue;
        }

        // Generate a unique transaction ID based on trip details
        const tripTransactionId = `${carId}-${row.tripId}`;

        // Add only revenue transaction (preserve existing expenses)
        if (row.earnings > 0) {
          const result = await addTransactionsBatch([{
            id: tripTransactionId,
            carId,
            date: row.startDate,
            type: 'revenue',
            amount: row.earnings,
            description: `Trip ${row.tripId} Revenue`,
            category: 'trip_earnings',
            tripId: row.tripId,
            tripEnd: row.endDate,
            tripDays: Math.ceil((new Date(row.endDate).getTime() - new Date(row.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
          }]);

          if (result.totalSaved > 0 || result.totalUpdated > 0) {
            // Store the actual Firestore document IDs
            transactionIds.push(...(result.savedIds || []));
            addedCount += result.totalSaved;
            updatedCount += result.totalUpdated;
          }
          if (result.totalSkipped > 0) skippedCount += result.totalSkipped;
        }
      }

      setImportStatus(
        `Import complete. Added ${addedCount} new transactions, ` +
        `updated ${updatedCount} existing transactions, ` +
        `skipped ${skippedCount} unchanged transactions. ` +
        `Added ${newCars.length} new cars.`
      );
      setShowPreview(false);
      setPreviewData([]);
      setLastImport({
        transactionIds,
        tripCount: validData.length,
        transactionCount: addedCount + updatedCount,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Import error:', error);
      setError(error.message || 'Failed to import data. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleUndo = async () => {
    if (!lastImport || isUndoing) return;

    setIsUndoing(true);
    setError('');
    setImportStatus('Undoing last import...');

    try {
      const result = await deleteTransactions(lastImport.transactionIds);
      if (result.success) {
        setImportStatus(`Successfully removed ${result.deletedCount} transactions from the last import.`);
        setLastImport(null);
      } else {
        throw new Error('Failed to delete some transactions');
      }
    } catch (error: any) {
      console.error('Undo error:', error);
      setError(error.message || 'Failed to undo import. Please try again.');
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Turo Trip Data</h3>
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>Import your Turo trip data from a CSV file. The file should have the following columns:</p>
          <ul className="list-disc list-inside mt-2">
            <li>Trip ID</li>
            <li>Car Name</li>
            <li>Start Date (YYYY-MM-DD format)</li>
            <li>End Date (YYYY-MM-DD format)</li>
            <li>Trip Earnings (numbers only, no currency symbols)</li>
            <li>Trip Expenses (numbers only, no currency symbols)</li>
          </ul>
          <p className="mt-2 text-indigo-600">
            New cars will be automatically added to your fleet.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex-1">
            <span className="sr-only">Choose CSV file</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isImporting || isUndoing}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>
        </div>

        {(isImporting || isUndoing) && (
          <div className="text-sm text-indigo-600">
            {importStatus}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}

        {showPreview && previewData.length > 0 && (
          <div className="mt-6">
            <h4 className="text-md font-semibold text-gray-900 mb-2">Data Preview</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Trip ID</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Car</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Start Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">End Date</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Earnings</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Expenses</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.map((row, index) => (
                    <tr key={index} className={row.isValid ? 'bg-white' : 'bg-red-50'}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.isValid ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-red-600" title={row.errors.join('\n')}>✗</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">{row.tripId}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        {row.carName}
                        {row.isNewCar && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            New
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">{row.startDate}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">{row.endDate}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right">${row.earnings.toFixed(2)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right">${row.expenses.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Hover over ✗ to see validation errors
                {previewData.some(row => row.isNewCar) && (
                  <span className="ml-2">• Cars marked as &quot;New&quot; will be added automatically</span>
                )}
              </div>
              <button
                onClick={handleImport}
                disabled={!previewData.some(row => row.isValid) || isImporting || isUndoing}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import Valid Rows
              </button>
            </div>
          </div>
        )}

        {lastImport && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <p>Last import: {new Date(lastImport.timestamp).toLocaleString()}</p>
                <p>{lastImport.tripCount} trips ({lastImport.transactionCount} transactions)</p>
              </div>
              <button
                onClick={handleUndo}
                disabled={isUndoing || isImporting}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Undo Import
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          <p>Note: Make sure your car names in the CSV exactly match the names in the app.</p>
          <p>Current cars: {cars.map(car => car.name).join(', ')}</p>
        </div>
      </div>
    </div>
  );
} 