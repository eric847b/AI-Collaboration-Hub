const fs = require('fs');
const file = process.argv[2];
if (!file) {
  console.error('No file path specified');
  process.exit(2);
}
try {
  const code = fs.readFileSync(file, 'utf8');
  const vm = require('vm');
  new vm.Script(code, { filename: file });
  console.log(`OK: ${  file}`);
} catch (e) {
  console.error(`ERROR: ${  file}`);
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
