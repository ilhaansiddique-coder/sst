"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = Readonly<{
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  placeholder: string;
  required?: boolean;
  defaultValue?: string;
}>;

export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  required = false,
  defaultValue,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="auth-label">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={name}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          className="auth-input pr-14"
          placeholder={placeholder}
          required={required}
        />

        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 transition hover:text-ink"
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={isVisible}
        >
          {isVisible ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}
