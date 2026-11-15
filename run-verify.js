const { execSync } = require('child_process');
const result = execSync('node tools/verify-tools.mjs --check-cli --quiet', { cwd: 'C:\\Users\\Eric\\OneDrive\\Documents\\GitHub' });
console.log('Exit code:', result.status);