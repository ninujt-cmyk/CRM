"use client";

import { useState } from 'react';
import Papa from 'papaparse'; // We now use PapaParse on the client side

export default function MasterDataPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadType, setUploadType] = useState<'company' | 'pincode'>('company');
  const [file, setFile] = useState<File | null>(null);

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

    // Parse the file in the browser to avoid server memory crashes
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const allRows = results.data;
        const totalRows = allRows.length;
        setUploadProgress({ current: 0, total: totalRows });

        // Chunk size: 2500 rows per request (safe for Free Tier servers)
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
            
            // Update progress bar
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

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Master Data Management</h1>
      
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

        {/* Live Progress Bar */}
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
    </div>
  );
}
