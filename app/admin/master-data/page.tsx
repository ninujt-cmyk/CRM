"use client";

import { useState } from 'react';

export default function MasterDataPage() {
  const [isUploading, setIsUploading] = useState(false);

  // Generates and downloads a sample CSV instantly without needing a server file
  const downloadSampleCSV = () => {
    const csvContent = [
      "id,company_name,pincode",
      "1,Tata Consultancy,400001",
      "2,Hanva Technologies PVT LTD,560001",
      "3,Reliance Industries,400021"
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_companies.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Send the file to your secure Next.js API route
      const response = await fetch('/api/admin/upload-companies', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        alert('Data uploaded successfully to search engine!');
      } else {
        alert('Upload failed. Please check the console or ensure your CSV matches the sample format.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
      // Optional: Reset the file input so they can upload the same file again if needed
      e.target.value = '';
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Master Data Management</h1>
      
      <div className="mb-8 p-6 border rounded-lg bg-gray-50 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Upload New Company Data</h2>
            <p className="text-sm text-gray-500 mt-1">Upload a CSV or JSON file to update the global search engine.</p>
          </div>
          
          <button 
            onClick={downloadSampleCSV}
            className="text-sm bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ↓ Download Sample CSV
          </button>
        </div>

        <div className="bg-white p-4 border border-dashed border-gray-300 rounded-md">
          <input 
            type="file" 
            accept=".csv, .json" 
            onChange={handleFileUpload}
            disabled={isUploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 disabled:opacity-50"
          />
        </div>
        
        {isUploading && (
          <div className="mt-3 flex items-center text-sm text-blue-600 font-medium">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Uploading and indexing data...
          </div>
        )}
      </div>

      {/* Insert the same search UI here so admins can verify the data */}
    </div>
  );
}
