"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { searchClient } from '@/lib/meilisearch';

export default function TelecallerSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        setSelectedIndex(-1);
        return;
      }
      
      setIsSearching(true);
      try {
        const searchResult = await searchClient.index('companies').search(query, { 
          limit: 8 // Keep it fast and fit on screen
        });
        setResults(searchResult.hits);
        setSelectedIndex(-1); // Reset selection on new search
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceFn = setTimeout(() => performSearch(), 250);
    return () => clearTimeout(debounceFn);
  }, [query]);

  // Handle Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectCompany(results[selectedIndex].id);
    }
  };

  // Action when a company is selected
  const handleSelectCompany = (companyId: string | number) => {
    // Navigate to the specific company's CRM profile
    router.push(`/telecaller/company/${companyId}`);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Global Search</h1>
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type company name or pincode..."
          className="w-full p-4 pl-12 border-2 border-gray-200 rounded-xl shadow-sm focus:border-blue-500 focus:ring-0 text-lg transition-all"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        {/* Simple Search Icon SVG */}
        <svg className="w-6 h-6 absolute left-4 top-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>

      {isSearching && (
        <div className="mt-4 text-sm text-gray-500 animate-pulse">Searching 1,000,000+ records...</div>
      )}

      {/* Results Dropdown Area */}
      {query && results.length > 0 && (
        <div className="mt-4 border rounded-xl bg-white shadow-lg overflow-hidden divide-y">
          {results.map((company, index) => (
            <div 
              key={company.id} 
              onClick={() => handleSelectCompany(company.id)}
              className={`p-4 cursor-pointer transition-colors ${
                index === selectedIndex ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50 border-l-4 border-transparent'
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-lg">{company.company_name}</h3>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                  {company.pincode}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {query && !isSearching && results.length === 0 && (
        <div className="mt-8 text-center p-8 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500 text-lg">No companies found matching "{query}"</p>
        </div>
      )}
    </div>
  );
}
