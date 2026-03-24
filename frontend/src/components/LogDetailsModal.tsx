import type { HistoryItem } from "../services/api";
import { CodeSnippet } from "./CodeSnippet";
import toast from "react-hot-toast";

type LogDetailsModalProps = {
  log: HistoryItem;
  onClose: () => void;
};

export function LogDetailsModal({
  log,
  onClose,
}: Readonly<LogDetailsModalProps>) {
  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const copyAll = async () => {
    const allContent = `INPUT:\n${log.input}\n\nANALYSIS:\n${log.output.analysis}\n\nFIX:\n${log.output.fix}\n\nCreated: ${formatDate(log.createdAt)}`;
    await navigator.clipboard.writeText(allContent);
    toast.success("All content copied to clipboard");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-details-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="document"
        className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex-1">
              <h3 id="log-details-title" className="text-base font-semibold text-slate-100 sm:text-lg">Log Analysis Details</h3>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                Created {formatDate(log.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyAll()}
                className="rounded-md border border-indigo-600 bg-indigo-600/10 px-3 py-1.5 text-xs font-medium text-indigo-400 transition hover:bg-indigo-600/20"
              >
                Copy All
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:space-y-6 sm:p-5">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Input
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyToClipboard(log.input, "Input")}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
              >
                Copy
              </button>
            </div>
            <CodeSnippet text={log.input} maxHeightClassName="max-h-96" />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Analysis
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyToClipboard(log.output.analysis, "Analysis")}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
              >
                Copy
              </button>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                {log.output.analysis}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Fix
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyToClipboard(log.output.fix, "Fix")}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
              >
                Copy
              </button>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                {log.output.fix}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

