'use client';

import { TuroProvider } from './lib/contexts/TuroContext';
import DashboardLayout from './components/DashboardLayout';
import CarManager from './components/CarManager';
import TransactionManager from './components/TransactionManager';
import FleetSummary from './components/FleetSummary';
import TimeFilter from './components/TimeFilter';
import ExpenseImporter from './components/ExpenseImporter';
import TransactionBreakdown from './components/TransactionBreakdown';
import CarDeletion from './components/CarDeletion';

export default function Home() {
  return (
    <TuroProvider>
      <main className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto space-y-8">
          <h1 className="text-3xl font-bold text-gray-900 p-8">Turo Fleet Management</h1>
          
          <TimeFilter />
          <FleetSummary />
          
          <DashboardLayout />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
            <div className="space-y-4">
              <CarManager />
              <ExpenseImporter />
              <CarDeletion />
            </div>
            <div className="space-y-4">
              <TransactionManager />
            </div>
          </div>
          <TransactionBreakdown />
        </div>
      </main>
    </TuroProvider>
  );
}
