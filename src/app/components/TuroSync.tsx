'use client';

import { useState } from 'react';
import { useToast } from '../hooks/useToast';

export default function TuroSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.name.endsWith('.csv')) {
        toast({
          title: 'Error',
          description: 'Please upload a CSV file',
          type: 'error',
        });
        return;
      }
      await handleFile(file);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLoading(true);
    setStatus('Processing CSV file...');

    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.name.endsWith('.csv')) {
        toast({
          title: 'Error',
          description: 'Please upload a CSV file',
          type: 'error',
        });
        return;
      }
      await handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (startDate) formData.append('startDate', startDate);
      if (endDate) formData.append('endDate', endDate);

      const response = await fetch('/api/turo/sync', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync data');
      }

      // Success case
      console.log('Sync successful:', result);
      setStatus('Success!');
      toast({
        title: 'Success!',
        description: result.message || `Successfully imported ${result.transactionCount} transactions for ${result.cars.length} cars`,
        type: 'success',
      });
      return result;
    } catch (error) {
      console.error('Sync error:', error);
      setStatus('Failed to process file');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process CSV file',
        type: 'error',
      });
      throw error;
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Import Turo Data</h2>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
              Start Date (Optional)
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
              End Date (Optional)
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div 
          className={`relative border-2 border-dashed rounded-lg p-6 text-center ${
            dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            accept=".csv"
            className="hidden"
            onChange={handleFileInput}
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer"
          >
            <div className="space-y-2">
              <svg 
                className="mx-auto h-12 w-12 text-gray-400" 
                stroke="currentColor" 
                fill="none" 
                viewBox="0 0 48 48" 
                aria-hidden="true"
              >
                <path 
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
                  strokeWidth={2} 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </svg>
              <div className="text-sm text-gray-600">
                <span className="font-medium text-indigo-600 hover:text-indigo-500">
                  Upload a CSV file
                </span>
                {' '}or drag and drop
              </div>
              <p className="text-xs text-gray-500">
                Export your trips from Turo and upload the CSV here
              </p>
            </div>
          </label>
        </div>

        {(isLoading || status) && (
          <div className="flex items-center justify-center text-sm text-gray-500">
            {isLoading && (
              <svg className="animate-spin h-5 w-5 mr-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span className={status.includes('Error') || status.includes('Failed') ? 'text-red-500' : 
                   status.includes('Success') ? 'text-green-500' : 'text-gray-500'}>
              {status || 'Processing...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
} 