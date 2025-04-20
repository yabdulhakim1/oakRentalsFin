'use client';

import React, { useState, useEffect } from 'react';
import { useTuro } from '../lib/contexts/TuroContext';
import { Transaction } from '../lib/types/turo';
import { addDoc, collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/firebase';
import { deleteTransactions } from '../lib/firebase/firebaseUtils';

interface ManualTransaction {
  type: 'expense' | 'revenue';
  amount: number;
  description: string;
  date: string;
  category: 'trip_earnings' | 'maintenance' | 'insurance' | 'insurance_claim' | 'other';
}

interface TransactionGroup {
  parent: Transaction;
  splits: Transaction[];
}

type MonthGroup = {
  processedTransactions: Array<{ parent: Transaction; splits: Transaction[] }>;
  standaloneTransactions: Transaction[];
};

type MonthEntry = [string, MonthGroup];

interface GroupType {
  parent: Transaction | null;
  splits: Transaction[];
  totalAmount: number;
  date: string;
  tripDays: number;
  tripEnd: string;
  carId: string;
}

export default function TransactionManager() {
  const { transactions, cars, refreshTransactions } = useTuro();
  const [selectedCarId, setSelectedCarId] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedParent, setSelectedParent] = useState<Transaction | null>(null);
  const [newTransaction, setNewTransaction] = useState<ManualTransaction>({
    type: 'expense',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    category: 'maintenance'
  });
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [showNewParentForm, setShowNewParentForm] = useState(false);
  const [newParentTransaction, setNewParentTransaction] = useState<{
    type: 'revenue' | 'expense';
    amount: number;
    description: string;
    date: string;
    tripEnd: string;
    tripDays: number;
    carIds: string[];
    category: 'trip_earnings' | 'maintenance' | 'insurance' | 'insurance_claim' | 'other';
  }>({
    type: 'revenue',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    tripEnd: new Date().toISOString().split('T')[0],
    tripDays: 1,
    carIds: [],
    category: 'trip_earnings'
  });
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [editDates, setEditDates] = useState({
    date: '',
    tripEnd: ''
  });
  const [editType, setEditType] = useState<'expense' | 'revenue'>('expense');
  const [editDescription, setEditDescription] = useState('');

  // Debug logging
  useEffect(() => {
    console.log('Raw transactions:', transactions);
    
    // Log transactions with reservation ID 40610091
    const targetTransaction = transactions.find(t => t.description?.includes('40610091'));
    if (targetTransaction) {
      console.log('Found target transaction:', targetTransaction);
    }
  }, [transactions]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    // Ensure we're working with the local timezone by creating a date at midnight local time
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getCarName = (carId: string) => {
    return cars.find(car => car.id === carId)?.name || 'Unknown Car';
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (expandedIds.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const calculateSplitDateRange = (split: Transaction, parent: Transaction) => {
    const splitMatch = split.description?.match(/\((\d+)\s+of\s+(\d+)\s+days\)/);
    if (!splitMatch) return { start: split.date, end: split.date };

    // Use the dates directly from the transactions
    return {
      start: split.date,
      end: split.tripEnd || parent.tripEnd
    };
  };

  // Group transactions by reservation ID
  const groupedTransactions = transactions
    .filter(t => !selectedCarId || t.carId === selectedCarId)
    .reduce((groups, transaction) => {
      // Extract reservation ID and split info
      const reservationMatch = transaction.description?.match(/for (\d+)(?:\s+\((\d+)\s+of\s+(\d+)\s+days\))?/);
      if (!reservationMatch) return groups;

      const [, reservationId, splitNum, totalDays] = reservationMatch;
      const groupKey = reservationId;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          parent: null as Transaction | null,
          splits: [] as Transaction[],
          totalAmount: 0,
          date: transaction.date,
          tripDays: totalDays ? parseInt(totalDays) : transaction.tripDays || 0,
          tripEnd: transaction.tripEnd || '',
          carId: transaction.carId
        });
      }

      const group = groups.get(groupKey)!;

      if (splitNum) {
        // This is a split transaction
        group.splits.push(transaction);
        group.totalAmount += transaction.amount;
      } else {
        // This is a parent transaction
        group.parent = transaction;
      }

      // Update group metadata
      if (new Date(transaction.date) < new Date(group.date)) {
        group.date = transaction.date;
      }
      if (transaction.tripEnd) {
        group.tripEnd = transaction.tripEnd;
      }

      return groups;
    }, new Map<string, {
      parent: Transaction | null;
      splits: Transaction[];
      totalAmount: number;
      date: string;
      tripDays: number;
      tripEnd: string;
      carId: string;
    }>());

  // Convert grouped transactions to array and sort by date
  const processedTransactions = Array.from(groupedTransactions.values())
    .filter((group): group is GroupType => group.splits.length > 0) // Only keep groups with splits
    .map((group: GroupType) => {
      // Sort splits by their day number
      const sortedSplits = [...group.splits].sort((a: Transaction, b: Transaction) => {
        const aNum = parseInt(a.description?.match(/\((\d+)\s+of/)?.[1] || '0');
        const bNum = parseInt(b.description?.match(/\((\d+)\s+of/)?.[1] || '0');
        return aNum - bNum;
      });

      // Create a synthetic parent if none exists
      const parent: Transaction = group.parent || {
        ...sortedSplits[0],
        id: sortedSplits[0].id,
        description: `Trip earnings for ${group.splits[0].description?.match(/for (\d+)/)?.[1]}`,
        amount: group.totalAmount,
        date: group.date,
        tripEnd: group.tripEnd,
        tripDays: group.tripDays,
        category: 'trip_earnings' as const,
        type: 'revenue' as const,
        carId: group.carId,
        isManual: false
      };

      return {
        parent,
        splits: sortedSplits
      };
    })
    .sort((a: TransactionGroup, b: TransactionGroup): number => {
      const dateA = new Date(a.parent.date);
      const dateB = new Date(b.parent.date);
      return dateB.getTime() - dateA.getTime();
    });

  const handleAddTransaction = async () => {
    if (!selectedParent || !newTransaction.description || newTransaction.amount <= 0) return;

    try {
      const reservationId = selectedParent.description?.match(/for (\d+)/)?.[1];
      if (!reservationId) return;

      // Ensure date is stored with consistent timezone handling
      const transactionDate = new Date(newTransaction.date + 'T00:00:00');

      const transactionData: Omit<Transaction, 'id'> & { parentId: string } = {
        ...newTransaction,
        date: transactionDate.toISOString().split('T')[0],
        carId: selectedParent.carId,
        parentId: selectedParent.id,
        isManual: true,
        createdAt: new Date().toISOString(),
        lastUpdateSource: 'manual',
        severity: 'normal'
      };

      await addDoc(collection(db, 'transactions'), transactionData);
      
      setNewTransaction({
        type: 'expense',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
        category: 'maintenance'
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  const handleEditTransaction = async () => {
    if (!editingTransaction || editAmount <= 0) return;

    try {
      const startDate = new Date(editDates.date + 'T00:00:00');
      const endDate = new Date(editDates.tripEnd + 'T00:00:00');

      const updates: Partial<Transaction> = {
        amount: editAmount,
        type: editType,
        description: editDescription,
        date: startDate.toISOString().split('T')[0],
        category: editingTransaction.category, // Preserve the original category
        severity: 'normal'
      };

      if (editDates.tripEnd !== editDates.date) {
        updates.tripEnd = endDate.toISOString().split('T')[0];
      }

      await updateDoc(doc(db, 'transactions', editingTransaction.id), updates);
      
      setShowEditForm(false);
      setEditingTransaction(null);
      setEditAmount(0);
      setEditType('expense');
      setEditDescription('');
      setEditDates({ date: '', tripEnd: '' });
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      console.log('Attempting to delete transaction:', {
        id: transaction.id,
        description: transaction.description,
        date: transaction.date,
        source: transaction.lastUpdateSource || 'manual',
        type: transaction.type
      });

      const result = await deleteTransactions([transaction.id]);
      if (!result.success) {
        console.error('Failed to delete transaction:', result.error);
        throw new Error('Failed to delete transaction');
      }
      
      console.log(`Successfully deleted transaction ${transaction.id}`, {
        deletedCount: result.deletedCount,
        success: result.success
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    }
  };

  const openEditForm = (transaction: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTransaction(transaction);
    setEditAmount(transaction.amount);
    setEditType(transaction.type);
    setEditDescription(transaction.description);
    setEditDates({
      date: transaction.date,
      tripEnd: transaction.tripEnd || transaction.date
    });
    setShowEditForm(true);
  };

  const handleAddParentTransaction = async () => {
    if (!newParentTransaction.description || newParentTransaction.amount <= 0 || newParentTransaction.carIds.length === 0) return;

    try {
      // Ensure dates are stored with consistent timezone handling
      const startDate = new Date(newParentTransaction.date + 'T00:00:00');
      const endDate = new Date(newParentTransaction.tripEnd + 'T00:00:00');

      // Create a transaction for each selected car
      const promises = newParentTransaction.carIds.map(carId => {
        const transactionData: Omit<Transaction, 'id'> = {
          type: newParentTransaction.type,
          amount: newParentTransaction.amount,
          description: newParentTransaction.description,
          category: newParentTransaction.category,
          carId,
          date: startDate.toISOString().split('T')[0],
          tripEnd: endDate.toISOString().split('T')[0],
          tripDays: newParentTransaction.tripDays,
          isParent: true,
          createdAt: new Date().toISOString(),
          lastUpdateSource: 'manual',
          severity: 'normal'
        };
        return addDoc(collection(db, 'transactions'), transactionData);
      });

      await Promise.all(promises);
      
      setNewParentTransaction({
        type: 'revenue',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
        tripEnd: new Date().toISOString().split('T')[0],
        tripDays: 1,
        carIds: [],
        category: 'trip_earnings'
      });
      setShowNewParentForm(false);
    } catch (error) {
      console.error('Error adding parent transactions:', error);
    }
  };

  const handleSelectAllCars = () => {
    setNewParentTransaction(prev => ({
      ...prev,
      carIds: cars.map(car => car.id)
    }));
  };

  const handleDeselectAllCars = () => {
    setNewParentTransaction(prev => ({
      ...prev,
      carIds: []
    }));
  };

  const getMonthKey = (date: string) => {
    // Ensure we're working with the local timezone by creating a date at midnight local time
    const localDate = new Date(date + 'T00:00:00');
    return localDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  const toggleMonth = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths);
    if (expandedMonths.has(monthKey)) {
      newExpanded.delete(monthKey);
    } else {
      newExpanded.add(monthKey);
    }
    setExpandedMonths(newExpanded);
  };

  const groupTransactionsByMonth = () => {
    const monthlyGroups = new Map<string, MonthGroup>();

    processedTransactions.forEach(transaction => {
      const monthKey = getMonthKey(transaction.parent.date);
      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, {
          processedTransactions: [],
          standaloneTransactions: []
        });
      }
      monthlyGroups.get(monthKey)!.processedTransactions.push(transaction);
    });

    transactions
      .filter(t => 
        (!selectedCarId || t.carId === selectedCarId) && 
        !t.description?.includes(' of ') &&
        !t.isManual
      )
      .forEach(transaction => {
        const monthKey = getMonthKey(transaction.date);
        if (!monthlyGroups.has(monthKey)) {
          monthlyGroups.set(monthKey, {
            processedTransactions: [],
            standaloneTransactions: []
          });
        }
        monthlyGroups.get(monthKey)!.standaloneTransactions.push(transaction);
      });

    return Array.from(monthlyGroups.entries())
      .sort((a: MonthEntry, b: MonthEntry): number => 
        new Date(b[0]).getTime() - new Date(a[0]).getTime());
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold">Transactions</h2>
          <button
            onClick={() => setShowNewParentForm(true)}
            className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Add New Transaction
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <label htmlFor="carFilter" className="text-sm font-medium text-gray-700">
            Filter by Car:
          </label>
          <select
            id="carFilter"
            value={selectedCarId}
            onChange={(e) => setSelectedCarId(e.target.value)}
            className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All Cars</option>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {groupTransactionsByMonth().map(([monthKey, { processedTransactions: monthProcessed, standaloneTransactions }]) => (
          <div key={monthKey} className="border border-gray-200 rounded-lg overflow-hidden">
            <div 
              className="bg-gray-100 p-4 cursor-pointer hover:bg-gray-200 transition-colors flex justify-between items-center"
              onClick={() => toggleMonth(monthKey)}
            >
              <h3 className="text-lg font-semibold">{monthKey}</h3>
              <span className="text-gray-500 text-xl leading-none">
                {expandedMonths.has(monthKey) ? '▼' : '▶'}
              </span>
            </div>

            {expandedMonths.has(monthKey) && (
              <div className="space-y-4 p-4">
                {monthProcessed.map(({ parent, splits }) => (
                  <div key={parent.id} className="bg-white rounded-lg shadow overflow-hidden">
                    {/* Parent Transaction */}
                    <div 
                      className="p-4 border-l-4 border-blue-500 cursor-pointer hover:bg-gray-50 transition-colors group"
                      onClick={() => toggleExpand(parent.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-semibold">{getCarName(parent.carId)}</div>
                          <div className="text-sm text-gray-600">
                            {formatDate(parent.date)}
                            {parent.tripEnd && ` - ${formatDate(parent.tripEnd)}`}
                            {parent.tripDays && ` (${parent.tripDays} days)`}
                          </div>
                          <div className="text-sm text-gray-500">{parent.description}</div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => openEditForm(parent, e)}
                              className="p-1 text-gray-600 hover:text-blue-600"
                              title="Edit amount"
                            >
                              ✎
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTransaction(parent);
                              }}
                              className="p-1 text-gray-600 hover:text-red-600"
                              title="Delete transaction"
                            >
                              ×
                            </button>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedParent(parent);
                              setShowAddForm(true);
                            }}
                            className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          >
                            Add Transaction
                          </button>
                          <span className={`font-semibold ${parent.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>
                            {formatAmount(parent.amount)}
                          </span>
                          <span className="text-gray-500 text-xl leading-none">
                            {expandedIds.has(parent.id) ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Split and Manual Transactions */}
                    {expandedIds.has(parent.id) && (
                      <div className="border-t border-gray-100">
                        {splits.map((split, index) => {
                          const dateRange = calculateSplitDateRange(split, parent);
                          return (
                            <div 
                              key={`${parent.id}-split-${index}`}
                              className="p-3 border-b border-gray-100 ml-4 bg-gray-50 group"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="text-sm text-gray-600">
                                    {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                                  </div>
                                  <div className="text-sm text-gray-500">{split.description}</div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => openEditForm(split, e)}
                                      className="p-1 text-gray-600 hover:text-blue-600"
                                      title="Edit amount"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(split)}
                                      className="p-1 text-gray-600 hover:text-red-600"
                                      title="Delete transaction"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <span className={`font-semibold ${split.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatAmount(split.amount)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Manual Transactions */}
                        {transactions
                          .filter(t => t.parentId === parent.id && t.isManual)
                          .sort((a: Transaction, b: Transaction): number => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((manualTx, index) => (
                            <div 
                              key={`${parent.id}-manual-${index}`}
                              className="p-3 border-b border-gray-100 ml-4 bg-gray-50 group"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="text-sm text-gray-600">
                                    {formatDate(manualTx.date)}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {manualTx.description}
                                    <span className="ml-2 text-xs text-gray-400">
                                      (Manual {manualTx.type})
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => openEditForm(manualTx, e)}
                                      className="p-1 text-gray-600 hover:text-blue-600"
                                      title="Edit amount"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(manualTx)}
                                      className="p-1 text-gray-600 hover:text-red-600"
                                      title="Delete transaction"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <span className={`font-semibold ${manualTx.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatAmount(manualTx.amount)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}

                {standaloneTransactions
                  .sort((a: Transaction, b: Transaction): number => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(transaction => (
                    <div key={transaction.id} className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="p-4 hover:bg-gray-50 transition-colors group">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-semibold">{getCarName(transaction.carId)}</div>
                            <div className="text-sm text-gray-600">
                              {formatDate(transaction.date)}
                              {transaction.tripEnd && ` - ${formatDate(transaction.tripEnd)}`}
                              {transaction.tripDays && ` (${transaction.tripDays} days)`}
                            </div>
                            <div className="text-sm text-gray-500">{transaction.description}</div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => openEditForm(transaction, e)}
                                className="p-1 text-gray-600 hover:text-blue-600"
                                title="Edit amount"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(transaction)}
                                className="p-1 text-gray-600 hover:text-red-600"
                                title="Delete transaction"
                              >
                                ×
                              </button>
                            </div>
                            <span className={`font-semibold ${transaction.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>
                              {formatAmount(transaction.amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Transaction Modal */}
      {showAddForm && selectedParent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Transaction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={newTransaction.type}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, type: e.target.value as 'expense' | 'revenue' }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="expense">Expense</option>
                  <option value="revenue">Revenue</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., Gas expense"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTransaction}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditForm && editingTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Edit Transaction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as 'expense' | 'revenue')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="expense">Expense</option>
                  <option value="revenue">Revenue</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., Gas expense"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(parseFloat(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={editDates.date}
                  onChange={(e) => setEditDates(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              {(editingTransaction.tripEnd || editingTransaction.tripDays) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    value={editDates.tripEnd}
                    onChange={(e) => setEditDates(prev => ({ ...prev, tripEnd: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingTransaction(null);
                    setEditType('expense');
                    setEditDescription('');
                    setEditDates({ date: '', tripEnd: '' });
                  }}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditTransaction}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Parent Transaction Modal */}
      {showNewParentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add New Transaction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Cars</label>
                <div className="flex justify-end space-x-2 mb-2">
                  <button
                    onClick={handleSelectAllCars}
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAllCars}
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Deselect All
                  </button>
                </div>
                <select
                  multiple
                  value={newParentTransaction.carIds}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                    setNewParentTransaction(prev => ({ ...prev, carIds: selectedOptions }));
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  size={4}
                >
                  {cars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.name}
                    </option>
                  ))}
                </select>
                <div className="mt-1 flex justify-between text-sm text-gray-500">
                  <span>Hold Ctrl (Windows) or Cmd (Mac) to select multiple cars</span>
                  <span>{newParentTransaction.carIds.length} cars selected</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={newParentTransaction.type}
                  onChange={(e) => setNewParentTransaction(prev => ({ ...prev, type: e.target.value as 'expense' | 'revenue' }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  type="text"
                  value={newParentTransaction.description}
                  onChange={(e) => setNewParentTransaction(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., Trip earnings for 12345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  value={newParentTransaction.amount}
                  onChange={(e) => setNewParentTransaction(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={newParentTransaction.date}
                  onChange={(e) => setNewParentTransaction(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={newParentTransaction.tripEnd}
                  onChange={(e) => setNewParentTransaction(prev => ({ ...prev, tripEnd: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Trip Days</label>
                <input
                  type="number"
                  value={newParentTransaction.tripDays}
                  onChange={(e) => setNewParentTransaction(prev => ({ ...prev, tripDays: parseInt(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  min="1"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowNewParentForm(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddParentTransaction}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}