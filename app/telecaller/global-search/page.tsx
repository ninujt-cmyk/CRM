"use client";

import { useState, useEffect, useRef } from 'react';
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
  const [copySuccess, setCopySuccess] = useState(false);

  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setVerifyingId(null);
  };

  // 1. Main Search Effect
  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const searchResult = await searchClient.index('companies').search(query, {
          limit: 15,
          attributesToSearchOn: searchMode === 'company' ? ['company_name'] : ['pincode'],
        });
        
        let validHits = searchResult.hits;
        
        // If searching pincode, ensure it's an exact match from the start
        if (searchMode === 'pincode') {
          validHits = validHits.filter((item) => String(item.pincode) === query.trim());
        }

        setResults(validHits);
        setSuggestions([]); 

        // Smart Intelligence: Suggest nearby pincodes if exact match fails
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

  // 2. Inline Pincode Verification Effect
  useEffect(() => {
    const verifyInlinePincode = async () => {
      if (pinQuery.length !== 6) {
        setPinStatus('idle');
        setPinResultData(null);
        setCopySuccess(false);
        return;
      }

      setPinStatus('loading');
      try {
        const result = await searchClient.index('companies').search(pinQuery, {
          limit: 10,
          attributesToSearchOn: ['pincode'],
          // Optional: filter: "data_type = 'pincode'" if you added that to Meilisearch filterable attributes
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
      setCopySuccess(false);
    }
  };

  // --- NEW: Productivity Workflow ---
  const handleProceed = (companyName: string) => {
    const copyText = `Company: ${companyName}\nPincode: ${pinResultData.pincode}\nCity: ${pinResultData.city}\nStatus: Serviceable`;
    navigator.clipboard.writeText(copyText);
    setCopySuccess(true);
    
    // Auto-close and reset after copying so they are ready for the next call
    setTimeout(() => {
      setVerifyingId(null);
      setQuery(''); 
      setCopySuccess(false);
    }, 1500);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Telecaller Workspace</h1>
      
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
        placeholder={searchMode === 'company' ? "Type company name (e.g., HCL)..." : "Type 6-digit Pincode..."}
        className="w-full p-4 border-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-xl font-medium"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {isSearching && <p className="text-blue-500 mt-4 font-medium animate-pulse">Scanning database...</p>}

      <div className="mt-6 space-y-6">
        {results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className={`border border-gray-200 rounded-xl bg-white shadow-md transition-all flex flex-col relative overflow-hidden ${verifyingId === item.id ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-lg'}`}>
              
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"></div>
              
              <div className="p-6 pb-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Matched File</span>
                    <div className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-sm font-bold px-3 py-1 rounded mt-1 inline-block">
                      {item.file_name ? item.file_name.replace(/\.[^/.]+$/, "") : 'UNKNOWN FILE'}
                    </div>
                  </div>
                  {searchMode === 'company' && (
                     <div className="text-right">
                       <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Category</span>
                       <div className="text-blue-700 font-bold">{item.category || 'Open Market'}</div>
                     </div>
                  )}
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="text-center md:text-left w-full">
                    {searchMode === 'company' ? (
                      <h3 className="text-2xl font-black text-gray-900">{item.company_name}</h3>
                    ) : (
                      <div className="flex justify-between w-full">
                        <h3 className="text-2xl font-black text-gray-900">{item.pincode}</h3>
                        <span className="text-green-700 font-bold text-xl">{item.city || 'N/A'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* INTELLIGENT TWO-STEP VERIFICATION */}
              {searchMode === 'company' && (
                <div className="border-t border-gray-100 bg-gray-50">
                  <button 
                    onClick={() => openVerification(item.id)}
                    className="w-full py-4 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 outline-none focus:bg-blue-100"
                  >
                    {verifyingId === item.id ? 'Cancel Verification ✕' : 'Step 2: Verify Pincode Serviceability 📍'}
                  </button>

                  {/* Inline Checker Panel */}
                  {verifyingId === item.id && (
                    <div className="p-6 bg-blue-50/50 border-t border-blue-100">
                      <p className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                        Ask Customer: "Could you confirm your 6-digit Pincode?"
                      </p>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Type exactly 6 digits..."
                        className="w-full p-4 border-2 border-gray-300 rounded-lg shadow-inner focus:border-blue-600 focus:ring-2 focus:ring-blue-600 outline-none font-mono text-2xl tracking-[0.5em] text-center"
                        value={pinQuery}
                        onChange={(e) => setPinQuery(e.target.value.replace(/[^0-9]/g, ''))}
                        autoFocus
                      />

                      {/* Live Actionable Status */}
                      <div className="mt-4 min-h-[60px] flex items-center">
                        {pinStatus === 'loading' && (
                          <p className="text-blue-500 font-bold animate-pulse w-full text-center">Querying Server...</p>
                        )}
                        
                        {pinStatus === 'found' && pinResultData && (
                          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="bg-green-100 border border-green-300 p-3 rounded-lg shadow-sm flex-1 w-full">
                              <span className="text-green-800 font-black flex items-center gap-2 text-lg">
                                ✅ Approved: {pinResultData.city}
                              </span>
                              <p className="text-green-900 text-sm mt-1 italic">
                                "Great news, we service your area in {pinResultData.city}!"
                              </p>
                            </div>
                            
                            {/* THE NEXT ACTION BUTTON */}
                            <button 
                              onClick={() => handleProceed(item.company_name)}
                              className={`px-6 py-4 rounded-lg font-black text-white shadow-md transition-all whitespace-nowrap ${copySuccess ? 'bg-gray-800' : 'bg-green-600 hover:bg-green-500 hover:-translate-y-1'}`}
                            >
                              {copySuccess ? '✓ Details Copied!' : 'Proceed to Lead 🚀'}
                            </button>
                          </div>
                        )}

                        {pinStatus === 'missing' && (
                          <div className="w-full bg-red-50 border border-red-200 p-3 rounded-lg shadow-sm">
                            <span className="text-red-700 font-black flex items-center gap-2 text-lg">
                              ❌ Out of Service Area
                            </span>
                            <p className="text-red-900 text-sm mt-1 italic">
                              "Unfortunately, we are not currently servicing that specific pincode."
                            </p>
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
          /* Suggestion Logic remains identical */
          query && !isSearching && (
             // ... your existing empty state / pivot script code here ...
             <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
               <p className="text-gray-500 text-lg">No results found.</p>
             </div>
          )
        )}
      </div>
    </div>
  );
}
