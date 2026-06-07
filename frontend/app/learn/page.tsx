// @lifecycle ACTIVE — Lessons listing page

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/axios';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  order: number;
}

export default function LearnPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/learning/lessons')
      .then((res) => setLessons(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-500">Loading lessons...</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Lessons</h1>

      {lessons.length === 0 ? (
        <p className="text-gray-500">No lessons available yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <span className="mb-2 inline-block rounded bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700">
                {lesson.difficulty}
              </span>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                {lesson.title}
              </h2>
              {lesson.description && (
                <p className="text-sm text-gray-600">{lesson.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
