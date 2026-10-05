# zero-area-zone

**One Room that encloses no area, on disk.** Its three corners lie on one line, which is what
L-23's vertex drag used to write before owner ruling 34 put the rule in the Zone entity. A vault
written by an earlier build can hold one, so this fixture plants it rather than writing it at run
time: nothing in the current build can write this shape, which is the point.

It backs `tests/infrastructure/obsidian/repositories/zeroAreaZone.test.ts`, which holds ruling 34's
load half (the zone still loads, through `Zone.fromStored`) and ruling 35's edit half (an
outline-touching edit is refused until one gives it an area; a rename, a details change, a lock
and a delete still pass, so the room can be found and removed).
