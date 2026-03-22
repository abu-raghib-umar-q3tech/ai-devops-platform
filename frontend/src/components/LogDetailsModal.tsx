import type { HistoryItem } from "../services/api";
import { CodeSnippet } from "./CodeSnippet";

type LogDetailsModalProps = {
  log: HistoryItem;
  onClose: () => void;
};

export function LogDetailsModal({
  log,
  onClose,
}: Readonly<LogDetailsModalProps>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-100">Full log details</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Input
            </p>
            <CodeSnippet text={log.input} maxHeightClassName="max-h-64" />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Analysis
            </p>
            <CodeSnippet
              text={log.output.analysis}
              maxHeightClassName="max-h-64"
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Fix
            </p>
            <CodeSnippet text={log.output.fix} maxHeightClassName="max-h-64" />
          </div>
        </div>
      </div>
    </div>
  );
}

