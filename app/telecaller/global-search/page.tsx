"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';

export default function TelecallerSearchPage() {
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // NEW: Track which items the telecaller has already clicked/processed
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setQuery('');
    setResults([]);
    setSuggestions([]);
  };

  // NEW: One-click copy and mark as processed
  const handleProcessItem = (item: any) => {
    const textToCopy = searchMode === 'company' 
      ? `Company: ${item.company_name} | File: ${item.file_name} | Category: ${item.category}`
      : `Pincode: ${item.pincode} | City: ${item.city} | File: ${item.file_name}`;
    
    navigator.clipboard.writeText(textToCopy);
    
    // Add to processed list to change UI color
    setProcessedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(item.id);
      return newSet;
    });
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
          // NEW: Tell Meilisearch to highlight the matched text
          attributesToHighlight: ['*'], 
        };

        const searchResult = await searchClient.index('companies').search(query, searchOptions);
        
        let validHits = searchResult.hits;
        if (searchMode === 'pincode') {
          validHits = validHits.filter((item) => String(item.pincode) === query.trim());
        }

        setResults(validHits);
        setSuggestions([]); 

        // Smart Pincode Suggestions
        if (searchMode === 'pincode' && validHits.length === 0 && query.length >= 4) {
          const prefix = query.length === 6 ? query.substring(0, 4) : query.substring(0, 3);
          const suggestionResult = await searchClient.index('companies').search(prefix, {
            limit: 6,
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

    const debounceFn = setTimeout(() => performSearch(), 200); // Reduced to 200ms for faster typing feel
    return () => clearTimeout(debounceFn);
  }, [query, searchMode]);

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Telecaller Directory</h1>
      
      {/* Search Mode Toggles */}
      <div className="flex space-x-3 mb-6">
        <button 
          onClick={() => handleModeSwitch('company')}
          className={`px-5 py-2 rounded-md font-medium text-sm transition-colors ${
            searchMode === 'company' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          Company Search
        </button>
        <button 
          onClick={() => handleModeSwitch('pincode')}
          className={`px-5 py-2 rounded-md font-medium text-sm transition-colors ${
            searchMode === 'pincode' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          Pincode Search
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-8">
        <input
          type="text"
          placeholder={searchMode === 'company' ? "hcl" : "Type 6-digit Pincode..."}
          className="w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-lg bg-white"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isSearching && <span className="absolute right-4 top-4 text-gray-400 text-sm animate-pulse">Searching...</span>}
      </div>

      {/* Results Display */}
      <div className="space-y-4">
        {results.length > 0 ? (
          results.map((item) => {
            const isProcessed = processedIds.has(item.id);
            const fileNameFormatted = item.file_name || 'Unknown.csv';

            return (
              <div 
                key={item.id} 
                onClick={() => handleProcessItem(item)}
                className={`p-5 border rounded-xl shadow-sm transition-all cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  isProcessed ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                }`}
                title="Click to copy and mark as processed"
              >
                {/* Left Side: Highlighted Match */}
                <div className="flex-1">
                  {searchMode === 'company' ? (
                    // Using _formatted to display Meilisearch's automatic <em> highlighting
                    <h3 
                      className="text-lg font-bold text-gray-900 uppercase"
                      dangerouslySetInnerHTML={{ __html: item._formatted?.company_name || item.company_name }}
                    />
                  ) : (
                    <h3 
                      className="text-lg font-bold text-gray-900"
                      dangerouslySetInnerHTML={{ __html: `Pincode: ${item._formatted?.pincode || item.pincode}` }}
                    />
                  )}
                  {isProcessed && <span className="text-xs font-bold text-green-600 uppercase tracking-wider mt-1 block">✓ Copied & Processed</span>}
                </div>

                {/* Right Side: File & Category Tags */}
                <div className="flex flex-col items-start md:items-end gap-2">
                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm border border-gray-200 whitespace-nowrap">
                    File: {fileNameFormatted}
                  </span>
                  
                  {searchMode === 'company' ? (
                    <span className="text-sm text-gray-500">
                      Category: <span className="text-blue-600 font-semibold">{item.category || 'N/A'}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">
                      City: <span className="text-green-600 font-semibold">{item.city || 'N/A'}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          query && !isSearching && (
            <div>
              {suggestions.length > 0 ? (
                <div className="bg-amber-50 border border-amber-200 p-5 rounded-lg shadow-sm">
                  <h3 className="text-lg font-bold text-amber-900 mb-2">Pincode Not Found</h3>
                  <p className="text-amber-800 text-sm mb-4">Ask the customer: <i>"Are you available in any of these nearby locations?"</i></p>
                  
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <span key={suggestion.id} className="bg-white border border-amber-300 px-3 py-1 rounded-md text-sm font-bold text-gray-800 shadow-sm">
                        {suggestion.pincode} <span className="font-normal text-gray-500 ml-1">({suggestion.city})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No results found for "{query}".
                </div>
              )}
            </div>
          )
        )}
      </div>
      
      {/* Add some global CSS for the Meilisearch highlight tags */}
      <style dangerouslySetInnerHTML={{__html: `
        em {
          font-style: normal;
          background-color: #fef08a; /* Yellow highlight */
          color: #000;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}} />
    </div>
  );
}
