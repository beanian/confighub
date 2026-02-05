import { useMemo } from 'react';
import { diffLines, Change } from 'diff';
import clsx from 'clsx';

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
}

export function DiffViewer({
  oldContent,
  newContent,
  oldLabel = 'Current',
  newLabel = 'Proposed',
}: DiffViewerProps) {
  const diff = useMemo(() => diffLines(oldContent, newContent), [oldContent, newContent]);

  // Build line-by-line view
  const { leftLines, rightLines } = useMemo(() => {
    const left: Array<{ num: number; content: string; type: 'unchanged' | 'removed' }> = [];
    const right: Array<{ num: number; content: string; type: 'unchanged' | 'added' }> = [];

    let leftNum = 1;
    let rightNum = 1;

    diff.forEach((part: Change) => {
      const lines = part.value.split('\n').filter((_, i, arr) =>
        i < arr.length - 1 || part.value.slice(-1) !== '\n' ? true : i < arr.length - 1
      );

      if (part.added) {
        lines.forEach((line) => {
          left.push({ num: -1, content: '', type: 'unchanged' });
          right.push({ num: rightNum++, content: line, type: 'added' });
        });
      } else if (part.removed) {
        lines.forEach((line) => {
          left.push({ num: leftNum++, content: line, type: 'removed' });
          right.push({ num: -1, content: '', type: 'unchanged' });
        });
      } else {
        lines.forEach((line) => {
          left.push({ num: leftNum++, content: line, type: 'unchanged' });
          right.push({ num: rightNum++, content: line, type: 'unchanged' });
        });
      }
    });

    return { leftLines: left, rightLines: right };
  }, [diff]);

  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    diff.forEach((part) => {
      const lineCount = part.value.split('\n').filter((_, i, arr) =>
        i < arr.length - 1 || part.value.slice(-1) !== '\n'
      ).length;
      if (part.added) additions += lineCount;
      if (part.removed) deletions += lineCount;
    });
    return { additions, deletions };
  }, [diff]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Headers */}
      <div className="flex border-b border-border bg-gray-50">
        <div className="flex-1 px-4 py-2 font-medium text-sm text-gray-700 border-r border-border flex items-center justify-between">
          <span>{oldLabel}</span>
          {stats.deletions > 0 && (
            <span className="text-xs bg-diff-remove-strong text-red-700 px-2 py-0.5 rounded font-mono">
              -{stats.deletions}
            </span>
          )}
        </div>
        <div className="flex-1 px-4 py-2 font-medium text-sm text-gray-700 flex items-center justify-between">
          <span>{newLabel}</span>
          {stats.additions > 0 && (
            <span className="text-xs bg-diff-add-strong text-green-700 px-2 py-0.5 rounded font-mono">
              +{stats.additions}
            </span>
          )}
        </div>
      </div>

      {/* Diff content */}
      <div className="flex font-mono text-sm max-h-[600px] overflow-auto custom-scrollbar">
        {/* Left side */}
        <div className="flex-1 border-r border-border">
          {leftLines.map((line, i) => (
            <div
              key={`left-${i}`}
              className={clsx(
                'flex',
                line.type === 'removed' && 'bg-diff-remove'
              )}
            >
              <span
                className={clsx(
                  'w-12 flex-shrink-0 px-2 py-0.5 text-right text-gray-400 select-none border-r',
                  line.type === 'removed'
                    ? 'bg-diff-remove-strong border-red-200'
                    : 'border-gray-100'
                )}
              >
                {line.num > 0 ? line.num : ''}
              </span>
              <span
                className={clsx(
                  'flex-1 px-3 py-0.5 whitespace-pre',
                  line.type === 'removed' && 'text-red-800'
                )}
              >
                {line.type === 'removed' && (
                  <span className="text-red-500 mr-1">-</span>
                )}
                {line.content}
              </span>
            </div>
          ))}
        </div>

        {/* Right side */}
        <div className="flex-1">
          {rightLines.map((line, i) => (
            <div
              key={`right-${i}`}
              className={clsx(
                'flex',
                line.type === 'added' && 'bg-diff-add'
              )}
            >
              <span
                className={clsx(
                  'w-12 flex-shrink-0 px-2 py-0.5 text-right text-gray-400 select-none border-r',
                  line.type === 'added'
                    ? 'bg-diff-add-strong border-green-200'
                    : 'border-gray-100'
                )}
              >
                {line.num > 0 ? line.num : ''}
              </span>
              <span
                className={clsx(
                  'flex-1 px-3 py-0.5 whitespace-pre',
                  line.type === 'added' && 'text-green-800'
                )}
              >
                {line.type === 'added' && (
                  <span className="text-green-500 mr-1">+</span>
                )}
                {line.content}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
