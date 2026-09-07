# Defensive arm audit — dedicated coverage session

Read-only source inspection on `6f72eea1`, with unchanged production compared with
the full CI `45c58609` counters. This is an explanation of selected historical zeros,
not current coverage or a proposal to relax a gate. Original counters are untouched.

| Boundary | Why it is not a valid test target through the current public flow |
| --- | --- |
| `reconcileCosts.total`: failed `add` after amount/currency validation | `Money.add` returns an error only on currency mismatch. Both operands already have the requested currency. |
| `reconcileCosts.openTotal`: failed paid total / failed subtraction | The enclosing function has already totalled and validated every active actual and commitment. Selecting a subset of those actuals cannot introduce a foreign currency or invalid amount; subtraction can be negative and still succeeds. |
| `reconcileCosts`: failed open total / subtraction after actual / final subtraction | These operate on the validated planned amount and totals constructed in the same currency. Tests would need to corrupt a returned value or substitute arithmetic. |
| `Requirement.with`: `requiredDate` supplied in the private partial update | None of the public methods passes this property to `with`. Creation and loading can carry a date; subsequent public updates preserve it. Calling the private method would test an unavailable path. |
| `RenovationLayer.markers`: missing planned record in the planned-label ternary | The immediately preceding filter requires that very planned record in planned mode. In existing mode the outer label branch does not evaluate this ternary. Valid immutable records cannot reach this zero. |

The Review-marker zeros are different: an unresolved Decision and Work with no outcome
are legal persisted records. `reviewMarkerNavigation.test.ts` prepares independent
native cases that obtain the current canvas marker before each interaction. The older
route test captured all markers once, then changed perspective while traversing them;
the full counters show only one Review finding taking the Work arm. New hits remain to
be measured, and the new tests remain unverified until the granted heavy slot is used.

No production guard was removed. Production changes require coordination with Root.
