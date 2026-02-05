import clsx from 'clsx';

interface EnvironmentSelectorProps {
  value: string;
  onChange: (env: string) => void;
}

const environments = [
  { id: 'dev', label: 'Development', color: 'bg-blue-500' },
  { id: 'staging', label: 'Staging', color: 'bg-amber-500' },
  { id: 'prod', label: 'Production', color: 'bg-green-500' },
];

export function EnvironmentSelector({ value, onChange }: EnvironmentSelectorProps) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {environments.map((env) => (
        <button
          key={env.id}
          onClick={() => onChange(env.id)}
          className={clsx(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-fast flex items-center gap-2',
            value === env.id
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <span className={clsx('w-2 h-2 rounded-full', env.color)} />
          {env.label}
        </button>
      ))}
    </div>
  );
}
