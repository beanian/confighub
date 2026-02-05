import { createContext, useContext, useState, ReactNode } from 'react';

export type Environment = 'dev' | 'staging' | 'prod';

interface EnvironmentContextType {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
}

const EnvironmentContext = createContext<EnvironmentContextType | null>(null);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironment] = useState<Environment>('dev');

  return (
    <EnvironmentContext.Provider value={{ environment, setEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironment must be used within EnvironmentProvider');
  }
  return context;
}

export const environments: Array<{
  id: Environment;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
  { id: 'dev', label: 'Development', color: 'text-blue-500', bgColor: 'bg-blue-500', borderColor: 'border-blue-500' },
  { id: 'staging', label: 'Staging', color: 'text-amber-500', bgColor: 'bg-amber-500', borderColor: 'border-amber-500' },
  { id: 'prod', label: 'Production', color: 'text-red-500', bgColor: 'bg-red-500', borderColor: 'border-red-500' },
];

export function getEnvConfig(env: Environment) {
  return environments.find((e) => e.id === env) || environments[0];
}
