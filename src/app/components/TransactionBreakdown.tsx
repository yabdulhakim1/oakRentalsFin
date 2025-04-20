import { useTuro } from '../lib/contexts/TuroContext';
import { useMemo } from 'react';

interface MonthlyCarTransactions {
  carId: string;
  carName: string;
  months: {
    [key: number]: {
      transactions: Array<{
        id: string;
        date: string;
        amount: number;
        description: string;
      }>;
      total: number;
    };
  };
}

export default function TransactionBreakdown() {
  const { transactions, cars, timeRange, selectedCars } = useTuro();

  const monthlyBreakdown = useMemo(() => {
    // Initialize data structure for each car
    const carData: { [key: string]: MonthlyCarTransactions } = {};
    
    // Initialize data for each selected car
    selectedCars.forEach(carId => {
      const car = cars.find(c => c.id === carId);
      if (car && car.name.trim() !== "Mitsubishi Mirage 2019") {
        carData[carId] = {
          carId,
          carName: car.name,
          months: {}
        };
        // Initialize all months
        for (let i = 0; i < 12; i++) {
          carData[carId].months[i] = {
            transactions: [],
            total: 0
          };
        }
      }
    });

    // Filter and process transactions
    transactions
      .filter(t => {
        // Only include revenue transactions from trip earnings
        if (t.type !== 'revenue' || t.category !== 'trip_earnings') return false;
        
        // Check if car is selected and exists
        if (!selectedCars.includes(t.carId)) return false;
        const car = cars.find(c => c.id === t.carId);
        if (!car || car.name.trim() === "Mitsubishi Mirage 2019") return false;

        // Check year
        const date = new Date(t.date + 'T00:00:00Z');
        const year = date.getUTCFullYear();
        return timeRange.selectedYear === 0 || year === timeRange.selectedYear;
      })
      .forEach(t => {
        const date = new Date(t.date + 'T00:00:00Z');
        const month = date.getUTCMonth();
        
        if (carData[t.carId]) {
          carData[t.carId].months[month].transactions.push({
            id: t.id,
            date: t.date,
            amount: t.amount,
            description: t.description || ''
          });
          carData[t.carId].months[month].total += t.amount;
        }
      });

    return Object.values(carData);
  }, [transactions, cars, timeRange, selectedCars]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="mt-8 p-4">
      <h2 className="text-2xl font-bold mb-4">Monthly Transaction Breakdown</h2>
      
      {/* Scrollable container */}
      <div className="overflow-x-auto border border-gray-200 bg-white">
        {/* Fixed header */}
        <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
          <div className="flex">
            <div className="sticky left-0 z-20 bg-gray-50 px-4 py-2 border-r min-w-[200px]">Car</div>
            {monthNames.map(month => (
              <div key={month} className="px-4 py-2 border-r min-w-[200px] whitespace-nowrap">
                {month}
              </div>
            ))}
          </div>
        </div>

        {/* Table content */}
        <div className="relative">
          {monthlyBreakdown.map(car => (
            <div key={car.carId} className="flex border-b">
              <div className="sticky left-0 z-10 bg-white px-4 py-2 font-medium border-r min-w-[200px]">
                {car.carName}
              </div>
              {Object.entries(car.months).map(([month, data]) => (
                <div key={month} className="px-4 py-2 border-r min-w-[200px]">
                  {data.transactions.length > 0 ? (
                    <div>
                      <div className="font-semibold text-green-600">
                        Total: ${data.total.toFixed(2)}
                      </div>
                      <div className="space-y-2 mt-2">
                        {data.transactions.map(t => (
                          <div key={t.id} className="text-sm">
                            <div className="font-medium">${t.amount.toFixed(2)}</div>
                            <div className="text-gray-500">{t.date}</div>
                            <div className="text-gray-600 text-xs">{t.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">No transactions</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 