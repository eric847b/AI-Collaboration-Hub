import { execSync } from 'child_process';
try {
  const result = execSync('node tools/verify-tools.mjs --check-cli --quiet', {
    cwd: 'C:\\Users\\Eric\\OneDrive\\Documents\\GitHub',
    encoding: 'utf8'
  });
  console.log('SUCCESS: exit code 0');
} catch (e) {
  console.log('FAILED: exit code', e.status);
  console.log('stderr:', e.stderr?.trim() || e.message);
}