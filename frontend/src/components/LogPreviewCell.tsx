type LogPreviewCellProps = {
  text: string;
  /** Match `CodeSnippet` default preview height (e.g. max-h-24 on dashboard history). */
  maxHeightClassName?: string;
};

/** Scrollable monospace preview for log/analysis/fix text in tables. */
export function LogPreviewCell({
  text,
  maxHeightClassName = "max-h-24",
}: Readonly<LogPreviewCellProps>) {
  const trimmed = text.trim();
  if (!trimmed) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }
  return (
    <div
      className={`min-h-0 w-full overflow-y-auto break-words font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap ${maxHeightClassName}`}
    >
      {text}
    </div>
  );
}
