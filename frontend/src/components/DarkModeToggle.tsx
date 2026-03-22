type DarkModeToggleProps = {
  isDark: boolean;
  onToggle: () => void;
};

export function DarkModeToggle({
  isDark,
  onToggle,
}: Readonly<DarkModeToggleProps>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}

