import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/meilisearch';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Note: If uploading large CSVs, you will need to parse the CSV text into JSON here
    // using a library like 'papaparse' or 'csv-parse' before sending to Meilisearch.
    const fileText = await file.text();
    const data = JSON.parse(fileText); // Assuming JSON for this example

    const client = adminClient();
    
    // Add documents to the 'companies' index securely
    const task = await client.index('companies').addDocuments(data);

    return NextResponse.json({ success: true, taskUid: task.taskUid });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Failed to upload data' }, { status: 500 });
  }
}
