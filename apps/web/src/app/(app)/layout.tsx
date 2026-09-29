import { AuthGate } from '@/components/auth-gate';
import { TopBar } from '@/components/top-bar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen flex flex-col">
        <TopBar />
        <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</div>
      </div>
    </AuthGate>
  );
}
