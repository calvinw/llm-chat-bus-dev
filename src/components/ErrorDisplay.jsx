import React from 'react';

const ErrorDisplay = ({ error }) => {
  if (!error) return null;

  return (
    <div 
      className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mt-2 text-sm"
      role="alert"
    >
      {error?.message || error?.toString() || 'An unknown error occurred'}
    </div>
  );
};

export default ErrorDisplay;