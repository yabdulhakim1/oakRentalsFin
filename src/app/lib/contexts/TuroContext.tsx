'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Car, Transaction, CarStats, TimeFilter, TimeRange, MonthlyStats, CarROI } from '../types/turo';
import { collection, getDocs, onSnapshot, Timestamp, query, orderBy, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getTransactions, deleteCarAndTransactions } from '../firebase/firebaseUtils';

interface TuroContextType {
  cars: Car[];
  transactions: Transaction[];
  selectedCars: string[];
  timeFilter: TimeFilter;
  timeRange: TimeRange;
  addCar: (car: Omit<Car, 'id'>) => void;
  removeCar: (carId: string) => void;
  updateCar: (car: Car) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  toggleCarSelection: (carId: string) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  setTimeRange: (range: TimeRange) => void;
  getCarStats: (carId: string) => CarStats;
  getFleetStats: () => CarStats;
  getMonthlyStats: () => MonthlyStats[];
  setSelectedYear: (year: number) => void;
  getCarROI: (carId: string) => CarROI;
  refreshCars: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
}

const TuroContext = createContext<TuroContextType | undefined>(undefined);

const defaultTimeRange: TimeRange = {
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  selectedYear: 2025
};

// Load data from localStorage
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

// Save data to localStorage
const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

// Add this before the TuroProvider component
const LoadingState = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
  </div>
);

export function TuroProvider({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const [cars, setCars] = useState<Car[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedCars, setSelectedCars] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('year');
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const currentYear = new Date().getFullYear();
    return {
      selectedYear: currentYear,
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`
    };
  });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get all transactions
        const allTransactions = await getTransactions();
        setTransactions(allTransactions);
        console.log('Loaded transactions:', allTransactions.length);

        // Get all cars
        const carsRef = collection(db, 'cars');
        const carsSnapshot = await getDocs(carsRef);
        const carsData = carsSnapshot.docs.map(doc => {
          const data = doc.data();
          // Debug log for FIAT 500
          if (data.name && data.name.includes('FIAT 500')) {
            console.log('Found FIAT 500 in cars collection:', {
              id: doc.id,
              name: data.name,
              make: data.make,
              model: data.model,
              allData: data
            });
          }
          
          // Convert dates to ISO string format
          const convertToISOString = (field: any) => {
            if (!field) return null;
            try {
              if (field instanceof Timestamp) {
                return field.toDate().toISOString().split('T')[0];
              }
              if (typeof field === 'string') {
                const date = new Date(field);
                if (isNaN(date.getTime())) {
                  console.error('Invalid date string:', field);
                  return null;
                }
                return date.toISOString().split('T')[0];
              }
              if (field instanceof Date) {
                return field.toISOString().split('T')[0];
              }
              console.error('Unhandled date field type:', typeof field, field);
              return null;
            } catch (error) {
              console.error('Error converting date:', error, field);
              return null;
            }
          };

          const car = {
            id: doc.id,
            ...data,
            purchaseDate: convertToISOString(data.purchaseDate),
            saleDate: convertToISOString(data.saleDate)
          } as Car;  // Add type assertion
          console.log('Loaded car with dates:', {
            id: car.id,
            name: car.name,
            purchaseDate: car.purchaseDate,
            saleDate: car.saleDate,
            rawPurchaseDate: data.purchaseDate,
            rawSaleDate: data.saleDate
          });
          return car;
        }) as Car[];
        setCars(carsData);
        console.log('Loaded cars:', carsData.length);

        // Select all cars by default
        setSelectedCars(carsData.map(car => car.id));
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadData();
  }, []);

  // Subscribe to cars collection
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'cars'), (snapshot) => {
      const updatedCars = snapshot.docs.map(doc => {
        const data = doc.data();
        // Debug log for FIAT 500
        if (data.name && data.name.includes('FIAT 500')) {
          console.log('Found FIAT 500 in cars collection:', {
            id: doc.id,
            name: data.name,
            make: data.make,
            model: data.model,
            allData: data
          });
        }
        
        // Rest of the code...
        const convertToISOString = (field: any) => {
          if (!field) return null;
          try {
            if (field instanceof Timestamp) {
              return field.toDate().toISOString().split('T')[0];
            }
            if (typeof field === 'string') {
              return new Date(field).toISOString().split('T')[0];
            }
            if (field instanceof Date) {
              return field.toISOString().split('T')[0];
            }
            return null;
          } catch (error) {
            return null;
          }
        };

        const car = {
          id: doc.id,
          ...data,
          purchaseDate: convertToISOString(data.purchaseDate),
          saleDate: convertToISOString(data.saleDate)
        };

        return car;
      }) as Car[];

      // Debug log all cars that match FIAT 500
      const fiatCars = updatedCars.filter(car => car.name && car.name.includes('FIAT 500'));
      console.log('All FIAT 500 cars:', fiatCars);

      setCars(updatedCars);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to transactions collection
  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedTransactions = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Debug log raw transaction data for FIAT 500
        if (data.Vehicle && data.Vehicle.includes('FIAT')) {
          console.log('Found raw FIAT transaction:', {
            id: doc.id,
            vehicle: data.Vehicle,
            vehicleName: data['Vehicle name'],
            allData: data
          });
        }

        let dateStr = data.date;
        if (data.date instanceof Timestamp) {
          dateStr = data.date.toDate().toISOString().split('T')[0];
        }
        
        const transaction = {
          id: doc.id,
          ...data,
          amount: Number(data.amount),
          date: dateStr,
          type: data.type || 'revenue',
          category: data.category || 'trip_earnings'
        };

        return transaction;
      }) as Transaction[];

      // Debug log all transactions that might be FIAT related
      const fiatTransactions = updatedTransactions.filter(t => {
        const relatedCar = cars.find(c => c.id === t.carId);
        return relatedCar && relatedCar.name.includes('FIAT 500');
      });
      
      console.log('FIAT Transaction Matching:', {
        allCars: cars.filter(c => c.name.includes('FIAT 500')).map(c => ({
          id: c.id,
          name: c.name
        })),
        matchedTransactions: fiatTransactions,
        allTransactionsCount: updatedTransactions.length
      });

      setTransactions(updatedTransactions);
    }, (error) => {
      console.error('Error loading transactions:', error);
    });

    return () => unsubscribe();
  }, [cars]);

  // Initialize state from localStorage after component mounts
  useEffect(() => {
    setIsClient(true);
    
    // Set default year to 2025 if not found in localStorage
    const defaultYear = 2025;
    const storedTimeRange = loadFromStorage('turo_time_range', {
      selectedYear: defaultYear,
      startDate: `${defaultYear}-01-01`,
      endDate: `${defaultYear}-12-31`
    });

    // Ensure the time range has valid dates
    const year = storedTimeRange.selectedYear || defaultYear;
    const validTimeRange = {
      selectedYear: year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    };

    setCars(loadFromStorage('turo_cars', []));
    setTransactions(loadFromStorage('turo_transactions', []));
    setSelectedCars(loadFromStorage('turo_selected_cars', []));
    setTimeFilter(loadFromStorage('turo_time_filter', 'year'));
    setTimeRange(validTimeRange);
  }, []);

  // Save to localStorage whenever state changes (only on client)
  useEffect(() => {
    if (!isClient) return;
    saveToStorage('turo_cars', cars);
  }, [isClient, cars]);

  useEffect(() => {
    if (!isClient) return;
    saveToStorage('turo_transactions', transactions);
  }, [isClient, transactions]);

  useEffect(() => {
    if (!isClient) return;
    saveToStorage('turo_selected_cars', selectedCars);
  }, [isClient, selectedCars]);

  useEffect(() => {
    if (!isClient) return;
    saveToStorage('turo_time_filter', timeFilter);
  }, [isClient, timeFilter]);

  useEffect(() => {
    if (!isClient) return;
    saveToStorage('turo_time_range', timeRange);
  }, [isClient, timeRange]);

  const addCar = useCallback(async (car: Omit<Car, 'id'>) => {
    try {
      console.log('Adding car with data:', car);

      // Validate required fields
      if (!car.name || !car.make || !car.model || !car.year || !car.purchasePrice || !car.purchaseDate) {
        throw new Error('Missing required fields');
      }

      // Ensure purchaseDate is in YYYY-MM-DD format
      if (!car.purchaseDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.error('Invalid purchase date format:', car.purchaseDate);
        throw new Error('Invalid purchase date format');
      }

      // Convert dates to Firestore Timestamp and handle undefined values
      const carData = {
        name: car.name,
        make: car.make,
        model: car.model,
        year: car.year,
        purchasePrice: car.purchasePrice,
        salePrice: car.salePrice || null,
        saleType: car.saleType || null,
        purchaseDate: Timestamp.fromDate(new Date(car.purchaseDate + 'T00:00:00Z')),
        saleDate: car.saleDate ? Timestamp.fromDate(new Date(car.saleDate + 'T00:00:00Z')) : null,
        createdAt: Timestamp.now(),
        status: car.status || 'active'
      };

      console.log('Saving car data to Firestore:', carData);

      const docRef = await addDoc(collection(db, 'cars'), carData);
      console.log('Car added successfully with ID:', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error in addCar:', error);
      throw error;
    }
  }, []);

  const removeCar = useCallback(async (carId: string) => {
    try {
      const result = await deleteCarAndTransactions(carId);
      if (result.success) {
        // Only update local state if Firebase deletion was successful
        setCars(prev => prev.filter(car => car.id !== carId));
        setTransactions(prev => prev.filter(trans => trans.carId !== carId));
        setSelectedCars(prev => prev.filter(id => id !== carId));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error removing car:', error);
      throw error;
    }
  }, []);

  const updateCar = useCallback(async (car: Car) => {
    try {
      // Update in Firebase
      const carRef = doc(db, 'cars', car.id);
      
      // Convert dates to Firestore Timestamp at midnight UTC
      const convertToFirestoreDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return null;
        // Ensure we're working with a YYYY-MM-DD format
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
          console.error('Invalid date format:', dateStr);
          return null;
        }
        const [_, year, month, day] = match.map(Number);
        // Create date at midnight UTC
        return Timestamp.fromDate(new Date(Date.UTC(year, month - 1, day, 0, 0, 0)));
      };

      // Log the incoming dates
      console.log('Incoming dates:', {
        purchaseDate: car.purchaseDate,
        saleDate: car.saleDate
      });

      // Convert dates and log the results
      const purchaseTimestamp = convertToFirestoreDate(car.purchaseDate);
      const saleTimestamp = convertToFirestoreDate(car.saleDate);
      
      console.log('Converted to Firestore:', {
        purchaseTimestamp,
        saleTimestamp,
        purchaseDateISO: purchaseTimestamp?.toDate().toISOString(),
        saleDateISO: saleTimestamp?.toDate().toISOString()
      });

      // Prepare the data for Firebase, ensuring all fields are included
      const carData = {
        name: car.name,
        make: car.make,
        model: car.model,
        year: car.year,
        purchasePrice: car.purchasePrice,
        salePrice: car.salePrice || null,
        saleType: car.saleType || null,
        purchaseDate: purchaseTimestamp,
        saleDate: saleTimestamp,
        status: car.status || 'active'
      };

      console.log('Saving car data to Firebase:', carData);
      await updateDoc(carRef, carData);

      // Update local state with the original ISO date strings
      const updatedCar = {
        ...car,
        purchaseDate: car.purchaseDate,
        saleDate: car.saleDate
      };
      setCars(prev => prev.map(c => c.id === car.id ? updatedCar : c));
      
      console.log('Car updated successfully:', updatedCar);
    } catch (error) {
      console.error('Error updating car:', error);
      throw error;
    }
  }, []);

  const addTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    const newTransaction = { ...transaction, id: Math.random().toString(36).substr(2, 9) };
    setTransactions(prev => [...prev, newTransaction]);
  }, []);

  const toggleCarSelection = useCallback((carId: string) => {
    setSelectedCars(prev => 
      prev.includes(carId) 
        ? prev.filter(id => id !== carId)
        : [...prev, carId]
    );
  }, []);

  const setSelectedYear = useCallback((year: number) => {
    console.log('Setting selected year:', year);
    if (isNaN(year)) {
      console.error('Invalid year provided:', year);
      return;
    }

    // Special case for "All Years" (year === 0)
    const newTimeRange = year === 0 ? {
      selectedYear: 0,
      startDate: '2024-01-01',
      endDate: '2026-12-31'
    } : {
      selectedYear: year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    };

    console.log('Updating time range to:', newTimeRange);
    setTimeRange(newTimeRange);
  }, []);

  const filterTransactionsByTimeRange = useCallback((transactions: Transaction[]) => {
    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date + 'T00:00:00Z');
      const startDate = new Date(timeRange.startDate + 'T00:00:00Z');
      const endDate = new Date(timeRange.endDate + 'T00:00:00Z');
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [timeRange]);

  const getCarStats = useCallback((carId: string): CarStats => {
    // Debug log for FIAT 500 stats calculation
    const car = cars.find(c => c.id === carId);
    if (car?.name.includes('FIAT 500')) {
      console.log('Calculating stats for FIAT 500:', {
        carId,
        carName: car.name,
        allTransactions: transactions.length,
        carTransactions: transactions.filter(t => t.carId === carId).length
      });
    }

    const carTransactions = transactions.filter(t => t.carId === carId);
    const filteredTransactions = filterTransactionsByTimeRange(carTransactions);
    
    // Debug log for filtered FIAT 500 transactions
    if (car?.name.includes('FIAT 500')) {
      console.log('Filtered FIAT 500 transactions:', {
        beforeFilter: carTransactions.length,
        afterFilter: filteredTransactions.length,
        timeRange,
        transactions: filteredTransactions
      });
    }

    const totalRevenue = filteredTransactions
      .filter(t => t.type === 'revenue' && (t.category === 'trip_earnings' || t.category === 'insurance_claim'))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      totalRevenue,
      totalExpenses,
      profit: totalRevenue - totalExpenses
    };
  }, [transactions, filterTransactionsByTimeRange, cars, timeRange]);

  const getFleetStats = useCallback((): CarStats => {
    // Create a Set to track processed transaction IDs
    const processedTransactionIds = new Set<string>();

    const filteredTransactions = transactions.filter(transaction => {
      // Skip if we've already processed this transaction ID
      if (processedTransactionIds.has(transaction.id)) {
        console.log('Skipping duplicate transaction:', transaction);
        return false;
      }

      // Use UTC date to avoid timezone issues
      const date = new Date(transaction.date + 'T00:00:00Z');
      const transactionYear = date.getUTCFullYear();
      const isSelectedCar = selectedCars.includes(transaction.carId);
      
      // Find the car for this transaction
      const car = cars.find(c => c.id === transaction.carId);
      // Skip transactions for Mitsubishi Mirage 2019 (exact match)
      if (car && car.name.trim() === "Mitsubishi Mirage 2019") {
        console.log('Excluding transaction for Mitsubishi Mirage 2019:', transaction);
        return false;
      }

      // Include all years if selectedYear is 0
      const shouldInclude = isSelectedCar && (timeRange.selectedYear === 0 || transactionYear === timeRange.selectedYear);
      
      if (shouldInclude) {
        processedTransactionIds.add(transaction.id);
      }

      return shouldInclude;
    });

    const stats = filteredTransactions.reduce((stats, transaction) => {
      const amount = Number(transaction.amount) || 0;
      if (transaction.type === 'revenue' && (transaction.category === 'trip_earnings' || transaction.category === 'insurance_claim')) {
        // For revenue, count both trip earnings and insurance claims
        stats.totalRevenue += amount;
        stats.transactions.push({
          id: transaction.id,
          amount,
          type: 'revenue',
          date: transaction.date,
          description: transaction.description || ''
        });
      } else if (transaction.type === 'expense') {
        stats.totalExpenses += amount;
        stats.transactions.push({
          id: transaction.id,
          amount,
          type: 'expense',
          date: transaction.date,
          description: transaction.description || ''
        });
      }
      stats.profit = stats.totalRevenue - stats.totalExpenses;
      return stats;
    }, {
      totalRevenue: 0,
      totalExpenses: 0,
      profit: 0,
      transactions: [] as { id: string; amount: number; type: string; date: string; description: string }[]
    });

    console.log('Fleet stats calculated:', {
      stats: {
        totalRevenue: stats.totalRevenue,
        totalExpenses: stats.totalExpenses,
        profit: stats.profit
      },
      transactionCount: stats.transactions.length,
      revenueTransactions: stats.transactions
        .filter(t => t.type === 'revenue')
        .map(t => ({
          id: t.id,
          amount: t.amount,
          date: t.date,
          description: t.description
        })),
      expenseTransactions: stats.transactions
        .filter(t => t.type === 'expense')
        .map(t => ({
          id: t.id,
          amount: t.amount,
          date: t.date,
          description: t.description
        }))
    });

    // Remove the transactions array before returning
    const { transactions: _, ...finalStats } = stats;
    return finalStats;
  }, [selectedCars, transactions, timeRange, cars]);

  const getMonthlyStats = useCallback(() => {
    console.log('getMonthlyStats called with:', {
      totalTransactions: transactions.length,
      selectedCars,
      selectedYear: timeRange.selectedYear,
      timeRange
    });

    // Create a Set to track processed transaction IDs
    const processedTransactionIds = new Set<string>();

    // Log all revenue transactions before filtering
    console.log('All revenue transactions before filtering:', 
      transactions
        .filter(t => t.type === 'revenue')
        .map(t => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          carId: t.carId,
          type: t.type,
          category: t.category,
          description: t.description
        }))
    );

    const filteredTransactions = transactions.filter(transaction => {
      // Skip if we've already processed this transaction ID
      if (processedTransactionIds.has(transaction.id)) {
        console.log('Skipping duplicate transaction:', {
          id: transaction.id,
          date: transaction.date,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category
        });
        return false;
      }

      // Use UTC date to avoid timezone issues
      const date = new Date(transaction.date + 'T00:00:00Z');
      const transactionYear = date.getUTCFullYear();
      const isSelectedCar = selectedCars.includes(transaction.carId);
      
      // Find the car for this transaction
      const car = cars.find(c => c.id === transaction.carId);
      
      // Log why a transaction is being excluded
      if (!isSelectedCar) {
        console.log('Excluding transaction - car not selected:', {
          id: transaction.id,
          carId: transaction.carId,
          date: transaction.date,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category
        });
        return false;
      }
      
      if (car && car.name.trim() === "Mitsubishi Mirage 2019") {
        console.log('Excluding Mirage transaction:', {
          id: transaction.id,
          date: transaction.date,
          amount: transaction.amount
        });
        return false;
      }

      // Include all years if selectedYear is 0
      const shouldInclude = timeRange.selectedYear === 0 || transactionYear === timeRange.selectedYear;
      if (!shouldInclude) {
        console.log('Excluding transaction - wrong year:', {
          id: transaction.id,
          date: transaction.date,
          year: transactionYear,
          selectedYear: timeRange.selectedYear
        });
        return false;
      }
      
      processedTransactionIds.add(transaction.id);
      return true;
    });

    // Log filtered revenue transactions
    console.log('Revenue transactions after filtering:', 
      filteredTransactions
        .filter(t => t.type === 'revenue')
        .map(t => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          carId: t.carId,
          type: t.type,
          category: t.category,
          description: t.description
        }))
    );

    const monthlyStats = new Array(12).fill(null).map((_, index) => ({
      month: index,
      totalRevenue: 0,
      totalExpenses: 0,
      profit: 0,
      transactions: [] as { id: string; amount: number; type: string; date: string; description: string }[]
    }));

    // Process transactions
    filteredTransactions.forEach(transaction => {
      // Use UTC date for month calculation
      const date = new Date(transaction.date + 'T00:00:00Z');
      const month = date.getUTCMonth();
      const amount = Number(transaction.amount) || 0;

      if (transaction.type === 'revenue' && (transaction.category === 'trip_earnings' || transaction.category === 'insurance_claim')) {
        // For revenue, count both trip earnings and insurance claims
        monthlyStats[month].totalRevenue += amount;
        monthlyStats[month].transactions.push({
          id: transaction.id,
          amount,
          type: 'revenue',
          date: transaction.date,
          description: transaction.description || ''
        });
        
        // Log each revenue addition with more details
        console.log(`Adding revenue to month ${month + 1}:`, {
          id: transaction.id,
          amount,
          date: transaction.date,
          type: transaction.type,
          category: transaction.category,
          description: transaction.description,
          newTotal: monthlyStats[month].totalRevenue
        });
      } else if (transaction.type === 'expense') {
        monthlyStats[month].totalExpenses += amount;
        monthlyStats[month].transactions.push({
          id: transaction.id,
          amount,
          type: 'expense',
          date: transaction.date,
          description: transaction.description || ''
        });
      }
      monthlyStats[month].profit = monthlyStats[month].totalRevenue - monthlyStats[month].totalExpenses;
    });

    // Log final monthly totals
    console.log('Final monthly totals:', monthlyStats.map((stats, month) => ({
      month: month + 1,
      revenue: stats.totalRevenue,
      expenses: stats.totalExpenses,
      profit: stats.profit,
      transactionCount: stats.transactions.length
    })));

    // Remove the transactions array before returning
    return monthlyStats.map(({ transactions, ...rest }) => rest);
  }, [selectedCars, transactions, timeRange, cars]);

  const getCarROI = useCallback((carId: string): CarROI => {
    const car = cars.find(c => c.id === carId);
    if (!car) throw new Error(`Car with id ${carId} not found`);

    // Get all transactions for this car (no time range filter)
    const carTransactions = transactions.filter(t => t.carId === carId);
    
    // Calculate lifetime revenue and expenses
    const totalRevenue = carTransactions
      .filter(t => t.type === 'revenue' && (t.category === 'trip_earnings' || t.category === 'insurance_claim'))
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = carTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const rentalProfit = totalRevenue - totalExpenses;

    // Simple date calculation approach
    let monthsOwned = 0;
    if (car.purchaseDate) {
      // Log the raw dates first
      console.log('Raw dates:', {
        purchaseDate: car.purchaseDate,
        saleDate: car.saleDate
      });

      // Parse dates directly from YYYY-MM-DD format
      const [pYear, pMonth, pDay] = car.purchaseDate.split('-').map(Number);
      
      let endYear: number, endMonth: number, endDay: number;
      
      if (car.saleDate) {
        [endYear, endMonth, endDay] = car.saleDate.split('-').map(Number);
      } else {
        const now = new Date();
        endYear = now.getFullYear();
        endMonth = now.getMonth() + 1; // JavaScript months are 0-based
        endDay = now.getDate();
      }

      // Log parsed date components
      console.log('Parsed date components:', {
        purchase: { year: pYear, month: pMonth, day: pDay },
        end: { year: endYear, month: endMonth, day: endDay }
      });

      // Calculate months between dates
      monthsOwned = (endYear - pYear) * 12 + (endMonth - pMonth);
      
      // Adjust for partial months based on day of month
      if (endDay < pDay) {
        monthsOwned--;
      }

      // Log the calculation details
      console.log('Months calculation:', {
        yearDiff: endYear - pYear,
        monthDiff: endMonth - pMonth,
        dayAdjustment: endDay < pDay ? -1 : 0,
        finalMonths: monthsOwned
      });
    }

    const totalInvestment = car.purchasePrice;
    const saleValue = car.salePrice || 0;
    const totalProfit = rentalProfit + (saleValue - totalInvestment);
    const totalROI = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    const monthlyROI = monthsOwned > 0 ? totalROI / monthsOwned : 0;

    // Log final calculations
    console.log('Final ROI Calculations:', {
      carName: car.name,
      monthsOwned,
      totalRevenue,
      totalExpenses,
      rentalProfit,
      totalInvestment,
      saleValue,
      totalProfit,
      totalROI,
      monthlyROI
    });

    return {
      totalRevenue,
      totalExpenses,
      profit: totalProfit,
      purchasePrice: car.purchasePrice,
      salePrice: car.salePrice ?? undefined,
      totalROI,
      monthlyROI,
      status: car.saleType ? car.saleType === 'totaled' ? 'totaled' : 'sold' : 'active'
    };
  }, [cars, transactions]);

  const refreshCars = useCallback(async () => {
    try {
      const carsRef = collection(db, 'cars');
      const querySnapshot = await getDocs(carsRef);
      const updatedCars = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Use the same date conversion logic
        const convertToISOString = (field: any) => {
          if (!field) return null;
          try {
            if (field instanceof Timestamp) {
              return field.toDate().toISOString().split('T')[0];
            }
            if (typeof field === 'string') {
              // Ensure the string is in YYYY-MM-DD format
              const date = new Date(field);
              if (isNaN(date.getTime())) {
                console.error('Invalid date string:', field);
                return null;
              }
              return date.toISOString().split('T')[0];
            }
            if (field instanceof Date) {
              return field.toISOString().split('T')[0];
            }
            console.error('Unhandled date field type:', typeof field, field);
            return null;
          } catch (error) {
            console.error('Error converting date:', error, field);
            return null;
          }
        };

        const car = {
          id: doc.id,
          ...data,
          purchaseDate: convertToISOString(data.purchaseDate),
          saleDate: convertToISOString(data.saleDate)
        } as Car;  // Type assertion to Car
        console.log('Processed car dates:', {
          id: car.id,
          name: car.name,
          purchaseDate: car.purchaseDate,
          saleDate: car.saleDate,
          rawPurchaseDate: data.purchaseDate,
          rawSaleDate: data.saleDate
        });
        return car;
      }) as Car[];
      setCars(updatedCars);
    } catch (error) {
      console.error('Error refreshing cars:', error);
    }
  }, []);

  const refreshTransactions = useCallback(async () => {
    try {
      const allTransactions = await getTransactions();
      setTransactions(allTransactions);
      console.log('Refreshed transactions:', allTransactions.length);
    } catch (error) {
      console.error('Error refreshing transactions:', error);
    }
  }, []);

  if (!isClient) {
    return <LoadingState />;
  }

  return (
    <TuroContext.Provider value={{
      cars,
      transactions,
      selectedCars,
      timeFilter,
      timeRange,
      addCar,
      removeCar,
      updateCar,
      addTransaction,
      toggleCarSelection,
      setTimeFilter,
      setTimeRange,
      getCarStats,
      getFleetStats,
      getMonthlyStats,
      setSelectedYear,
      getCarROI,
      refreshCars,
      refreshTransactions
    }}>
      {children}
    </TuroContext.Provider>
  );
}

export function useTuro() {
  const context = useContext(TuroContext);
  if (context === undefined) {
    throw new Error('useTuro must be used within a TuroProvider');
  }
  return context;
} 