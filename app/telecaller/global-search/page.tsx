"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';

export default function TelecallerSearchPage() {
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Contextual Verification State
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [pinQuery, setPinQuery] = useState('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'found' | 'missing'>('idle');
  const [pinResultData, setPinResultData] = useState<any>(null);
  
  // New: Clipboard success state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setVerifyingId(null);
    setCopiedId(null);
  };

  // 1. The Main Search Effect
  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        setSuggestions([]);
        setVerifyingId(null); // Auto-close verification if they clear the search
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

  // 2. The Inline Pincode Verification Effect
  useEffect(() => {
    const verifyInlinePincode = async () => {
      if (pinQuery.length !== 6) {
        setPinStatus('idle');
        setPinResultData(null);
        return;
      }

      setPinStatus('loading');
      try {
        const result = await searchClient.index('companies').search(pinQuery, {
          limit: 5,
          attributesToSearchOn: ['pincode'],
        });

        const exactMatch = result.hits.find((item) => String(item.pincode) === pinQuery);

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
  }, [pinQuery]);

  const openVerification = (id: string) => {
    if (verifyingId === id) {
      setVerifyingId(null);
    } else {
      setVerifyingId(id);
      setPinQuery('');
      setPinStatus('idle');
      setCopiedId(null);
    }
  };

  // --- NEW: The Productivity Payload Generator ---
  const handleCopyAndProcess = async (companyItem: any, pincodeItem: any) => {
    const payload = `COMPANY: ${companyItem.company_name}
CATEGORY: ${companyItem.category || 'N/A'}
FILE: ${companyItem.file_name ? companyItem.file_name.replace(/\.[^/.]+$/, "") : 'UNKNOWN'}
PINCODE: ${pincodeItem.pincode}
CITY: ${pincodeItem.city || 'N/A'}
STATUS: 100% Verified`;

    try {
      await navigator.clipboard.writeText(payload);
      setCopiedId(companyItem.id);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Telecaller Directory</h1>
      
      <div className="flex space-x-4 mb-6">
        <button onClick={() => handleModeSwitch('company')} className={`px-6 py-2 rounded-lg font-medium transition-colors ${searchMode === 'company' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
          Search by Company Name
        </button>
        <button onClick={() => handleModeSwitch('pincode')} className={`px-6 py-2 rounded-lg font-medium transition-colors ${searchMode === 'pincode' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
          Search by Pincode
        </button>
      </div>

      <input
        type="text"
        placeholder={searchMode === 'company' ? "Type company name (e.g., Hanva)..." : "Type 6-digit Pincode..."}
        className="w-full p-4 border-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-lg"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isSearching && <p className="text-blue-500 font-medium mt-4 animate-pulse">Scanning database...</p>}

      <div className="mt-6 space-y-6">
        {results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className={`border border-gray-200 rounded-xl bg-white shadow-md transition-all flex flex-col relative overflow-hidden ${verifyingId === item.id ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'}`}>
              
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"></div>
              
              <div className="p-6 pb-4">
                <div className="flex justify-between items-center w-full mb-4 mt-2">
                  <h3 className="text-xl md:text-2xl font-black text-gray-900 leading-tight">
                    {searchMode === 'company' ? item.company_name : `Pincode: ${item.pincode}`}
                  </h3>
                  
                  <div className="bg-gray-100 text-gray-600 border border-gray-200 text-xs md:text-sm font-bold px-4 py-1.5 rounded-full text-center tracking-wide">
                    File: {item.file_name ? item.file_name.replace(/\.[^/.]+$/, "") : 'UNKNOWN'}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="text-lg w-full">
                    {searchMode === 'company' ? (
                      <span className="text-blue-700 font-semibold flex items-center gap-2">
                        <span className="text-gray-500 font-normal text-sm uppercase tracking-wider">Category:</span> 
                        {item.category || 'N/A'}
                      </span>
                    ) : (
                      <span className="text-green-700 font-semibold flex items-center gap-2">
                        <span className="text-gray-500 font-normal text-sm uppercase tracking-wider">City:</span> 
                        {item.city || 'N/A'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* INTELLIGENT TWO-STEP VERIFICATION */}
              {searchMode === 'company' && (
                <div className="border-t border-gray-100 bg-gray-50">
                  <button 
                    onClick={() => openVerification(item.id)}
                    className={`w-full py-4 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${verifyingId === item.id ? 'bg-blue-100 text-blue-800' : 'text-blue-600 hover:bg-blue-50'}`}
                  >
                    {verifyingId === item.id ? 'Close Verification ✕' : 'Verify Customer Pincode 📍'}
                  </button>

                  {/* Inline Pincode Checker panel */}
                  {verifyingId === item.id && (
                    <div className="p-6 bg-blue-50/50 border-t border-blue-100">
                      <p className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                        Is this customer's location serviceable?
                      </p>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Ask customer for 6-digit Pincode..."
                        className="w-full p-4 border-2 border-blue-200 rounded-lg shadow-inner focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none font-mono text-xl tracking-widest transition-all"
                        value={pinQuery}
                        onChange={(e) => setPinQuery(e.target.value.replace(/[^0-9]/g, ''))}
                        autoFocus
                      />

                      {/* Live Status Indicators & Action Buttons */}
                      <div className="mt-4 min-h-[60px] flex flex-col justify-center">
                        {pinStatus === 'idle' && pinQuery.length > 0 && pinQuery.length < 6 && (
                          <p className="text-gray-500 text-sm font-medium">Keep typing...</p>
                        )}
                        {pinStatus === 'loading' && (
                          <p className="text-blue-600 text-sm animate-pulse font-bold">Checking database...</p>
                        )}
                        
                        {/* THE PRODUCTIVITY PAYLOAD BUTTON */}
                        {pinStatus === 'found' && pinResultData && (
                          <div className="w-full mt-2 bg-green-50 border border-green-400 p-4 rounded-xl flex flex-col gap-4 shadow-sm animate-fade-in-up">
                            <div className="flex items-center justify-between">
                              <span className="text-green-800 font-black flex items-center gap-2 text-lg tracking-tight">
                                ✅ 100% Serviceable Lead
                              </span>
                              <span className="text-green-800 font-bold bg-green-200 border border-green-300 px-3 py-1 rounded-full text-sm">
                                {pinResultData.city}
                              </span>
                            </div>
                            
                            <button 
                              onClick={() => handleCopyAndProcess(item, pinResultData)}
                              className={`w-full font-bold py-4 rounded-lg shadow-md transition-all active:scale-95 flex justify-center items-center gap-2 text-lg ${copiedId === item.id ? 'bg-gray-800 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                            >
                              {copiedId === item.id ? '✅ Copied to Clipboard!' : '📋 Copy & Process Lead'}
                            </button>
                          </div>
                        )}

                        {pinStatus === 'missing' && (
                          <div className="w-full bg-red-50 border border-red-300 p-4 rounded-lg shadow-sm">
                            <span className="text-red-700 font-bold flex items-center gap-2 text-lg">
                              ❌ Pincode Not Serviceable
                            </span>
                            <p className="text-red-600 text-sm mt-1">Apologize and disconnect, or ask for an alternative address.</p>
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
          query && !isSearching && (
            <div>
              {suggestions.length > 0 ? (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg shadow-sm">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 text-amber-500 text-3xl mr-4">💡</div>
                    <div className="w-full">
                      <h3 className="text-xl font-bold text-amber-900">Exact Pincode Not Found</h3>
                      <p className="mt-1 text-amber-800 font-medium text-lg">
                        Pivot Script: <span className="italic">"Are you available in any of these nearby locations?"</span>
                      </p>
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {suggestions.map((suggestion) => (
                          <div key={suggestion.id} className="bg-white p-3 border border-amber-200 rounded-lg shadow-sm flex flex-col justify-center items-center text-center">
                            <span className="font-black text-xl text-gray-900">{suggestion.pincode}</span>
                            <span className="text-sm text-gray-600 font-medium mt-1">{suggestion.city || 'Unknown City'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-gray-500 text-lg">No results found for "{query}"</p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
