#!/usr/bin/env python3
"""Quiet Failure Handler for autonomous-github-agent
Intercepts errors, warnings, and notifications before they spam the user.
- Marks notifications as read in batches
- Rate-limits alerts
- Logs everything locally
- Only surfaces critical failures
"""
import os, json, time, logging, requests
from datetime import datetime, timedelta
from pathlib import Path

LOG = Path(".agent_quiet.log")
STATE = Path(".agent_quiet_state.json")
MAX_ALERTS_PER_HOUR = 2

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                    handlers=[logging.FileHandler(LOG, mode="a"), logging.StreamHandler()])
log = logging.getLogger("quiet")

def load_state():
    if STATE.exists():
        try: return json.loads(STATE.read_text())
        except: pass
    return {"alerts": [], "last_mark_read": None}

def save_state(s):
    STATE.write_text(json.dumps(s, indent=2))

def can_alert(state):
    now = datetime.utcnow()
    recent = [a for a in state["alerts"] if now - datetime.fromisoformat(a) < timedelta(hours=1)]
    state["alerts"] = recent
    return len(recent) < MAX_ALERTS_PER_HOUR

def mark_notifications_read(token):
    """Batch-mark all notifications as read so user is not bombarded."""
    if not token: return 0
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    try:
        # Get notifications
        r = requests.get("https://api.github.com/notifications", headers=headers, params={"all": "false", "per_page": 50}, timeout=15)
        if not r.ok: return 0
        notes = r.json()
        if not notes: return 0
        # Mark all as read via thread subscription or last_read_at trick
        # Simplest reliable: PUT /notifications with last_read_at
        requests.put("https://api.github.com/notifications",
                     headers=headers,
                     json={"last_read_at": datetime.utcnow().isoformat() + "Z"},
                     timeout=15)
        log.info(f"Quiet: marked {len(notes)} notifications as read")
        return len(notes)
    except Exception as e:
        log.debug(f"mark_read failed: {e}")
        return 0

def handle_failure(msg, critical=False):
    """Central failure sink. Logs always. Alerts only if critical + under rate limit."""
    state = load_state()
    log.warning(f"FAILURE: {msg}")
    if critical and can_alert(state):
        state["alerts"].append(datetime.utcnow().isoformat())
        save_state(state)
        log.error(f"CRITICAL (allowed): {msg}")
        # In real use this could open a single issue or send one webhook
        return True
    save_state(state)
    return False

def quiet_bootstrap():
    """Call at start of every agent run when QUIET=1 or SUPPRESS_NOTIFICATIONS=1"""
    if os.getenv("QUIET") != "1" and os.getenv("SUPPRESS_NOTIFICATIONS") != "1":
        return
    token = os.getenv("GITHUB_TOKEN")
    n = mark_notifications_read(token)
    log.info(f"Quiet mode active — notifications suppressed ({n} marked read)")

if __name__ == "__main__":
    quiet_bootstrap()
    print("quiet_handler ready")
