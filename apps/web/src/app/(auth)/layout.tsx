import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <Link href="/" className="mb-8 text-3xl font-black">
        Carn<span className="text-accent">IA</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
