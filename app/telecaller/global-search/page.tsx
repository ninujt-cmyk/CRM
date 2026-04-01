"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';

export default function TelecallerSearchPage() {
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Verification State
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyingFile, setVerifyingFile] = useState<string | null>(null); // Added to track the file requirement
  const [pinQuery, setPinQuery] = useState('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'found' | 'missing'>('idle');
  const [pinResultData, setPinResultData] = useState<any>(null);

  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setVerifyingId(null);
    setVerifyingFile(null);
  };

  // 1. The Main Search Effect
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
        
        let validHits = searchResult.hits;
        if (searchMode === 'pincode') {
          validHits = validHits.filter((item) => String(item.pincode) === query.trim());
        }

        setResults(validHits);
        setSuggestions([]); 

        // Smart Intelligence for main pincode tab
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

    const debounceFn = setTimeout(() => performSearch(), 250);
    return () => clearTimeout(debounceFn);
  }, [query, searchMode]);

  // 2. The INTELLIGENT Intersection Verification Effect
  useEffect(() => {
    const verifyInlinePincode = async () => {
      if (pinQuery.length !== 6 || !verifyingFile) {
        setPinStatus('idle');
        setPinResultData(null);
        return;
      }

      setPinStatus('loading');
      try {
        // Fetch a larger limit just in case a pincode exists across many files
        const result = await searchClient.index('companies').search(pinQuery, {
          limit: 50, 
          attributesToSearchOn: ['pincode'],
        });

        // THE MAGIC: It must exactly match the pincode AND exactly match the company's file name
        const exactMatch = result.hits.find(
          (item) => String(item.pincode) === pinQuery && item.file_name === verifyingFile
        );

        if (exactMatch) {
          setPinResultData(exactMatch);
          setPinStatus('found');
        } else {
          setPinStatus('missing');
        }
      } catch (error) {
        console.error('Inline verification failed:', error);
        setPinStatus('missing');
      }
    };

    verifyInlinePincode();
  }, [pinQuery, verifyingFile]);

  // Function to open the verification panel and lock in the required file
  const openVerification = (id: string, fileName: string) => {
    if (verifyingId === id) {
      setVerifyingId(null); 
      setVerifyingFile(null);
    } else {
      setVerifyingId(id);
      setVerifyingFile(fileName);
      setPinQuery(''); 
      setPinStatus('idle');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      
      {/* Search Input Bar (Matches your clean UI) */}
      <div className="mb-8">
        <input
          type="text"
          placeholder={searchMode === 'company' ? "hcl..." : "Type 6-digit Pincode..."}
          className="w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-lg bg-white"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isSearching && <p className="text-gray-500 mb-4 animate-pulse">Searching...</p>}

      <div className="space-y-4">
        {results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              
              {/* Card Header matching the uploaded image */}
              <div className="p-5 flex justify-between items-start">
                <div className="flex-1 pr-4 mt-1">
                  {searchMode === 'company' ? (
                    <h3 className="text-lg font-bold text-gray-900 tracking-tight">{item.company_name}</h3>
                  ) : (
                    <h3 className="text-lg font-bold text-gray-900 tracking-tight">{item.pincode}</h3>
                  )}
                </div>

                <div className="flex flex-col items-end">
                  {/* File Pill without "File:" and without ".csv" */}
                  <div className="bg-gray-100 text-gray-700 text-sm px-4 py-1.5 rounded-full border border-gray-200">
                    {item.file_name ? item.file_name.replace(/\.[^/.]+$/, "").replace(/^File:\s*/i, "") : 'UNKNOWN'}
                  </div>
                  
                  {/* Category/City below the pill */}
                  <div className="mt-2 text-sm text-gray-500">
                    {searchMode === 'company' ? (
                      <>Category: <span className="font-semibold text-blue-600">{item.category || 'N/A'}</span></>
                    ) : (
                      <>City: <span className="font-semibold text-blue-600">{item.city || 'N/A'}</span></>
                    )}
                  </div>
                </div>
              </div>

              {/* Verification Panel Section */}
              {searchMode === 'company' && (
                <div className="border-t border-gray-100 bg-gray-50">
                  <button 
                    onClick={() => openVerification(item.id, item.file_name)}
                    className="w-full py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {verifyingId === item.id ? 'Close Verification ✕' : 'Verify Customer Pincode 📍'}
                  </button>

                  {/* Inline Pincode Checker panel */}
                  {verifyingId === item.id && (
                    <div className="p-6 bg-blue-50/50 border-t border-blue-100">
                      <p className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                        Is this location approved for the {item.file_name.replace(/\.[^/.]+$/, "")} campaign?
                      </p>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit Pincode..."
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-inner focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-lg bg-white"
                        value={pinQuery}
                        onChange={(e) => setPinQuery(e.target.value.replace(/[^0-9]/g, ''))}
                        autoFocus
                      />

                      {/* Live Status Indicators */}
                      <div className="mt-4 h-12 flex items-center">
                        {pinStatus === 'idle' && pinQuery.length > 0 && pinQuery.length < 6 && (
                          <p className="text-gray-500 text-sm">Keep typing...</p>
                        )}
                        {pinStatus === 'loading' && (
                          <p className="text-blue-500 text-sm animate-pulse font-medium">Checking intersection...</p>
                        )}
                        {pinStatus === 'found' && pinResultData && (
                          <div className="w-full bg-green-100 border border-green-300 p-3 rounded-lg flex items-center justify-between shadow-sm">
                            <span className="text-green-800 font-bold flex items-center gap-2">
                              ✅ Approved Match
                            </span>
                            <span className="text-green-700 font-medium text-sm">
                              City: {pinResultData.city}
                            </span>
                          </div>
                        )}
                        {pinStatus === 'missing' && (
                          <div className="w-full bg-red-100 border border-red-300 p-3 rounded-lg shadow-sm">
                            <span className="text-red-800 font-bold flex items-center gap-2">
                              ❌ Pincode Not Available in this Campaign File
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
           /* Keeping your existing suggestions UI down here... */
          query && !isSearching && (
             // ... Your existing suggestions code ...
            <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500 text-lg">No results found for "{query}"</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
