from groq_singularity import SingularityGroq
sg = SingularityGroq(model='compound-beta')
def swarm(prompts): return {f'node_{i}': sg.call(p) for i,p in enumerate(prompts)}
print(swarm(['Enhance userscript', 'Browser automation', 'Free tier']))