import sys 
import os 
sys.path.insert(0, '.github')
os.environment['GITHUB_EVENT_NAME'] = 'schedule'
os.environment['FLEET_FORCE'] = ''
from agent_fleet_hooks import run_fleet_coordinator
r = run_fleet_coordinator(force=False, repo_name='x', record_error=print)
print('DONE:' + str(r)[:80])
