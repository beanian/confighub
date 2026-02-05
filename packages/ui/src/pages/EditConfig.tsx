import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { DiffViewer } from '../components/DiffViewer';
import { ImpactPanel } from '../components/ImpactPanel';
import { api } from '../api/client';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import yaml from 'js-yaml';
import clsx from 'clsx';

interface YamlError {
  message: string;
  line?: number;
  column?: number;
}

export function EditConfig() {
  const { env, domain, key } = useParams();
  const navigate = useNavigate();

  const [originalContent, setOriginalContent] = useState('');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState<YamlError | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);

  useEffect(() => {
    if (env && domain && key) {
      api.getConfig(env, domain, key).then((res) => {
        const raw = res.raw || '';
        setOriginalContent(raw);
        setContent(raw);
        setTitle(`Update ${key}`);
      });
    }
  }, [env, domain, key]);

  const validateYaml = (value: string): boolean => {
    try {
      yaml.load(value);
      setValidationError(null);
      clearEditorMarkers();
      return true;
    } catch (e) {
      const yamlError = e as yaml.YAMLException;
      const errorInfo: YamlError = {
        message: yamlError.message || 'Invalid YAML',
        line: yamlError.mark?.line !== undefined ? yamlError.mark.line + 1 : undefined,
        column: yamlError.mark?.column !== undefined ? yamlError.mark.column + 1 : undefined,
      };
      setValidationError(errorInfo);
      setEditorMarkers(errorInfo);
      return false;
    }
  };

  const clearEditorMarkers = () => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, 'yaml', []);
      }
    }
  };

  const setEditorMarkers = (errorInfo: YamlError) => {
    if (editorRef.current && monacoRef.current && errorInfo.line) {
      const model = editorRef.current.getModel();
      if (model) {
        const line = errorInfo.line;
        const column = errorInfo.column || 1;
        const lineContent = model.getLineContent(line) || '';

        monacoRef.current.editor.setModelMarkers(model, 'yaml', [
          {
            severity: monacoRef.current.MarkerSeverity.Error,
            message: errorInfo.message,
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: lineContent.length + 1,
          },
        ]);

        // Also add a decoration for the entire line
        editorRef.current.deltaDecorations([], [
          {
            range: {
              startLineNumber: line,
              startColumn: 1,
              endLineNumber: line,
              endColumn: 1,
            },
            options: {
              isWholeLine: true,
              className: 'yaml-error-line',
              glyphMarginClassName: 'yaml-error-glyph',
            },
          },
        ]);
      }
    }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define custom CSS for error highlighting
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      .yaml-error-line {
        background-color: rgba(239, 68, 68, 0.1) !important;
      }
      .yaml-error-glyph {
        background-color: #ef4444;
        width: 4px !important;
        margin-left: 3px;
      }
    `;
    document.head.appendChild(styleSheet);

    // Validate on mount if there's content
    if (content) {
      validateYaml(content);
    }
  };

  const handleContentChange = (value: string | undefined) => {
    const newValue = value || '';
    setContent(newValue);
    validateYaml(newValue);
  };

  const handleSubmit = async () => {
    if (!validateYaml(content)) {
      setError('Please fix YAML errors before submitting');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const change = await api.createChangeRequest({
        domain: domain!,
        key: key!,
        targetEnvironment: env!,
        title,
        description,
        content,
      });
      navigate(`/changes/${change.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create change');
    } finally {
      setSubmitting(false);
    }
  };

  const goToError = () => {
    if (editorRef.current && validationError?.line) {
      editorRef.current.revealLineInCenter(validationError.line);
      editorRef.current.setPosition({
        lineNumber: validationError.line,
        column: validationError.column || 1,
      });
      editorRef.current.focus();
    }
  };

  const hasChanges = content !== originalContent;

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <span>{env}</span>
              <span>/</span>
              <span>{domain}</span>
              <span>/</span>
              <span className="font-medium text-gray-900">{key}</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Change title..."
              className="text-lg font-semibold bg-transparent border-none outline-none text-gray-900 w-96"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                showDiff
                  ? 'bg-gray-200 text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {showDiff ? 'Hide Diff' : 'Show Diff'}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasChanges || !!validationError || submitting}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Change Request'}
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional) - explain why this change is needed..."
            className="w-full bg-transparent border-none outline-none text-sm text-gray-600 placeholder:text-gray-400"
          />
        </div>

        {/* Impact Analysis */}
        {env && domain && key && (
          <ImpactPanel environment={env} domain={domain} configKey={key} />
        )}

        {/* Errors */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {validationError && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">YAML Error</span>
              {validationError.line && (
                <span className="text-red-500">
                  at line {validationError.line}
                  {validationError.column && `, column ${validationError.column}`}
                </span>
              )}
              <span className="text-red-600">{validationError.message}</span>
            </div>
            {validationError.line && (
              <button
                onClick={goToError}
                className="px-2 py-1 text-xs font-medium bg-red-100 hover:bg-red-200 rounded transition-all"
              >
                Go to error
              </button>
            )}
          </div>
        )}

        {/* Editor / Diff */}
        <div className="flex-1 overflow-hidden">
          {showDiff ? (
            <div className="h-full p-4 overflow-auto">
              <DiffViewer
                oldContent={originalContent}
                newContent={content}
                oldLabel="Current"
                newLabel="Your Changes"
              />
            </div>
          ) : (
            <Editor
              height="100%"
              language="yaml"
              value={content}
              onChange={handleContentChange}
              onMount={handleEditorMount}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'JetBrains Mono, monospace',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                glyphMargin: true,
                renderLineHighlight: 'all',
              }}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
