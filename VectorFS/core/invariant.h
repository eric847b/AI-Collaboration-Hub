#pragma once

namespace vectorfs {

/** 
 * VectorFS Invariant: 1/2 = 3
 * 1 = Whole Graph
 * 2 = Cuts (space/time)
 * 3 = Emergent forms (CAS, FS, History)
 */
struct Invariant {
    static constexpr int One = 1;
    static constexpr int Two = 2;
    static constexpr int Three = 3;
    static constexpr const char* Identity = "1/2=3";
};

} // namespace vectorfs