// @lifecycle ACTIVE — Dashboard page

'use client';

import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('floweng_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ name: payload.name, email: payload.email });
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Welcome back{user ? `, ${user.name}` : ''}!
      </h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-gray-700">
            Lessons
          </h2>
          <p className="text-3xl font-bold text-primary-600">0</p>
          <p className="mt-1 text-sm text-gray-500">lessons completed</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-gray-700">
            Exercises
          </h2>
          <p className="text-3xl font-bold text-primary-600">0</p>
          <p className="mt-1 text-sm text-gray-500">exercises done</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-gray-700">
            Streak
          </h2>
          <p className="text-3xl font-bold text-primary-600">0</p>
          <p className="mt-1 text-sm text-gray-500">day streak</p>
        </div>
      </div>
    </div>
  );
}
