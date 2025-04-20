import { useState } from 'react';

interface Toast {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastOptions {
  title: string;
  description: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = ({ title, description, type, duration = 5000 }: ToastOptions) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, title, description, type };
    
    setToasts((currentToasts) => [...currentToasts, newToast]);

    setTimeout(() => {
      setToasts((currentToasts) => 
        currentToasts.filter((toast) => toast.id !== id)
      );
    }, duration);
  };

  return { toast, toasts };
} 