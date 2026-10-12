import Link from "next/link";

// A narrow card over the scene for the account pages (sign up, log in, password reset).
export default function AuthLayout({children}: {children: React.ReactNode}) {
  return (
    <main className="sf-lift flex flex-1 flex-col font-mono text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-24 pt-10 sm:pt-14">
        <Link href="/" className="text-sm font-semibold tracking-[0.4em] text-white">
          ZEFLO
        </Link>
        <div className="sf-card mt-12 p-6 sm:mt-20 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
