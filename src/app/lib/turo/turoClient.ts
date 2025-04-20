import { Car, Transaction } from '../types/turo';
import { getCarByName, addCar } from '../firebase/firebaseUtils';

interface TuroSession {
  token: string;
  userId: string;
  expiresAt: number;
}

interface TuroTrip {
  id: string;
  status: string;
  vehicle: {
    id: string;
    name: string;
    make: string;
    model: string;
    year: number;
  };
  startTime: string;
  endTime: string;
  earnings: {
    ownerEarnings: number;
    tripFee: number;
  };
}

export class TuroClient {
  private baseUrl = 'https://turo.com';
  private session: TuroSession | null = null;

  constructor() {}

  async loginWithGoogle(googleToken: string) {
    try {
      // First, exchange Google token for Turo token
      const response = await fetch(`${this.baseUrl}/api/2016-03-01/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Origin': 'https://turo.com',
          'Referer': 'https://turo.com/',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        body: JSON.stringify({
          'credential': {
            'id_token': googleToken,
            'provider': 'google'
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Turo login response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        throw new Error(`Failed to login to Turo: ${errorText}`);
      }

      const data = await response.json();
      console.log('Turo login successful:', data);
      
      this.session = {
        token: data.access_token || data.token || data.authToken,
        userId: data.user_id || data.userId || data.id,
        expiresAt: Date.now() + ((data.expires_in || 3600) * 1000)
      };

      return this.session;
    } catch (error) {
      console.error('Detailed login error:', error);
      throw error;
    }
  }

  private async ensureAuth() {
    if (!this.session || Date.now() > this.session.expiresAt) {
      throw new Error('Not authenticated. Please sign in with Google.');
    }
  }

  async getTrips(startDate?: Date, endDate?: Date): Promise<TuroTrip[]> {
    await this.ensureAuth();

    try {
      const params = new URLSearchParams();
      if (startDate) {
        params.append('startTime[min]', startDate.toISOString());
      }
      if (endDate) {
        params.append('startTime[max]', endDate.toISOString());
      }
      params.append('status', 'completed');

      const response = await fetch(
        `${this.baseUrl}/api/2016-03-01/trips?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.session!.token}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Origin': 'https://turo.com',
            'Referer': 'https://turo.com/'
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Turo trips error:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        throw new Error(`Failed to fetch trips: ${errorText}`);
      }

      const data = await response.json();
      return data.trips || [];
    } catch (error) {
      console.error('Detailed trips error:', error);
      throw error;
    }
  }

  async convertTripToTransaction(trip: TuroTrip): Promise<Omit<Transaction, 'id'>> {
    const car = await this.getOrCreateCar(trip.vehicle);
    
    return {
      carId: car.id,
      date: new Date(trip.startTime).toISOString(),
      type: 'revenue',
      amount: trip.earnings.ownerEarnings,
      description: `Turo trip ${trip.id}`,
      category: 'turo_trip'
    };
  }

  private async getOrCreateCar(vehicle: TuroTrip['vehicle']): Promise<Car> {
    // First try to find the car by name
    const existingCar = await getCarByName(vehicle.name);
    if (existingCar) {
      return existingCar;
    }

    // If car doesn't exist, create it
    const carData: Omit<Car, 'id'> = {
      name: vehicle.name,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      isActive: true,
      purchasePrice: 0,
      status: 'active'
    };

    const carId = await addCar(carData);
    return { ...carData, id: carId };
  }
}

// Create and export a singleton instance
export const turoClient = new TuroClient(); 