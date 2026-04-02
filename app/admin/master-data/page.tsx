"use client";

import { useState, useEffect } from 'react';
import Papa from 'papaparse'; 
import { searchClient } from '@/lib/meilisearch'; // Added search client import

export default function MasterDataPage() {
  // --- UPLOAD STATE ---
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadType, setUploadType] = useState<'company' | 'pincode'>('company');
  const [file, setFile] = useState<File | null>(null);

  // --- DELETE STATE ---
  const [deleteFileName, setDeleteFileName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // --- SEARCH STATE ---
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // --- SEARCH FUNCTIONALITY ---
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const searchOptions = {
          limit: 10,
          attributesToSearchOn: searchMode === 'company' ? ['company_name'] : ['pincode'],
        };

        const result = await searchClient.index('companies').search(searchQuery, searchOptions);
        
        let validHits = result.hits;
        if (searchMode === 'pincode') {
          // Strict exact match for pincodes on the admin panel
          validHits = validHits.filter((item) => String(item.pincode) === searchQuery.trim());
        }

        setSearchResults(validHits);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceFn = setTimeout(() => performSearch(), 250);
    return () => clearTimeout(debounceFn);
  }, [searchQuery, searchMode]);

  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setSearchQuery('');
    setSearchResults([]);
  };

  // --- UPLOAD FUNCTIONS ---
  const downloadSample = () => {
    let csvContent = uploadType === 'company' 
      ? "company_name,category\nHanva Technologies PVT LTD,IT Software" 
      : "pincode,city\n560001,Bengaluru";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sample_${uploadType}_upload.csv`;
    link.click();
  };

  const handleUploadSubmit = () => {
    if (!file) return alert("Please select a file first.");
    
    setIsUploading(true);
    setUploadProgress({ current: 0, total: 0 });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const allRows = results.data;
        const totalRows = allRows.length;
        setUploadProgress({ current: 0, total: totalRows });

        const chunkSize = 2500; 
        
        for (let i = 0; i < totalRows; i += chunkSize) {
          const chunk = allRows.slice(i, i + chunkSize);
          
          try {
            const response = await fetch('/api/admin/upload-companies', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chunk: chunk,
                uploadType: uploadType,
                fileName: file.name
              }),
            });

            if (!response.ok) throw new Error("Batch failed");
            
            setUploadProgress(prev => ({ 
              ...prev, 
              current: Math.min(prev.current + chunkSize, totalRows) 
            }));
            
          } catch (error) {
            console.error("Upload interrupted:", error);
            alert(`Upload failed at row ${i}. Please check your connection.`);
            setIsUploading(false);
            return;
          }
        }

        alert("All data uploaded successfully!");
        setIsUploading(false);
        setFile(null);
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
        setIsUploading(false);
      }
    });
  };

  // --- DELETE FUNCTION ---
  const handleDeleteSubmit = async () => {
    if (!deleteFileName.trim()) {
      alert("Please enter the exact file name you want to delete.");
      return;
    }

    const confirmDelete = window.confirm(
      `WARNING: Are you sure you want to delete ALL data associated with "${deleteFileName}"? This cannot be undone.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/admin/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: deleteFileName.trim() }),
      });

      if (response.ok) {
        alert(`Deletion process started for "${deleteFileName}". It will be removed from the database shortly.`);
        setDeleteFileName(''); 
      } else {
        const errorData = await response.json();
        alert(`Delete failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("A network error occurred.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Master Data Management</h1>
      
      {/* --- UPLOAD SECTION --- */}
      <div className="p-6 border border-gray-200 rounded-xl bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-6">Upload Directory Data</h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">1. Select Data Type</label>
          <select 
            className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as 'company' | 'pincode')}
            disabled={isUploading}
          >
            <option value="company">Company Data (Company Name, Category)</option>
            <option value="pincode">Pincode Data (Pincode, City)</option>
          </select>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <button onClick={downloadSample} className="text-blue-600 font-medium hover:underline text-sm">
            Download Sample CSV Format
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">2. Select CSV file</label>
          <input 
            type="file" 
            accept=".csv" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={isUploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 cursor-pointer"
          />
        </div>

        {isUploading && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Uploading batches...</span>
              <span>{uploadProgress.current} / {uploadProgress.total} rows</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        )}

        <button 
          onClick={handleUploadSubmit}
          disabled={!file || isUploading}
          className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
            !file || isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isUploading ? 'Processing...' : 'Upload Data'}
        </button>
      </div>

      {/* --- DELETION SECTION --- */}
      <div className="p-6 border border-red-200 rounded-xl bg-red-50 shadow-sm">
        <h2 className="text-xl font-semibold mb-2 text-red-800">Delete File Data</h2>
        <p className="text-sm text-red-600 mb-6">
          Remove all records associated with a specific uploaded file. Type the exact file name (e.g., <span className="font-mono bg-red-100 px-1 rounded border border-red-200">ICICI.csv</span>).
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <input 
            type="text" 
            placeholder="Enter exact file name..." 
            value={deleteFileName}
            onChange={(e) => setDeleteFileName(e.target.value)}
            disabled={isDeleting}
            className="flex-1 p-3 border border-red-300 rounded-lg focus:ring-red-500 focus:border-red-500 outline-none"
          />
          <button 
            onClick={handleDeleteSubmit}
            disabled={!deleteFileName || isDeleting}
            className={`px-6 py-3 rounded-lg font-bold text-white transition-colors whitespace-nowrap ${
              !deleteFileName || isDeleting ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-md'
            }`}
          >
            {isDeleting ? 'Deleting...' : 'Delete File Data'}
          </button>
        </div>
      </div>

      {/* --- NEW: DATA VERIFICATION / SEARCH SECTION --- */}
      <div className="p-6 border border-gray-200 rounded-xl bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-6 text-gray-800">Verify Directory Data</h2>
        
        <div className="flex space-x-4 mb-6">
          <button 
            onClick={() => handleModeSwitch('company')} 
            className={`px-5 py-2 rounded-lg font-medium transition-colors text-sm ${searchMode === 'company' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Search by Company
          </button>
          <button 
            onClick={() => handleModeSwitch('pincode')} 
            className={`px-5 py-2 rounded-lg font-medium transition-colors text-sm ${searchMode === 'pincode' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Search by Pincode
          </button>
        </div>

        <input
          type="text"
          placeholder={searchMode === 'company' ? "Type company name to verify..." : "Type 6-digit Pincode to verify..."}
          className="w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-md mb-4"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {isSearching && <p className="text-gray-500 text-sm animate-pulse mb-4">Searching database...</p>}

        <div className="space-y-4">
          {searchResults.length > 0 ? (
            searchResults.map((item) => (
              <div key={item.id} className="p-4 border border-gray-200 rounded-lg bg-white flex flex-col md:flex-row md:items-center justify-between">
                
                {/* Left Side: Name / Pincode */}
                <div className="mb-2 md:mb-0">
                  {searchMode === 'company' ? (
                    <h3 className="text-lg font-bold text-gray-900">{item.company_name}</h3>
                  ) : (
                    <h3 className="text-lg font-bold text-gray-900">Pincode: {item.pincode}</h3>
                  )}
                </div>

                {/* Right Side: File Name Pill & Category/City (Styled from Image) */}
                <div className="flex flex-col items-start md:items-end text-sm">
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full border border-gray-200 mb-1">
                    File: {item.file_name || 'Unknown'}
                  </span>
                  
                  {searchMode === 'company' ? (
                    <span className="text-gray-500 mt-1">
                      Category: <span className="text-blue-600 font-semibold">{item.category || 'N/A'}</span>
                    </span>
                  ) : (
                    <span className="text-gray-500 mt-1">
                      City: <span className="text-green-600 font-semibold">{item.city || 'N/A'}</span>
                    </span>
                  )}
                </div>

              </div>
            ))
          ) : (
            searchQuery && !isSearching && (
              <p className="text-gray-500 text-sm">No records found for "{searchQuery}"</p>
            )
          )}
        </div>
      </div>

    </div>
  );
}
