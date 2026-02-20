import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline';
  onClick?: () => void;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'default', 
  onClick,
  className = '' 
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded font-medium transition-colors ${
      variant === 'default'
        ? 'bg-blue-500 text-white hover:bg-blue-600'
        : 'border border-gray-300 bg-white hover:bg-gray-50'
    } ${className}`}
  >
    {children}
  </button>
);

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
    {children}
  </div>
);

interface StatisticProps {
  title: string;
  value: number;
  precision?: number;
  suffix?: string;
}

export const Statistic: React.FC<StatisticProps> = ({ 
  title, 
  value, 
  precision = 0, 
  suffix = '' 
}) => (
  <div>
    <div className="text-gray-500 text-sm mb-1">{title}</div>
    <div className="text-2xl font-bold">
      {value.toFixed(precision)} {suffix}
    </div>
  </div>
);

interface RowProps {
  children: React.ReactNode;
  gutter?: number;
  className?: string;
}

export const Row: React.FC<RowProps> = ({ children, gutter = 16, className = '' }) => (
  <div className={`flex flex-wrap -mx-${gutter/2} ${className}`}>
    {React.Children.map(children, child => 
      child ? React.cloneElement(child as React.ReactElement, { 
        className: `px-${gutter/2} ${(child as React.ReactElement).props.className || ''}` 
      }) : null
    )}
  </div>
);

interface ColProps {
  children: React.ReactNode;
  span: number;
  className?: string;
}

export const Col: React.FC<ColProps> = ({ children, span, className = '' }) => {
  const widthClass = {
    4: 'w-full md:w-1/3 lg:w-1/5',
    6: 'w-full md:w-1/2 lg:w-1/4',
    8: 'w-full md:w-2/3 lg:w-2/5',
    12: 'w-full',
    24: 'w-full',
  }[span] || `w-${span}/12`;
  
  return (
    <div className={`${widthClass} mb-4 ${className}`}>
      {children}
    </div>
  );
};

interface TableProps {
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ children }) => (
  <table className="w-full border-collapse">
    {children}
  </table>
);
