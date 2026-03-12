/*
Migration script: migrate_realtime_to_mongo.js

This script is intentionally generic and safe-by-default. It accepts an existing MongoDB URI via MONGODB_URI environment variable and performs migration operations.

Important design notes:
 - When running in docker-socket mode the helper wrapper (scripts/docker-run-migration.sh) will launch a temporary MongoDB container and inject MONGODB_URI for this script to use.
 - This script focuses on taking a JSON export (if provided) or connecting to a live source via a configured connector (not implemented). Replace the placeholder migration logic with your realtime source extraction steps.
 - Always test in a sandbox and verify writes using a read-only preview before performing irreversible operations on production data.
*/

const { MongoClient } = require('mongodb');
const fs = require('fs');

const uri = process.env.MONGODB_URI;
const sourceJson = process.env.SOURCE_JSON_PATH || '/tmp/source_export.json'; // optional

if (!uri) {
  console.error('MONGODB_URI is required. When not using docker-socket mode, pass MONGODB_URI to point the migration at an existing MongoDB.');
  process.exit(2);
}

async function main() {
  console.log('Connecting to MongoDB at', uri);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to target MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'weavenote_migration');

    // Sample placeholder: if a JSON export exists, import it into a collection called 'imported'
    if (fs.existsSync(sourceJson)) {
      console.log('Found source JSON at', sourceJson, '— performing import to collection `imported`');
      const dataRaw = fs.readFileSync(sourceJson, 'utf8');
      const docs = JSON.parse(dataRaw);
      if (!Array.isArray(docs)) {
        console.warn('Source JSON is not an array; wrapping into a single-document array');
      }
      const coll = db.collection('imported');
      if (Array.isArray(docs)) {
        if (docs.length === 0) console.log('No documents to import');
        else {
          const result = await coll.insertMany(docs);
          console.log('Inserted docs count:', result.insertedCount);
        }
      } else {
        await coll.insertOne(docs);
        console.log('Inserted 1 document');
      }

      console.log('Import complete. Review the `imported` collection and perform transformations as needed.');
      return;
    }

    // TODO: Implement connectors to your realtime source (e.g., Firebase, export API). This example does not connect to a live source.
    console.log('No SOURCE_JSON_PATH found. Connector to realtime source is not implemented by default.');
    console.log('Please provide a JSON export at', sourceJson, 'or implement a connector inside this script.');

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Unhandled error', err);
  process.exit(1);
});
