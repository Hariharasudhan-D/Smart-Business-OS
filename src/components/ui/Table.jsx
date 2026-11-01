// Wrapper scrolls horizontally on small screens.
export function Table({ children }) {
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}
export const THead = ({ children }) => (
  <thead className="bg-slate-50">
    <tr>{children}</tr>
  </thead>
);
export const Th = ({ className = '', ...rest }) => (
  <th className={`whitespace-nowrap px-3 py-3 text-left text-xs sm:px-4 font-semibold uppercase tracking-wide text-slate-500 ${className}`} {...rest} />
);
export const TBody = ({ children }) => <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>;
export const Td = ({ className = '', ...rest }) => <td className={`whitespace-nowrap px-3 py-3 text-slate-700 sm:px-4 ${className}`} {...rest} />;
