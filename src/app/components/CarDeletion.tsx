import { useState } from 'react';
import { useTuro } from '../lib/contexts/TuroContext';
import { deleteCarAndTransactions } from '../lib/firebase/firebaseUtils';

export default function CarDeletion() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const { cars, refreshCars } = useTuro();

  const handleDeleteCar = async (carId: string, carName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${carName} and all its transactions? This cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await deleteCarAndTransactions(carId);
      if (result.success) {
        setMessage({ 
          text: `Successfully deleted ${carName} and ${result.deletedTransactions} transactions`, 
          type: 'success' 
        });
        // Refresh the cars list
        refreshCars();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error deleting car:', error);
      setMessage({ 
        text: `Error deleting car: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Delete Car</h2>
      
      <div className="space-y-4">
        {cars.map(car => (
          <div key={car.id} className="flex items-center justify-between p-4 border rounded-lg">
            <span className="font-medium">{car.name}</span>
            <button
              onClick={() => handleDeleteCar(car.id, car.name)}
              disabled={isLoading}
              className="px-4 py-2 rounded-md text-white font-medium bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        ))}

        {message && (
          <div className={`p-4 rounded-md ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
} 