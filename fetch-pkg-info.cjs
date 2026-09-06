#!/usr/bin/env node
const https = require('https');
const pkg = process.argv[2];
const ver = process.argv[3];
const url = `https://registry.npmjs.org/${pkg}/${ver}`;
https.get(url, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    console.log(JSON.stringify({
      version: j.version,
      integrity: j.dist?.integrity || '',
      shasum: j.dist?.shasum || '',
      tarball: j.dist?.tarball || '',
    }));
  });
}).on('error', e => { console.error('ERR', e.message); process.exit(1); });
