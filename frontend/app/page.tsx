// @lifecycle ACTIVE — Landing page

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="mb-4 text-4xl font-bold text-primary-600">
        Welcome to Floweng
      </h1>
      <p className="mb-8 text-lg text-gray-600">
        Master English with interactive lessons and exercises.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-primary-600 px-6 py-3 text-white transition hover:bg-primary-700"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-primary-600 px-6 py-3 text-primary-600 transition hover:bg-primary-50"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
