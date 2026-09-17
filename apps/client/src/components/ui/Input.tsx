import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type, error, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || props.name || generatedId;
    const errorId = `${inputId}-error`;
    const { ['aria-describedby']: ariaDescribedBy, ...inputProps } = props;
    const describedBy = [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          className={`flex h-11 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 py-2 text-sm ring-offset-white dark:ring-offset-gray-950 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600 dark:focus-visible:border-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-red-500 focus-visible:ring-red-500' : ''
          } ${className}`}
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {error && <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
