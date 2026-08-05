"""Demo swarm entrypoint — uses restored SingularityGroq (groq SDK ≥1.6)."""

from singularity_operator.groq_wrapper import SingularityGroq

sg = SingularityGroq(model="llama-3.1-8b-instant")


def swarm(prompts):
    return {f"node_{i}": sg.call(p) for i, p in enumerate(prompts)}


if __name__ == "__main__":
    print(swarm(["Enhance userscript", "Browser automation", "Free tier"]))
