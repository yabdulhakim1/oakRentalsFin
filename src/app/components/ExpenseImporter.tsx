import { useState } from 'react';
import { bulkImportExpenses, deleteAllExpenseTransactions } from '../lib/firebase/firebaseUtils';

export default function ExpenseImporter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage({ text: 'Please select a file', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const text = await selectedFile.text();
      // Parse CSV data into array format
      const rows = text.split('\n').map(row => 
        row.split(',').map(cell => cell.trim())
      );

      const result = await bulkImportExpenses(rows);
      
      if (result.success) {
        let messageText = `Successfully processed ${result.processedCount} transactions. Skipped ${result.skippedCount} rows.`;
        if (result.errors && result.errors.length > 0) {
          messageText += '\n\nErrors:\n' + result.errors.join('\n');
        }
        
        setMessage({ 
          text: messageText, 
          type: 'success' 
        });
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage({ 
        text: 'Error uploading file. Please check the console for details.', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete all expense transactions? This cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await deleteAllExpenseTransactions();
      if (result.success) {
        setMessage({ 
          text: `Successfully deleted ${result.deletedCount} expense transactions`, 
          type: 'success' 
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error deleting transactions:', error);
      setMessage({ 
        text: 'Error deleting transactions. Please check the console for details.', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Bulk Expense Import</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upload CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100"
          />
          <div className="mt-2 text-sm text-gray-500 space-y-1">
            <p className="font-medium">CSV Format:</p>
            <p>First row: Column headers (insurance, Insurance Claim, parking, gas/uber, maintenance and repairs)</p>
            <p>For each month:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Month and year row (e.g., "July 2024")</li>
              <li>One row per car with car name and license plate, followed by expenses in each column</li>
              <li>Empty row between months</li>
            </ul>
            <p className="mt-2">Example:</p>
            <pre className="bg-gray-50 p-2 rounded text-xs mt-1">
{`insurance,Insurance Claim,parking,gas/uber,maintenance and repairs
July 2024
Toyota Corolla (SES2507),-140,0,-25,0,0
Volkswagen Jetta (SES2508),-160,1305,-87.5,-38,0

August 2024
Toyota Corolla (SES2507),-140,0,0,0,0
Volkswagen Jetta (SES2508),-160,0,-12,-25,0`}
            </pre>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleUpload}
            disabled={isLoading || !selectedFile}
            className={`px-4 py-2 rounded-md text-white font-medium ${
              isLoading || !selectedFile
                ? 'bg-gray-400'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isLoading ? 'Uploading...' : 'Upload'}
          </button>

          <button
            onClick={handleDeleteAll}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-white font-medium bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
          >
            Delete All Expenses
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-md whitespace-pre-wrap ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
} 