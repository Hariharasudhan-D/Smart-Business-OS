import { Field, fieldClass } from './Input';
export default function Select({ label, error, options, placeholder, className = '', ...rest }) {
  return (
    <Field label={label} error={error}>
      <select className={`${fieldClass(error)} ${className}`} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
