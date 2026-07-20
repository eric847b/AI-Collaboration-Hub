#pragma once

#include <cstdint>

typedef struct{uint64_t addr,size,last_use,refs;}vram_page;
typedef struct{uint64_t root,pages,bytes,epoch;}vram_state;

uint64_t vram_pin(vram_page*);
uint64_t vram_unpin(vram_page*);
uint64_t vram_snapshot(vram_state*);
