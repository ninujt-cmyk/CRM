"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';

export default function TelecallerSearchPage() {
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  // State to hold smart nearby suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Clear results when switching tabs
  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setQuery('');
    setResults([]);
    setSuggestions([]);
  };

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        setSuggestions([]);
        return;
      }
      
      setIsSearching(true);
      try {
        const searchOptions = {
          limit: 15,
          attributesToSearchOn: searchMode === 'company' ? ['company_name'] : ['pincode'],
        };

        const searchResult = await searchClient.index('companies').search(query, searchOptions);
        setResults(searchResult.hits);
        setSuggestions([]); // Clear previous suggestions

        // --- SMART INTELLIGENCE FEATURE ---
        // If it's a pincode search, yielded 0 hits, and they've typed at least 4 digits
        if (searchMode === 'pincode' && searchResult.hits.length === 0 && query.length >= 4) {
          
          // Grab the first 3 or 4 digits to find the general geographic region/city
          const prefix = query.length === 6 ? query.substring(0, 4) : query.substring(0, 3);
          
          const suggestionResult = await searchClient.index('companies').search(prefix, {
            limit: 6, // Show top 6 alternative nearby areas
            attributesToSearchOn: ['pincode'],
          });
          
          setSuggestions(suggestionResult.hits);
        }

      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceFn = setTimeout(() => performSearch(), 250);
    return () => clearTimeout(debounceFn);
  }, [query, searchMode]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-slate-800">Telecaller Directory</h1>
      
      {/* Search Mode Toggles */}
      <div className="flex space-x-4 mb-6">
        <button 
          onClick={() => handleModeSwitch('company')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            searchMode === 'company' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          Search by Company Name
        </button>
        <button 
          onClick={() => handleModeSwitch('pincode')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            searchMode === 'pincode' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          Search by Pincode
        </button>
      </div>

      {/* Search Input */}
      <input
        type="text"
        placeholder={searchMode === 'company' ? "Type company name (e.g., hcl)..." : "Type 6-digit Pincode..."}
        className="w-full p-4 border border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-lg text-slate-800"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isSearching && <p className="text-slate-500 mt-4 animate-pulse">Searching database...</p>}

      {/* Results Display */}
      <div className="mt-4 space-y-4">
        {results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              
              {/* Left Side: Company Name / Pincode */}
              <div>
                {searchMode === 'company' ? (
                  <h3 className="text-[1.15rem] font-bold text-slate-900 tracking-tight">{item.company_name}</h3>
                ) : (
                  <h3 className="text-[1.15rem] font-bold text-slate-900 tracking-tight">{item.pincode}</h3>
                )}
              </div>

              {/* Right Side: File Name Pill & Category */}
              <div className="flex flex-col items-start md:items-end gap-1.5 w-full md:w-auto mt-2 md:mt-0">
                <div className="bg-slate-100/80 text-slate-700 text-sm font-medium px-3.5 py-1 rounded-full border border-slate-200">
                  File: {item.file_name || 'Unknown'}
                </div>
                <div className="text-[0.9rem]">
                  {searchMode === 'company' ? (
                    <span className="text-slate-500">
                      Category: <span className="text-blue-600 font-semibold">{item.category || 'N/A'}</span>
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      City: <span className="text-green-600 font-semibold">{item.city || 'N/A'}</span>
                    </span>
                  )}
                </div>
              </div>

            </div>
          ))
        ) : (
          query && !isSearching && (
            <div className="mt-6">
              {/* --- SMART INTELLIGENCE UI --- */}
              {suggestions.length > 0 ? (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg shadow-sm">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 text-amber-500 text-3xl mr-4">
                      💡
                    </div>
                    <div className="w-full">
                      <h3 className="text-xl font-bold text-amber-900">Exact Pincode Not Found</h3>
                      <p className="mt-1 text-amber-800 font-medium text-lg">
                        Pivot Script: <span className="italic">"Are you available in any of these nearby locations?"</span>
                      </p>
                      
                      {/* Suggestion Grid */}
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {suggestions.map((suggestion) => (
                          <div key={suggestion.id} className="bg-white p-3 border border-amber-200 rounded-lg shadow-sm flex flex-col justify-center items-center text-center">
                            <span className="font-black text-xl text-slate-900">{suggestion.pincode}</span>
                            <span className="text-sm text-slate-600 font-medium mt-1">{suggestion.city || 'Unknown City'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Standard fallback if absolutely nothing is nearby
                <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <p className="text-slate-500 text-lg">No results found for "{query}"</p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
