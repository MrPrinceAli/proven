import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const control =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-gray-400 " +
  "focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30 disabled:bg-gray-50";

interface FieldShell {
  label: string;
  hint?: string;
  error?: string;
}

function Shell({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldShell & { id: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, f: FieldShell) =>
  f.error ? `${id}-error` : f.hint ? `${id}-hint` : undefined;

export function Input({
  label,
  hint,
  error,
  id,
  ...props
}: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} required={props.required}>
      <input
        id={fid}
        className={control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, { label, hint, error })}
        {...props}
      />
    </Shell>
  );
}

export function Textarea({
  label,
  hint,
  error,
  id,
  ...props
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} required={props.required}>
      <textarea
        id={fid}
        rows={4}
        className={control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, { label, hint, error })}
        {...props}
      />
    </Shell>
  );
}

export function Select({
  label,
  hint,
  error,
  id,
  options,
  ...props
}: FieldShell & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} required={props.required}>
      <select
        id={fid}
        className={control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, { label, hint, error })}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}
