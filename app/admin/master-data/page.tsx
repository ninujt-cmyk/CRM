"use client";

import { useState } from 'react';
// You would also include your search bar here similar to the telecaller page

export default function MasterDataPage() {
  const [isUploading, setIsUploading] = useState(false);

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
        alert('Upload failed.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Master Data Management</h1>
      
      <div className="mb-8 p-6 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Upload New Company Data (CSV/JSON)</h2>
        <input 
          type="file" 
          accept=".csv, .json" 
          onChange={handleFileUpload}
          disabled={isUploading}
        />
        {isUploading && <p className="mt-2 text-blue-600">Uploading to Meilisearch...</p>}
      </div>

      {/* Insert the same search UI here so admins can verify the data */}
    </div>
  );
}
