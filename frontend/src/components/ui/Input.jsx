export const fieldClass = (error) =>
  `block w-full rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 sm:py-2 sm:text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 ${error ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'}`;
export function Field({ label, error, children }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>}
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
export default function Input({ label, error, className = '', ...rest }) {
  return (
    <Field label={label} error={error}>
      <input className={`${fieldClass(error)} ${className}`} {...rest} />
    </Field>
  );
}
