/**
 * LoadingStates Components
 * UX: Skeleton loaders et états de chargement pour meilleure perception
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Skeleton Loader for Cards
 */
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse"
        >
          <div className="flex items-start space-x-4">
            <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
          </div>
        </div>
      ))}
    </>
  );
};

/**
 * Skeleton Loader for Lists
 */
export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center space-x-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 animate-pulse"
        >
          <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton Loader for Stats Cards
 */
export const StatCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          </div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
        </div>
      ))}
    </>
  );
};

/**
 * Spinner Component
 */
export const Spinner: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-emerald-600 dark:text-emerald-400 ${className}`}
    />
  );
};

/**
 * Progress Bar Component
 */
export const ProgressBar: React.FC<{
  progress: number;
  label?: string;
  className?: string;
}> = ({ progress, label, className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
          <span>{label}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        ></div>
      </div>
    </div>
  );
};
