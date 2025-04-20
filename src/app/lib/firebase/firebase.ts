import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDsxvhsjv4XqqyokoYUbw7Ha5odx6XZhCk",
  authDomain: "oak-rentals-5b6ee.firebaseapp.com",
  projectId: "oak-rentals-5b6ee",
  storageBucket: "oak-rentals-5b6ee.firebasestorage.app",
  messagingSenderId: "157037759444",
  appId: "1:157037759444:web:6c3935b19b8618476e441",
  measurementId: "G-3W0FF6Z0Q1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics only if we're in a browser environment and not in development
let analyticsInstance;
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  try {
    analyticsInstance = getAnalytics(app);
  } catch (error) {
    console.log('Analytics initialization skipped or failed:', error);
    analyticsInstance = null;
  }
}

// Initialize Firestore
const db = getFirestore(app);

export const analytics = analyticsInstance;
export { db }; 