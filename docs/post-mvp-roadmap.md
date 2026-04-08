# Post-MVP Roadmap

## Purpose
This roadmap captures only the next high-signal improvements after MVP completion.

## Highest-Value Next Steps
1. Turn `independentlyVerifiable` into a real check instead of a derived placeholder.
2. Add real source adapters for the `protocol-updates` lane so detections are not operator-entered JSON.
3. Tune optimization heuristics using multi-day windows instead of same-day slices wherever possible.
4. Add lightweight scheduling so dry runs and daily reports happen automatically.
5. Add a second lane only after `protocol-updates` shows real value from live outcomes.

## Why These Come First
- they reduce operator guesswork
- they improve signal quality more than adding surface area
- they make the optimization loop more trustworthy
- they move the system from verified MVP to live operational utility

## Explicit Non-Priorities
- broad multi-lane expansion before outcome data exists
- UI work before live signal quality is proven
- more complex runtime infrastructure before scheduling becomes a real bottleneck
