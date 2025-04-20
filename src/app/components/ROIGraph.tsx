'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Scale,
  Tick,
  CoreScaleOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTuro } from '../lib/contexts/TuroContext';
import { Car } from '../lib/types/turo';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function ROIGraph() {
  const { cars, getCarROI, selectedCars } = useTuro();

  if (!cars || cars.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          {cars ? "No vehicles found. Add a vehicle in the Fleet Management section." : "Loading..."}
        </div>
      </div>
    );
  }

  // Filter cars based on selection
  const displayCars = selectedCars.length > 0 
    ? cars.filter(car => selectedCars.includes(car.id))
    : cars;

  const sortedCars = [...displayCars].sort((a: Car, b: Car) => {
    const roiA = getCarROI(a.id);
    const roiB = getCarROI(b.id);
    return roiB.totalROI - roiA.totalROI;
  });

  const data = {
    labels: sortedCars.map(car => car.name),
    datasets: [
      {
        label: 'Total ROI',
        data: sortedCars.map(car => getCarROI(car.id).totalROI),
        backgroundColor: sortedCars.map(car => {
          const roi = getCarROI(car.id).totalROI;
          return roi >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        }),
        borderColor: sortedCars.map(car => {
          const roi = getCarROI(car.id).totalROI;
          return roi >= 0 ? 'rgb(21, 128, 61)' : 'rgb(185, 28, 28)';
        }),
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Monthly ROI',
        data: sortedCars.map(car => getCarROI(car.id).monthlyROI),
        backgroundColor: sortedCars.map(car => {
          const roi = getCarROI(car.id).monthlyROI;
          return roi >= 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        }),
        borderColor: sortedCars.map(car => {
          const roi = getCarROI(car.id).monthlyROI;
          return roi >= 0 ? 'rgb(29, 78, 216)' : 'rgb(185, 28, 28)';
        }),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: selectedCars.length > 0
          ? `Vehicle ROI Comparison (${selectedCars.length} car${selectedCars.length > 1 ? 's' : ''} selected)`
          : 'Vehicle ROI Comparison',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            return `${context.dataset.label}: ${value.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(this: Scale<CoreScaleOptions>, tickValue: number | string, index: number, ticks: Tick[]) {
            if (typeof tickValue === 'number') {
              return `${tickValue}%`;
            }
            return tickValue;
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <Bar data={data} options={options} />
    </div>
  );
} 