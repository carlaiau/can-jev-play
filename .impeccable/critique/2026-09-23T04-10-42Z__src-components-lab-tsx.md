---
target: Whole Dice Lab design
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/caiau/school/jevdice/src/components/lab.tsx"
target_fingerprint: "sha256:5f72bda691e9f0fd8aad1ab831010f4bd066ee1d36dc973018bc0b5e78c192f2"
target_path: /Users/caiau/school/jevdice/src/components/lab.tsx
timestamp: 2026-09-23T04-10-42Z
slug: src-components-lab-tsx
closed: true
---
# Dice Lab design critique

Target: src/components/lab.tsx and adjacent experiment/findings views. Mode: Operate (Lab/Experiments), Read (Findings). Two independent assessments; no source changes or model calls.

## Verdict
The product-specific evidence views are strong. The generic dashboard frame, repeated introductions, empty statistics and uniform white panels dilute them. This needs editing and hierarchy, not another visual theme. The largest opportunity is getting visitors to the offer or chart sooner.

## Heuristics
| Heuristic | Score / 4 | Main observation |
|---|---:|---|
| System status | 3 | Clear round/busy states; live execution not exercised |
| Real-world match | 3 | Concrete dice/dollars; EV still needs explanation |
| Control and freedom | 2 | Pause/reset; in-app pages lack browser history |
| Consistency | 3 | Coherent visual language; duplicate mobile icons |
| Error prevention | 3 | Busy disabling and bounded autoplay |
| Recognition | 2 | Hidden mobile labels; unlabeled chart total scope |
| Efficiency | 2 | Export/windows; no explicit keyboard payload selection |
| Minimalism | 2 | Repeated framing and empty metrics ahead of task |
| Error recovery | 3 | Retry/persistence source-reviewed |
| Help | 3 | Sound explanations, spread too widely |
| Total | 26/40 | Usable, with clear hierarchy and interaction weaknesses |

## Strengths
- Dice payout rows and highlighted outcomes explain the domain directly.
- Solid/dashed curves, mathematical benchmark labels and numerator/denominator rates communicate evidence.
- Exact request/response inspection and separating EV correctness from luck build trust.

## Priorities
1. P1: Chart legend silently shows full-run totals while the visible plot defaults to 100 rolls. Optimal EV reads +$1500 while the line ends near +$150. Label full-run totals explicitly and distinguish visible-window values. history-experiments.tsx chart legend. Suggested: impeccable clarify.
2. P1: Experiments and Findings are identical chart icons on mobile with text hidden. Use short visible labels or a labeled menu. lab.tsx navigation. Suggested: impeccable adapt.
3. P2: Main evidence appears too late. Empty 0/0 metrics precede setup; Experiments repeats its question heading and prose before tabs, table and chart. Chart begins around 1070px on desktop and 1400px on mobile. Condense framing and keep requested metrics/table compact; progressively disclose deeper explanation. Suggested: impeccable distill/layout.
4. P2: No explicit keyboard route to open a chosen graph sample's payload. Add sample number plus Inspect or previous/next controls. Recharts may support navigation, but payload activation was not established. Suggested: impeccable harden.

## Cognitive load and journey
Five related history options are justified, not a reason to remove a condition. The waste is overlapping explanation and unclear numerical scope. Curiosity and trust at the introduction lead to a long wait for action/evidence. Exact inspection is the strongest payoff. Put latest conclusions ahead of extended mechanism speculation.

## Personas
- First-time visitor: disabled Roll conflicts with 'Click Roll' before Start experiment; mobile destinations ambiguous.
- Keyboard user: explicit sample inspection path absent from source.
- Returning analyst: cannot bookmark a condition/page or restore it with browser Back.

## Minor observations
Tiny 9–11px explanatory text, generic 'Research workspace' framing and slogan, repeated latest-study conclusions, and Last six rolls including No history. Preserve methodological caveats, but give them one clear home. The detector found one advisory: undocumented #899583 at history-experiments.tsx:54. It is visually coherent token drift, not a material visual defect.

## Direction questions
First pass: simplify flow and repetition, or mobile/keyboard access? Scope: top three issues, or all four?
