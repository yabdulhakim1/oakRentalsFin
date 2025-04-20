export interface Transaction {
  id: string;
  carId: string;
  type: 'revenue' | 'expense';
  amount: number;
  date: string;
  description: string;
  category: 'trip_earnings' | 'maintenance' | 'insurance' | 'insurance_claim' | 'other';
  tripId?: string;
  createdAt: string;
  tripEnd?: string;
  tripDays?: number;
  isManual?: boolean;
  lastUpdateSource: string;
  parentId?: string;
  isParent?: boolean;
  severity: 'normal' | 'high' | 'low';
}

export interface Car {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  purchasePrice: number;
  purchaseDate?: string | null;
  saleDate?: string | null;
  salePrice?: number | null;
  saleType?: 'sold' | 'totaled' | null;
  status?: 'active' | 'sold' | 'totaled';
}

export interface CarStats {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
}

export interface MonthlyStats {
  month: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
}

export interface CarROI {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  purchasePrice: number;
  salePrice?: number;
  totalROI: number;
  monthlyROI: number;
  status: 'active' | 'sold' | 'totaled';
}

export type TimeFilter = 'all' | 'year' | 'month' | 'week' | 'custom';

export interface TimeRange {
  selectedYear: number;
  startDate: string;
  endDate: string;
} 