// @lifecycle ACTIVE — Lesson search/filter bar component

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SearchFilters {
  search: string;
  difficulty: string;
  dateFrom: string;
  dateTo: string;
}

interface LessonSearchBarProps {
  onSearch: (filters: SearchFilters) => void;
}

const DEBOUNCE_MS = 300;

export default function LessonSearchBar({ onSearch }: LessonSearchBarProps) {
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounced search emission
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch({ search, difficulty, dateFrom, dateTo });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, difficulty, dateFrom, dateTo, onSearch]);

  const handleReset = useCallback(() => {
    setSearch('');
    setDifficulty('');
    setDateFrom('');
    setDateTo('');
  }, []);

  const hasActiveFilters = search || difficulty || dateFrom || dateTo;

  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap">
        {/* Text search */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="lesson-search" className="mb-1 block text-sm font-medium text-gray-700">
            Search
          </label>
          <input
            id="lesson-search"
            type="text"
            placeholder="Search lessons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Difficulty filter */}
        <div className="w-full md:w-44">
          <label htmlFor="lesson-difficulty" className="mb-1 block text-sm font-medium text-gray-700">
            Difficulty
          </label>
          <select
            id="lesson-difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All levels</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>

        {/* Date from */}
        <div className="w-full md:w-44">
          <label htmlFor="lesson-date-from" className="mb-1 block text-sm font-medium text-gray-700">
            From date
          </label>
          <input
            id="lesson-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Date to */}
        <div className="w-full md:w-44">
          <label htmlFor="lesson-date-to" className="mb-1 block text-sm font-medium text-gray-700">
            To date
          </label>
          <input
            id="lesson-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Clear button */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
