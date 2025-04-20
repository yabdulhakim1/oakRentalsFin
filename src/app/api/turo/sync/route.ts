import { NextResponse } from 'next/server';
import { addTransactionsBatch, addCar } from '@/app/lib/firebase/firebaseUtils';
import { parse } from 'csv-parse/sync';
import { Transaction } from '@/app/lib/types/turo';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase/firebase';

interface TuroTrip {
  'Reservation ID': string;
  'Guest': string;
  'Vehicle': string;
  'Vehicle name': string;
  'Trip start': string;
  'Trip end': string;
  'Total earnings': string;
}

// Add proper type for transactions and cars
type TransactionType = 'revenue' | 'expense';
type TransactionCategory = 'trip_earnings' | 'maintenance' | 'insurance' | 'other' | 'insurance_claim';

interface Car {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  status: string;
  purchaseDate?: string;
  purchasePrice?: number;
}

// This is now just a fallback list for legacy support
const LEGACY_CARS = [
  { name: 'Toyota Yaris iA', make: 'Toyota', model: 'Yaris iA', year: 2018 },
  { name: 'Volkswagen Jetta', make: 'Volkswagen', model: 'Jetta', year: 2016 },
  { name: 'Chevrolet Cruze Limited', make: 'Chevrolet', model: 'Cruze Limited', year: 2016 },
  { name: 'Toyota Yaris', make: 'Toyota', model: 'Yaris', year: 2014 },
  { name: 'Mitsubishi Mirage G4', make: 'Mitsubishi', model: 'Mirage G4', year: 2018 },
  { name: 'Toyota Corolla', make: 'Toyota', model: 'Corolla', year: 2014 },
  { name: 'Toyota Prius c', make: 'Toyota', model: 'Prius c', year: 2013 },
  { name: 'Mitsubishi Mirage', make: 'Mitsubishi', model: 'Mirage', year: 2017 },
  { name: 'FIAT 500', make: 'FIAT', model: '500', year: 2014 }
];

// New function to get all cars from the database
async function getAllCars(): Promise<Car[]> {
  const carsRef = collection(db, 'cars');
  const snapshot = await getDocs(carsRef);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<Car, 'id'>)
  }));
}

async function getCarInfo(vehicleName: string) {
  console.log('Getting car info for:', vehicleName);
  
  // Get all existing cars from the database
  const existingCars = await getAllCars();
  console.log('Existing cars in database:', existingCars.map(c => c.name));

  // First try exact match with existing cars in the database
  let matchingCar = existingCars.find(car => car.name === vehicleName);

  // If no exact match, try matching by name and license plate separately
  if (!matchingCar) {
    // Extract license plate from vehicle name if present
    const vehicleLicensePlate = vehicleName.match(/\(([^)]+)\)/)?.[1];
    
    matchingCar = existingCars.find(car => {
      const carLicensePlate = car.name.match(/\(([^)]+)\)/)?.[1];
      return carLicensePlate && carLicensePlate === vehicleLicensePlate;
    });
  }

  if (matchingCar) {
    console.log('Found matching car in database:', matchingCar);
    return {
      name: matchingCar.name,
      make: matchingCar.make,
      model: matchingCar.model,
      year: matchingCar.year,
      status: matchingCar.status || 'active'
    };
  }

  // If no match in database, try legacy list
  console.log('No match in database, trying legacy list');
  const legacyCar = LEGACY_CARS.find(car => vehicleName.includes(car.name));
  
  if (legacyCar) {
    console.log('Found matching car in legacy list:', legacyCar);
    return {
      name: legacyCar.name,
      make: legacyCar.make,
      model: legacyCar.model,
      year: legacyCar.year,
      status: 'active'
    };
  }

  console.error('No matching car found for:', vehicleName);
  return null;
}

function parseTuroDate(dateString: string): string {
  try {
    // The date is already in YYYY-MM-DD format, just extract the date part
    const match = dateString.match(/(\d{4}-\d{2}-\d{2})/);
    if (!match) {
      throw new Error(`Could not extract date from: ${dateString}`);
    }
    const dateOnly = match[1];
    console.log('Parsed date:', { input: dateString, output: dateOnly });
    return dateOnly;
  } catch (error) {
    console.error('Error parsing date:', error);
    throw error;
  }
}

function splitTransactionAcrossMonths(
  startDate: string,
  endDate: string,
  totalAmount: number,
  tripDays: number,
  baseTransaction: Omit<Transaction, 'id' | 'amount' | 'date'>
): Array<Omit<Transaction, 'id'>> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const transactions: Array<Omit<Transaction, 'id'>> = [];

  // If start and end are in the same month, return single transaction
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return [{
      ...baseTransaction,
      amount: totalAmount,
      date: startDate,
      tripEnd: endDate,
      tripDays: tripDays
    }];
  }

  // Calculate daily rate
  const dailyRate = totalAmount / tripDays;

  let currentDate = new Date(start);
  let daysProcessed = 0;

  while (currentDate <= end) {
    const monthStart = new Date(currentDate);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const endOfPeriod = monthEnd < end ? monthEnd : end;
    
    // Calculate days in this month's portion (exclusive of end date except for last period)
    const isLastPeriod = endOfPeriod >= end;
    const daysInPeriod = isLastPeriod
      ? tripDays - daysProcessed  // Use remaining days for last period
      : Math.ceil((endOfPeriod.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    const amountForPeriod = dailyRate * daysInPeriod;

    transactions.push({
      ...baseTransaction,
      amount: Number(amountForPeriod.toFixed(2)),
      date: currentDate.toISOString().split('T')[0],
      tripEnd: endDate,
      tripDays: tripDays,
      description: `${baseTransaction.description} (${daysInPeriod} of ${tripDays} days)`
    });

    daysProcessed += daysInPeriod;
    
    // Move to first day of next month
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }

  // Verify total amount matches (accounting for rounding)
  const totalCalculated = transactions.reduce((sum, t) => sum + t.amount, 0);
  if (Math.abs(totalCalculated - totalAmount) > 0.01) {
    console.log('Adjusting for rounding difference:', {
      original: totalAmount,
      calculated: totalCalculated,
      difference: totalAmount - totalCalculated
    });
    // Add any rounding difference to the last transaction
    transactions[transactions.length - 1].amount += Number((totalAmount - totalCalculated).toFixed(2));
  }

  return transactions;
}

export async function POST(request: Request) {
  try {
    console.log('Starting CSV processing...');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    const text = await file.text();
    console.log('CSV content:', text); // Log the entire CSV since we only have one row

    const records = parse(text, {
      columns: true,
      skip_empty_lines: true
    }) as TuroTrip[];

    console.log(`Parsed ${records.length} records from CSV`);
    if (records.length > 0) {
      console.log('Record:', JSON.stringify(records[0], null, 2));
    }

    // Process transactions first
    const transactions: Array<{
      carId: string;
      type: TransactionType;
      amount: number;
      date: string;
      category: TransactionCategory;
      description: string;
    }> = [];

    // Map to store car IDs
    const carIdMap = new Map<string, string>();

    for (const record of records) {
      try {
        console.log('Processing record:', {
          reservationId: record['Reservation ID'],
          vehicleName: record['Vehicle name'],
          tripStart: record['Trip start'],
          tripEnd: record['Trip end'],
          earnings: record['Total earnings']
        });

        if (!record['Trip start'] || !record['Trip end'] || !record['Total earnings'] || !record['Vehicle name']) {
          console.warn('Skipping record with missing data:', record);
          continue;
        }

        // Get car info and ID
        let carId: string;
        if (carIdMap.has(record['Vehicle name'])) {
          carId = carIdMap.get(record['Vehicle name'])!;
        } else {
          // Extract license plate from the Vehicle field
          const licensePlateMatch = record['Vehicle'].match(/\(.*#([A-Z0-9]+)\)/);
          const licensePlate = licensePlateMatch ? licensePlateMatch[1] : '';
          console.log('Extracted license plate:', { vehicle: record['Vehicle'], licensePlate });

          // First try to find existing car by exact name or license plate
          const existingCars = await getAllCars();
          let existingCar = existingCars.find(car => 
            car.name === record['Vehicle name'] || 
            (licensePlate && car.name.includes(`(${licensePlate})`))
          );

          if (existingCar) {
            carId = existingCar.id;
            console.log('Found existing car:', { name: existingCar.name, id: carId });
          } else {
            // If no existing car found, get car info from legacy list
            const carInfo = await getCarInfo(record['Vehicle name']);
            if (!carInfo) {
              console.warn('Could not get car info for:', record['Vehicle name']);
              continue;
            }

            // Format the car name with the actual license plate from the CSV
            carInfo.name = licensePlate 
              ? `${carInfo.name} (${licensePlate})`
              : carInfo.name;

            // Add the new car
            carId = await addCar({
              ...carInfo,
              purchaseDate: new Date().toISOString(),
              purchasePrice: 0,
              status: 'active' as const
            });
            console.log('Added new car:', { name: carInfo.name, id: carId });
          }
          
          carIdMap.set(record['Vehicle name'], carId);
        }

        // Parse dates
        const startDate = parseTuroDate(record['Trip start']);
        const endDate = parseTuroDate(record['Trip end']);
        
        // Calculate trip days
        const start = new Date(startDate);
        const end = new Date(endDate);
        const tripDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        console.log('Trip details:', { 
          startDate, 
          endDate, 
          tripDays,
          earnings: record['Total earnings']
        });

        // Parse earnings
        const earnings = parseFloat(record['Total earnings'].replace(/[$,]/g, ''));
        if (isNaN(earnings) || earnings <= 0) {
          console.warn('Invalid earnings:', record['Total earnings']);
          continue;
        }

        // Create base transaction object
        const baseTransaction = {
          carId,
          type: 'revenue' as TransactionType,
          category: 'trip_earnings' as TransactionCategory,
          description: `Trip earnings for ${record['Reservation ID']}`
        };

        // Split transaction across months if needed
        const splitTransactions = splitTransactionAcrossMonths(
          startDate,
          endDate,
          earnings,
          tripDays,
          baseTransaction
        );

        console.log('Split transactions:', splitTransactions);
        transactions.push(...splitTransactions);

      } catch (err) {
        console.error('Error processing record:', err);
      }
    }

    console.log(`Created ${transactions.length} transactions`);
    if (transactions.length > 0) {
      console.log('Transaction to save:', JSON.stringify(transactions[0], null, 2));
    }

    if (transactions.length > 0) {
      try {
        await addTransactionsBatch(transactions);
        console.log('Successfully saved all transactions to Firebase');
      } catch (error) {
        console.error('Error saving transactions:', error);
        throw error;
      }
    } else {
      console.warn('No valid transactions to save');
    }

    return new Response(JSON.stringify({
      message: 'Successfully imported data',
      transactionCount: transactions.length,
      sampleTransactions: transactions.slice(0, 2)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process CSV file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500 });
  }
} 