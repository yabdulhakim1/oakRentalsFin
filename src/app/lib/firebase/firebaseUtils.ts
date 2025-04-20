import { db, analytics } from '@/app/lib/firebase/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp, CollectionReference, Query, doc, writeBatch, deleteDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { logEvent, Analytics } from 'firebase/analytics';
import { Transaction, Car } from '../types/turo';

// Helper function to handle Firestore errors
const handleFirestoreError = (error: any, operation: string) => {
  console.error(`Firebase ${operation} error:`, error);
  if (error.code === 'permission-denied') {
    throw new Error('You do not have permission to perform this operation.');
  } else if (error.code === 'unavailable') {
    throw new Error('The service is currently unavailable. Please try again later.');
  } else {
    throw new Error(`An error occurred while ${operation}. Please try again.`);
  }
};

// Helper function to log analytics events with error handling
const logAnalyticsEvent = (eventName: string, eventParams?: Record<string, any>) => {
  if (analytics) {
    try {
      logEvent(analytics as Analytics, eventName, eventParams);
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }
};

export async function addTransaction(transaction: Omit<Transaction, 'id'>) {
  try {
    const docRef = await addDoc(collection(db, 'transactions'), {
      ...transaction,
      date: Timestamp.fromDate(new Date(transaction.date)),
      createdAt: Timestamp.now()
    });

    logAnalyticsEvent('add_transaction', {
      carId: transaction.carId,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      timestamp: new Date().toISOString()
    });

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, 'adding transaction');
  }
}

// Helper function to check and update existing transaction
async function checkAndUpdateTransaction(transaction: Omit<Transaction, 'id'> & { id?: string }): Promise<{ 
  exists: boolean; 
  updated: boolean; 
  id?: string;
}> {
  try {
    const transactionsRef = collection(db, 'transactions');
    let existingTransaction = null;

    // If we have a tripId, use it for exact matching
    if (transaction.tripId) {
      const q = query(
        transactionsRef,
        where('tripId', '==', transaction.tripId),
        where('carId', '==', transaction.carId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        existingTransaction = {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data()
        } as Transaction;
      }
    }

    // If no match found by tripId, check by date and carId
    if (!existingTransaction) {
      const q = query(
        transactionsRef,
        where('carId', '==', transaction.carId),
        where('date', '==', Timestamp.fromDate(new Date(transaction.date)))
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        existingTransaction = {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data()
        } as Transaction;
      }
    }

    // If no existing transaction found, return exists: false
    if (!existingTransaction) {
      return { exists: false, updated: false };
    }

    // Check if the transaction needs updating
    const needsUpdate = 
      existingTransaction.amount !== transaction.amount ||
      existingTransaction.date !== transaction.date ||
      (transaction.tripEnd && existingTransaction.tripEnd !== transaction.tripEnd);

    if (needsUpdate) {
      // Update the existing transaction
      const docRef = doc(transactionsRef, existingTransaction.id);
      await updateDoc(docRef, {
        amount: transaction.amount,
        date: Timestamp.fromDate(new Date(transaction.date)),
        ...(transaction.tripEnd && { tripEnd: transaction.tripEnd }),
        lastUpdated: serverTimestamp(),
        lastUpdateSource: 'csv_import'
      });
      console.log(`Updated transaction ${existingTransaction.id}:`, {
        oldAmount: existingTransaction.amount,
        newAmount: transaction.amount,
        oldDate: existingTransaction.date,
        newDate: transaction.date
      });
      return { exists: true, updated: true, id: existingTransaction.id };
    }

    return { exists: true, updated: false, id: existingTransaction.id };
  } catch (error) {
    console.error('Error checking/updating transaction:', error);
    return { exists: false, updated: false };
  }
}

export async function addTransactionsBatch(transactions: Array<Omit<Transaction, 'id'> & { id?: string }>) {
  try {
    console.log('Starting addTransactionsBatch with', transactions.length, 'transactions');
    
    const batchSize = 500;
    const transactionsRef = collection(db, 'transactions');
    let totalSaved = 0;
    let totalSkipped = 0;
    let totalUpdated = 0;
    let savedIds: string[] = [];

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchTransactions = transactions.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(transactions.length / batchSize)}`);
      
      for (const transaction of batchTransactions) {
        // Check for existing transaction and if it needs updating
        const { exists, updated, id } = await checkAndUpdateTransaction(transaction);
        
        if (exists) {
          if (updated) {
            totalUpdated++;
            savedIds.push(id!);
            console.log(`Updated existing transaction: carId=${transaction.carId}, tripId=${transaction.tripId}, date=${transaction.date}`);
          } else {
            totalSkipped++;
            console.log(`Skipped unchanged transaction: carId=${transaction.carId}, tripId=${transaction.tripId}, date=${transaction.date}`);
          }
          continue;
        }

        // Generate document reference with custom ID if provided
        const docRef = transaction.id ? 
          doc(transactionsRef, transaction.id) : 
          doc(transactionsRef);

        // Convert the date string to a Timestamp
        const dateObj = new Date(transaction.date);
        const transactionData = {
          ...transaction,
          amount: Number(transaction.amount),
          date: Timestamp.fromDate(dateObj),
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          lastUpdateSource: 'csv_import'
        };
        
        console.log(`Adding new transaction ${i + totalSaved + 1}:`, {
          id: docRef.id,
          ...transactionData,
          date: dateObj.toISOString(),
          amount: transactionData.amount
        });
        
        batch.set(docRef, transactionData);
        savedIds.push(docRef.id);
        totalSaved++;
      }

      if (totalSaved > 0) {  // Only commit if there are new transactions to save
        console.log(`Committing batch ${Math.floor(i / batchSize) + 1}...`);
        await batch.commit();
        console.log(`Successfully committed batch. Total saved: ${totalSaved}, Total updated: ${totalUpdated}, Total skipped: ${totalSkipped}`);
      }
    }

    console.log(`Import complete. Added ${totalSaved} new transactions, updated ${totalUpdated} existing transactions, skipped ${totalSkipped} unchanged transactions.`);
    return { totalSaved, totalUpdated, totalSkipped, savedIds };
  } catch (error) {
    console.error('Error in addTransactionsBatch:', error);
    throw error;
  }
}

// Helper function to check for duplicate transactions
async function checkForDuplicateTransaction(transaction: Omit<Transaction, 'id'> & { id?: string }): Promise<boolean> {
  try {
    const transactionsRef = collection(db, 'transactions');
    
    // Build query to check for duplicates
    let q = query(
      transactionsRef,
      where('carId', '==', transaction.carId),
      where('date', '==', Timestamp.fromDate(new Date(transaction.date)))
    );

    if (transaction.tripId) {
      // If it's a Turo import (has tripId), check for matching tripId
      q = query(
        transactionsRef,
        where('tripId', '==', transaction.tripId),
        where('carId', '==', transaction.carId)
      );
    }

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking for duplicate transaction:', error);
    return false;
  }
}

export async function getTransactions(carId?: string) {
  try {
    console.log('Getting transactions with params:', { carId });
    let baseQuery: CollectionReference | Query = collection(db, 'transactions');
    
    if (carId) {
      baseQuery = query(baseQuery, where('carId', '==', carId));
    }
    
    const q = query(baseQuery, orderBy('date', 'desc'));
    
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.size} transactions`);
    
    const transactions = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Convert Timestamp back to ISO string
      const dateStr = data.date instanceof Timestamp ? 
        data.date.toDate().toISOString() : 
        new Date(data.date).toISOString();
      
      return {
        id: doc.id,
        ...data,
        date: dateStr,
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString()
      };
    }) as Transaction[];

    console.log('Processed transactions:', transactions.length);
    console.log('Sample transaction:', transactions[0]);

    return transactions;
  } catch (error) {
    console.error('Error getting transactions:', error);
    handleFirestoreError(error, 'fetching transactions');
    return [];
  }
}

export async function getTransactionsByDateRange(startDate: Date, endDate: Date, carId?: string) {
  try {
    console.log('Getting transactions by date range:', { startDate, endDate, carId });
    let baseQuery: CollectionReference | Query = collection(db, 'transactions');
    
    if (carId) {
      baseQuery = query(baseQuery, where('carId', '==', carId));
    }
    
    const q = query(
      baseQuery,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.size} transactions in date range`);
    
    const transactions = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate().toISOString(),
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString()
      };
    }) as Transaction[];

    console.log('Sample transaction from date range:', transactions[0]);
    return transactions;
  } catch (error) {
    console.error('Error getting transactions by date range:', error);
    handleFirestoreError(error, 'fetching transactions by date range');
    return [];
  }
}

// New function to delete transactions
export async function deleteTransactions(transactionIds: string[]) {
  try {
    console.log('Attempting to delete transactions:', transactionIds);
    const batch = writeBatch(db);
    let deletedCount = 0;
    
    // Verify each transaction exists before attempting to delete
    for (const id of transactionIds) {
      const docRef = doc(db, 'transactions', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        batch.delete(docRef);
        deletedCount++;
      } else {
        console.warn(`Transaction ${id} not found, skipping deletion`);
      }
    }

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Successfully deleted ${deletedCount} transactions`);
    } else {
      console.log('No transactions found to delete');
    }

    logAnalyticsEvent('delete_transactions', {
      count: deletedCount,
      timestamp: new Date().toISOString()
    });

    return { success: true, deletedCount };
  } catch (error) {
    console.error('Error deleting transactions:', error);
    handleFirestoreError(error, 'deleting transactions');
    return { success: false, error };
  }
}

export async function addCar(car: Omit<Car, 'id'>) {
  try {
    // Check if car already exists
    const carsRef = collection(db, 'cars');
    const q = query(carsRef, where('name', '==', car.name));
    const querySnapshot = await getDocs(q);
    
    // If car doesn't exist, add it
    if (querySnapshot.empty) {
      const docRef = await addDoc(carsRef, {
        ...car,
        purchaseDate: Timestamp.fromDate(new Date(car.purchaseDate)),
        saleDate: car.saleDate ? Timestamp.fromDate(new Date(car.saleDate)) : null,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    }
    
    return querySnapshot.docs[0].id;
  } catch (error) {
    console.error('Error adding car:', error);
    throw error;
  }
}

export async function getCarByName(name: string): Promise<Car | null> {
  try {
    const carsRef = collection(db, 'cars');
    
    // Extract car name without license plate if it exists
    const carNameWithoutPlate = name.split('(')[0].trim();
    
    // First try exact match with full name (including plate)
    let q = query(carsRef, where('name', '==', name));
    let querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Try match with just the car name without plate
      q = query(carsRef, where('name', '==', carNameWithoutPlate));
      querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // If still no match, try to match by make and model
        const nameParts = carNameWithoutPlate.split(' ');
        if (nameParts.length >= 2) {
          const make = nameParts[0];
          const model = nameParts.slice(1).join(' ');
          q = query(carsRef, 
            where('make', '==', make),
            where('model', '==', model)
          );
          querySnapshot = await getDocs(q);
        }
        
        if (querySnapshot.empty) {
          return null;
        }
      }
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      purchaseDate: data.purchaseDate?.toDate().toISOString() || null,
      saleDate: data.saleDate?.toDate().toISOString() || null
    } as Car;
  } catch (error) {
    handleFirestoreError(error, 'getting car by name');
    return null;
  }
}

export async function clearAllData() {
  try {
    // Delete all transactions
    const transactionsRef = collection(db, 'transactions');
    const transactionSnapshot = await getDocs(transactionsRef);
    const transactionBatch = writeBatch(db);
    
    transactionSnapshot.docs.forEach((doc) => {
      transactionBatch.delete(doc.ref);
    });
    await transactionBatch.commit();
    console.log('All transactions deleted');

    // Delete all cars
    const carsRef = collection(db, 'cars');
    const carSnapshot = await getDocs(carsRef);
    const carBatch = writeBatch(db);
    
    carSnapshot.docs.forEach((doc) => {
      carBatch.delete(doc.ref);
    });
    await carBatch.commit();
    console.log('All cars deleted');

    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

export async function getTransactionByTripId(tripTransactionId: string): Promise<Transaction | null> {
  try {
    const transactionRef = doc(db, 'transactions', tripTransactionId);
    const transactionDoc = await getDoc(transactionRef);
    
    if (transactionDoc.exists()) {
      return {
        id: transactionDoc.id,
        ...transactionDoc.data()
      } as Transaction;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting transaction by trip ID:', error);
    return null;
  }
}

export async function bulkImportExpenses(csvData: string[][]) {
  let batch = writeBatch(db);
  let processedCount = 0;
  let skippedCount = 0;
  let errors: string[] = [];

  try {
    // Get headers from first row
    const headers = csvData[0];
    
    let currentDate: { month: number; year: number } | null = null;
    
    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      // Check if this is a date row (first cell contains month and year)
      if (row[0] && row[0].includes('2024') || row[0].includes('2025')) {
        // Parse date (e.g., "July 2024" or "Jan 2025")
        const dateParts = row[0].split(' ');
        const monthStr = dateParts[0];
        const year = parseInt(dateParts[1]);
        
        // Convert month string to number (0-11)
        const monthMap: { [key: string]: number } = {
          'January': 0, 'Jan': 0,
          'February': 1, 'Feb': 1,
          'March': 2, 'Mar': 2,
          'April': 3, 'Apr': 3,
          'May': 4,
          'June': 5, 'Jun': 5,
          'July': 6, 'Jul': 6,
          'August': 7, 'Aug': 7,
          'September': 8, 'Sep': 8,
          'October': 9, 'Oct': 9,
          'November': 10, 'Nov': 10,
          'December': 11, 'Dec': 11
        };
        
        currentDate = {
          month: monthMap[monthStr],
          year: year
        };
        
        continue; // Skip to next row
      }
      
      // Skip empty rows or header rows
      if (!row[0] || row[0] === '' || headers.includes(row[0])) {
        continue;
      }
      
      // If we don't have a valid date, skip this row
      if (!currentDate) {
        errors.push(`Row ${i + 1}: No valid date found before this row`);
        skippedCount++;
        continue;
      }

      // Get car by name
      const carName = row[0].trim();
      const car = await getCarByName(carName);
      if (!car) {
        console.log(`Car not found: ${carName}`);
        errors.push(`Row ${i + 1}: Car not found - ${carName}`);
        skippedCount++;
        continue;
      }

      // Process each expense column
      for (let j = 1; j < row.length; j++) {
        const amount = parseFloat(row[j]);
        const columnHeader = headers[j];
        
        // Skip if amount is 0 or invalid
        if (isNaN(amount) || amount === 0) {
          continue;
        }

        // Determine if this is an insurance claim (revenue) or expense
        const isInsuranceClaim = columnHeader.trim().toLowerCase() === 'insurance claim';
        const transactionType = isInsuranceClaim ? 'revenue' : 'expense';
        const category = isInsuranceClaim ? 'insurance_claim' : 'expense';
        
        // Debug logging for insurance claims
        if (isInsuranceClaim) {
          console.log('Processing insurance claim:', {
            carName: car.name,
            carId: car.id,
            amount,
            date: `${currentDate.year}-${String(currentDate.month + 1).padStart(2, '0')}-01`,
            columnHeader
          });
        }
        
        // Create the transaction
        const transaction = {
          carId: car.id,
          date: `${currentDate.year}-${String(currentDate.month + 1).padStart(2, '0')}-01`,
          amount: Math.abs(amount), // Store positive amount
          type: transactionType,
          category: category,
          description: columnHeader,
          createdAt: serverTimestamp()
        };

        // Debug logging for transaction creation
        console.log('Creating transaction:', {
          ...transaction,
          isInsuranceClaim,
          originalAmount: amount
        });

        // Add to batch
        const docRef = doc(collection(db, 'transactions'));
        batch.set(docRef, transaction);
        processedCount++;

        // Commit batch every 500 transactions
        if (processedCount % 500 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
    }

    // Commit any remaining transactions
    if (processedCount % 500 !== 0) {
      await batch.commit();
    }

    console.log(`Successfully processed ${processedCount} transactions. Skipped ${skippedCount} rows.`);
    return { 
      success: true, 
      processedCount, 
      skippedCount,
      errors: errors.length > 0 ? errors : undefined 
    };

  } catch (error) {
    console.error('Error in bulkImportExpenses:', error);
    throw error;
  }
}

export async function deleteAllExpenseTransactions() {
  try {
    // Query all expense transactions and insurance claim transactions
    const transactionsRef = collection(db, 'transactions');
    
    // Get expense transactions
    const expenseQuery = query(transactionsRef, where('type', '==', 'expense'));
    const expenseSnapshot = await getDocs(expenseQuery);
    
    // Get insurance claim transactions
    const insuranceClaimQuery = query(
      transactionsRef, 
      where('category', '==', 'insurance_claim')
    );
    const insuranceClaimSnapshot = await getDocs(insuranceClaimQuery);
    
    if (expenseSnapshot.empty && insuranceClaimSnapshot.empty) {
      console.log('No expense or insurance claim transactions found');
      return { success: true, deletedCount: 0 };
    }

    // Create a batch for deleting transactions
    const batch = writeBatch(db);
    let deletedCount = 0;

    // Add expense transactions to the batch
    expenseSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Add insurance claim transactions to the batch
    insuranceClaimSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Commit the batch
    await batch.commit();
    console.log(`Successfully deleted ${deletedCount} transactions (expenses and insurance claims)`);
    
    return { success: true, deletedCount };
  } catch (error: any) {
    console.error('Error deleting transactions:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteCarAndTransactions(carId: string) {
  try {
    const batch = writeBatch(db);
    
    // Delete the car document
    const carRef = doc(db, 'cars', carId);
    batch.delete(carRef);
    
    // Get all transactions for this car
    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, where('carId', '==', carId));
    const querySnapshot = await getDocs(q);
    
    // Add transaction deletions to batch
    let deletedTransactions = 0;
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedTransactions++;
    });

    // Commit the batch
    await batch.commit();
    console.log(`Successfully deleted car and ${deletedTransactions} associated transactions`);
    
    return { success: true, deletedTransactions };
  } catch (error: any) {
    console.error('Error deleting car and transactions:', error);
    return { success: false, error: error.message };
  }
}

export async function getFleetStats() {
  try {
    const transactions = await getTransactions();
    const stats = transactions.reduce((stats, transaction) => {
      const amount = Number(transaction.amount) || 0;
      if (transaction.type === 'revenue' && (transaction.category === 'trip_earnings' || transaction.category === 'insurance_claim')) {
        // For revenue, count both trip earnings and insurance claims
        stats.totalRevenue += amount;
        stats.transactions.push({
          id: transaction.id,
          carId: transaction.carId,
          type: 'revenue',
          amount,
          date: transaction.date,
          description: transaction.description || '',
          category: transaction.category
        });
      } else if (transaction.type === 'expense') {
        stats.totalExpenses += amount;
        stats.transactions.push({
          id: transaction.id,
          carId: transaction.carId,
          type: 'expense',
          amount,
          date: transaction.date,
          description: transaction.description || '',
          category: transaction.category
        });
      }
      return stats;
    }, { totalRevenue: 0, totalExpenses: 0, transactions: [] } as { totalRevenue: number; totalExpenses: number; transactions: Transaction[] });

    return stats;
  } catch (error) {
    console.error('Error getting fleet stats:', error);
    handleFirestoreError(error, 'getting fleet stats');
    return { totalRevenue: 0, totalExpenses: 0, transactions: [] };
  }
}

export async function getMonthlyStats() {
  try {
    const transactions = await getTransactions();
    const monthlyStats: { [key: number]: { totalRevenue: number; totalExpenses: number; transactions: Transaction[] } } = {};

    transactions.forEach(transaction => {
      // Use UTC date for month calculation
      const date = new Date(transaction.date + 'T00:00:00Z');
      const month = date.getUTCMonth();
      const amount = Number(transaction.amount) || 0;

      if (transaction.type === 'revenue' && (transaction.category === 'trip_earnings' || transaction.category === 'insurance_claim')) {
        // For revenue, count both trip earnings and insurance claims
        monthlyStats[month] = monthlyStats[month] || { totalRevenue: 0, totalExpenses: 0, transactions: [] };
        monthlyStats[month].totalRevenue += amount;
        monthlyStats[month].transactions.push({
          id: transaction.id,
          carId: transaction.carId,
          type: 'revenue',
          amount,
          date: transaction.date,
          description: transaction.description || '',
          category: transaction.category
        });
        
        // Log each revenue addition
        console.log(`Adding revenue to month ${month + 1}:`, {
          id: transaction.id,
          amount,
          date: transaction.date,
          category: transaction.category,
          newTotal: monthlyStats[month].totalRevenue
        });
      } else if (transaction.type === 'expense') {
        monthlyStats[month] = monthlyStats[month] || { totalRevenue: 0, totalExpenses: 0, transactions: [] };
        monthlyStats[month].totalExpenses += amount;
        monthlyStats[month].transactions.push({
          id: transaction.id,
          carId: transaction.carId,
          type: 'expense',
          amount,
          date: transaction.date,
          description: transaction.description || '',
          category: transaction.category
        });
      }
    });

    return monthlyStats;
  } catch (error) {
    console.error('Error getting monthly stats:', error);
    handleFirestoreError(error, 'getting monthly stats');
    return {};
  }
} 