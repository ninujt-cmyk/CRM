// uploadData.js
const { MeiliSearch } = require('meilisearch');
const companies = require('./companies.json'); // Your test data

const client = new MeiliSearch({
  host: 'https://hanva-search.onrender.com',
  apiKey: 'CreateAStrongPasswordHere123!',
});

async function setupDatabase() {
  try {
    // 1. Create an index (think of this like a table)
    const index = client.index('companies');

    // 2. Add the documents
    const response = await index.addDocuments(companies);
    console.log('Upload started! Task details:', response);
    
    // 3. Make pincode and company_name searchable
    await index.updateSearchableAttributes([
      'company_name',
      'pincode'
    ]);
    
    console.log('Success! Data is indexing.');
  } catch (error) {
    console.error('Error:', error);
  }
}

setupDatabase();
