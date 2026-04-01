import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/meilisearch';
import Papa from 'papaparse';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 1. Grab the actual name of the uploaded file (e.g., "Delhi_Leads_2026.csv")
    const uploadedFileName = file.name; 

    const fileText = await file.text();
    let data: any[] = [];

    if (file.name.toLowerCase().endsWith('.csv')) {
      const parsedCsv = Papa.parse(fileText, {
        header: true,
        skipEmptyLines: true,
      });
      data = parsedCsv.data;
    } else if (file.name.toLowerCase().endsWith('.json')) {
      data = JSON.parse(fileText);
    } else {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
    }

    // 2. Inject the file name into every row and clean the data
    const formattedData = data.map((row) => {
      if (row.company_name) {
        row.company_name = row.company_name
          .replace(/\bpvt\.?\b/gi, 'PVT')
          .replace(/\bltd\.?\b/gi, 'LTD');
      }
      
      // Attach the file name to the row so the telecaller can see it later
      row.file_name = uploadedFileName; 
      
      return row;
    });

    const client = adminClient();
    const task = await client.index('companies').addDocuments(formattedData);

    return NextResponse.json({ success: true, taskUid: task.taskUid });

  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Failed to upload data' }, { status: 500 });
  }
}
