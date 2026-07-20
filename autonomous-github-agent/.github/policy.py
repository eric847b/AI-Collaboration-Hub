def score(task):
    """
    Score tasks for autonomous agent prioritization.

    Aligns with core principles:
    - Highest return valued catalyst root actions first
    - Reach perfection as fast as possible
    - Focus on self-evolution, architecture quality, and Singularity Operator progress
    - Zero unnecessary work; real tough problems only
    """
    base = task.get("impact", 0)

    # Boost for high-ROI self-improvement and evolution tasks
    task_text = (task.get("title", "") + " " + task.get("body", "")).lower()
    if any(kw in task_text for kw in ["self-improvement", "evolution", "architecture", "singularity", "highest roi", "catalyst", "perfection"]):
        base += 3.0

    if task.get("type") == "ci_fix":
        base += 2.0

    if task.get("type") == "refactor":
        base += 0.5

    # Additional boost for architecture/evolution evaluation tasks from agent.py
    if "architecture" in task_text or "evolution" in task_text or "directive" in task_text:
        base += 1.5

    return base - task.get("risk", 0)

def select_task(tasks):
    """
    Select the single highest-scoring task.
    This ensures we always tackle the most valuable catalyst action available.
    """
    return max(tasks, key=score) if tasks else None
