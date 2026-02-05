import clsx from 'clsx';
import { useEnvironment, environments, Environment } from '../hooks/useEnvironment';

export function EnvironmentSwitcher() {
  const { environment, setEnvironment } = useEnvironment();

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
      {environments.map((env) => (
        <button
          key={env.id}
          onClick={() => setEnvironment(env.id)}
          className={clsx(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            environment === env.id
              ? `bg-white shadow-sm ${env.color}`
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <span
            className={clsx(
              'inline-block w-2 h-2 rounded-full mr-1.5',
              environment === env.id ? env.bgColor : 'bg-gray-300'
            )}
          />
          {env.id.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Badge component for displaying environment in lists/cards
export function EnvironmentBadge({ env, size = 'sm' }: { env: Environment; size?: 'sm' | 'md' }) {
  const config = environments.find((e) => e.id === env) || environments[0];

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
        config.color,
        'bg-opacity-10',
        env === 'dev' && 'bg-blue-100',
        env === 'staging' && 'bg-amber-100',
        env === 'prod' && 'bg-red-100'
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full mr-1', config.bgColor)} />
      {env.toUpperCase()}
    </span>
  );
}
