import React from 'react';

// Generic skeleton pulse
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
);

// Page skeleton - generic
export const PageSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    {/* Header */}
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
    {/* Stats row */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
    {/* Table skeleton */}
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="divide-y divide-slate-100">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Table row skeleton
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="animate-pulse">
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="flex gap-4 px-6 py-4 border-b border-slate-100">
        {[...Array(cols)].map((_, j) => (
          <div key={j} className="flex-1">
            <Skeleton className={`h-4 w-${j === 0 ? '32' : j === cols - 1 ? '16' : '24'}`} />
          </div>
        ))}
      </div>
    ))}
  </div>
);

// Card skeleton
export const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse space-y-4">
    <div className="flex items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  </div>
);

// Full page loader with branding
export const FullPageLoader: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
    <div className="relative">
      <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
        <span className="text-white text-2xl font-bold">M</span>
      </div>
      <div className="absolute -inset-1 rounded-2xl border-2 border-blue-300 animate-ping opacity-40" />
    </div>
    <div className="text-sm text-slate-400 animate-pulse">Ładowanie...</div>
  </div>
);

export default Skeleton;
