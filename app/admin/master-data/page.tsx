"use client";

import { useState, useEffect } from 'react';
import Papa from 'papaparse'; 
import { searchClient } from '@/lib/meilisearch';
import { 
  Database, UploadCloud, Trash2, Search, 
  FileText, AlertTriangle, Building2, MapPin, Loader2, Download
} from 'lucide-react';

export default function MasterDataPage() {
  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadType, setUploadType] = useState<'company' | 'pincode'>('company');
  const [file, setFile] = useState<File | null>(null);

  // Delete State
  const [deleteFileName, setDeleteFileName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Search State
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
          validHits = validHits.filter((item) => String(item.pincode) === searchQuery.trim());
        }

        setSearchResults(validHits);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceFn = setTimeout(() => performSearch(), 300);
    return () => clearTimeout(debounceFn);
  }, [searchQuery, searchMode]);

  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setSearchQuery('');
    setSearchResults([]);
  };

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
        alert(`Deletion process started for "${deleteFileName}".`);
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
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
          <Database className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Master Data</h1>
          <p className="text-slate-500 text-sm mt-1">Manage global directories and serviceable pincodes.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* --- UPLOAD SECTION --- */}
        <div className="p-6 sm:p-8 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-2 mb-6">
            <UploadCloud className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-800">Upload Directory</h2>
          </div>
          
          <div className="space-y-6 flex-1">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">1. Data Type</label>
              <select 
                className="w-full p-3.5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium text-slate-700"
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as 'company' | 'pincode')}
                disabled={isUploading}
              >
                <option value="company">🏢 Company Directory</option>
                <option value="pincode">📍 Serviceable Pincodes</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                 <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wide">2. Select CSV</label>
                 <button onClick={downloadSample} className="flex items-center gap-1 text-blue-600 font-semibold hover:text-blue-800 transition-colors text-xs bg-blue-50 px-2 py-1 rounded">
                   <Download className="w-3 h-3" /> Sample
                 </button>
              </div>
              
              {/* Custom Styled File Input */}
              <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${file ? 'border-blue-400 bg-blue-50/50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {file ? (
                    <>
                      <FileText className="w-8 h-8 text-blue-500 mb-2" />
                      <p className="text-sm font-semibold text-blue-700 truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-blue-500 mt-1">Ready to upload</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                      <p className="mb-1 text-sm font-semibold text-slate-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-slate-500">CSV files only</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={isUploading}
                  className="hidden" 
                />
              </label>
            </div>

            {isUploading && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex justify-between text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">
                  <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>
                  <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100) || 0}%</span>
                </div>
                <div className="w-full bg-blue-200/50 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-blue-600 mt-2 font-mono text-right">{uploadProgress.current} / {uploadProgress.total} rows</p>
              </div>
            )}
          </div>

          <button 
            onClick={handleUploadSubmit}
            disabled={!file || isUploading}
            className={`mt-6 w-full py-3.5 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
              !file || isUploading ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-blue-700 shadow-md hover:shadow-lg'
            }`}
          >
            {isUploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : <><UploadCloud className="w-5 h-5" /> Start Upload</>}
          </button>
        </div>

        {/* --- DELETION SECTION --- */}
        <div className="p-6 sm:p-8 border border-red-200 rounded-2xl bg-red-50/50 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-bold text-red-800">Purge Dataset</h2>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm mb-6 flex items-start gap-3">
             <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
             <p className="text-sm text-slate-600 leading-relaxed">
              Remove all records injected by a specific upload. Enter the exact filename (e.g., <span className="font-mono bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-bold">batch_01.csv</span>) to purge its data.
            </p>
          </div>

          <div className="flex flex-col gap-4 mt-auto">
            <div>
               <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">Target Filename</label>
               <input 
                 type="text" 
                 placeholder="Exact filename.csv..." 
                 value={deleteFileName}
                 onChange={(e) => setDeleteFileName(e.target.value)}
                 disabled={isDeleting}
                 className="w-full p-3.5 bg-white border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all font-mono"
               />
            </div>
            <button 
              onClick={handleDeleteSubmit}
              disabled={!deleteFileName || isDeleting}
              className={`w-full py-3.5 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                !deleteFileName || isDeleting ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg'
              }`}
            >
              {isDeleting ? <><Loader2 className="w-5 h-5 animate-spin" /> Purging Data...</> : <><Trash2 className="w-5 h-5" /> Confirm Deletion</>}
            </button>
          </div>
        </div>
      </div>

      {/* --- DATA VERIFICATION SECTION --- */}
      <div className="p-6 sm:p-8 border border-slate-200 rounded-2xl bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
           <div className="flex items-center gap-2">
             <Search className="w-5 h-5 text-blue-600" />
             <h2 className="text-xl font-bold text-slate-800">Verify Live Data</h2>
           </div>
           
           <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-fit shadow-inner">
             <button 
               onClick={() => handleModeSwitch('company')} 
               className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-semibold text-xs transition-all ${searchMode === 'company' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900'}`}
             >
               Companies
             </button>
             <button 
               onClick={() => handleModeSwitch('pincode')} 
               className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-semibold text-xs transition-all ${searchMode === 'pincode' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900'}`}
             >
               Pincodes
             </button>
           </div>
        </div>

        <div className="relative mb-6 group">
           <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <Search className={`h-5 w-5 transition-colors ${isSearching ? 'text-blue-500' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
           </div>
           <input
             type="text"
             placeholder={searchMode === 'company' ? "Type company name to verify..." : "Type 6-digit Pincode to verify..."}
             className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
        </div>

        <div className="space-y-3">
          {searchResults.length > 0 ? (
            searchResults.map((item) => (
              <div key={item.id} className="p-4 border border-slate-200 hover:border-blue-200 rounded-xl bg-white flex flex-col md:flex-row md:items-center justify-between transition-colors shadow-sm hover:shadow">
                
                <div className="mb-3 md:mb-0 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${searchMode === 'company' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                     {searchMode === 'company' ? <Building2 className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                  </div>
                  <div>
                    {searchMode === 'company' ? (
                      <h3 className="text-base font-bold text-slate-900">{item.company_name}</h3>
                    ) : (
                      <h3 className="text-base font-bold text-slate-900">{item.pincode}</h3>
                    )}
                    <span className="text-xs text-slate-400 font-mono mt-0.5 block truncate max-w-[250px]">
                      Source: {item.file_name || 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center">
                  {searchMode === 'company' ? (
                    <span className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Category</span>
                      {item.category || 'Uncategorized'}
                    </span>
                  ) : (
                    <span className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">City</span>
                      {item.city || 'Unknown'}
                    </span>
                  )}
                </div>

              </div>
            ))
          ) : (
            searchQuery && !isSearching && (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-500 text-sm">No records found matching "{searchQuery}"</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
