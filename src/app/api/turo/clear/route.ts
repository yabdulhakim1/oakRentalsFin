import { db } from '@/app/lib/firebase/firebase';
import { collection, getDocs, writeBatch, query, limit } from 'firebase/firestore';

export async function POST() {
  try {
    console.log('Starting deletion of all transactions...');
    const transactionsRef = collection(db, 'transactions');
    
    // Firestore has a limit of 500 operations per batch
    while (true) {
      const q = query(transactionsRef, limit(500));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        break;
      }
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Deleted batch of ${snapshot.docs.length} transactions`);
    }

    console.log('Successfully deleted all transactions');
    return new Response(JSON.stringify({ 
      message: 'Successfully deleted all transactions' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting transactions:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete transactions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 