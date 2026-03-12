/*
Express web UI for uploading a service account / credentials and triggering a migration.

Two operational modes (configured via environment or runtime):
 - DOCKER_SOCKET mode: when /var/run/docker.sock is mounted into the container, the helper may spin up a temporary MongoDB container using the host Docker daemon. This is convenient for on-prem migration runs but is HIGHLY SENSITIVE and equivalent to giving the service root access to the host.
 - NO_SOCKET mode: do not mount the docker socket. Instead provide MONGODB_URI pointing at the target MongoDB instance and the helper will run without controlling Docker.

Security notes are included in README.md. This UI is intentionally minimal and intended for short-lived, protected environments (not public internet).
*/

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const upload = multer({ dest: '/tmp/uploads' });
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send(`
    <h1>Weavenote Migration Helper</h1>
    <p>Upload service account credentials (JSON) and click "Start Migration".</p>
    <form method="post" enctype="multipart/form-data" action="/upload">
      <input type="file" name="creds" accept="application/json" />
      <br/><br/>
      <label>Optional: Provide MONGODB_URI (no-socket mode):</label>
      <input type="text" name="mongodb_uri" placeholder="mongodb://host:27017/dbname" style="width:60%"/>
      <br/><br/>
      <button type="submit">Upload & Start Migration</button>
    </form>
  `);
});

app.post('/upload', upload.single('creds'), (req, res) => {
  const file = req.file;
  const mongodb_uri = req.body.mongodb_uri || process.env.MONGODB_URI;

  if (!file && !mongodb_uri) {
    return res.status(400).send('Provide either a credentials JSON file or MONGODB_URI in the form or environment.');
  }

  // If credentials file provided, move it to a stable path
  let credsPath = null;
  if (file) {
    const dest = path.join('/tmp', 'service-account.json');
    fs.renameSync(file.path, dest);
    credsPath = dest;
  }

  // Decide mode based on presence of docker socket
  const socketExists = fs.existsSync('/var/run/docker.sock');
  const useSocket = socketExists;

  // Build command to run the helper script which will either create a temporary mongo container
  // (when socket available) or rely on MONGODB_URI.
  const script = path.join(__dirname, 'scripts', 'docker-run-migration.sh');
  const args = [];
  if (credsPath) args.push('--creds', credsPath);
  if (mongodb_uri) args.push('--mongodb-uri', mongodb_uri);
  if (useSocket) args.push('--use-docker-socket');

  // Spawn the helper as a detached child. Keep logs on stdout/stderr.
  const child = spawn('bash', [script, ...args], { stdio: 'inherit' });
  child.on('close', (code) => {
    console.log('Migration script exited with', code);
  });

  res.send(`Migration started. Mode: ${useSocket ? 'docker-socket' : 'no-socket'}. Check server logs for progress.`);
});

app.listen(PORT, () => {
  console.log(`Migration helper UI listening on port ${PORT}`);
});
