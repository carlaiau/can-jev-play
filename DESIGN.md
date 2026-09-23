---
name: JEV Dice Lab
description: A compact paired-experiment research workbench.
colors:
  canvas: "#f6f7f4"
  surface: "#ffffff"
  ink: "#242d27"
  muted: "#68716b"
  line: "#e1e6de"
  forest: "#266146"
  amber: "#976322"
  sidebar: "#eef1e9"
  nav-active: "#dce7d4"
  action: "oklch(62.7% 0.194 149.214)"
  control-focus: "oklch(62.3% 0.214 259.815)"
typography:
  display:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "30px"
    fontWeight: 580
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "16px"
    fontWeight: 610
    lineHeight: 1.55
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  panel: "12px"
  table: "10px"
  control: "8px"
  navigation: "7px"
  die: "6px"
spacing:
  panel: "23px"
  comparison: "24px"
  desktop-gutter: "36px"
  mobile-gutter: "18px"
components:
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "#24472d"
    rounded: "{rounded.navigation}"
    padding: "11px 12px"
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
---

# Design System: JEV Dice Lab

## Overview

**Creative North Star: "The Research Workbench"**

A compact research workbench with warm paper, quiet rules, and paired evidence. Forest and amber distinguish the conditions without turning the experiment into a game. Inter Variable and tabular numerals keep dense tables readable.

The interface uses Catalyst’s supplied Button, Select, and Badge components alongside custom offer, decision, history, and ledger surfaces. The existing direction calls for no decorative hero or imagery. Depth and motion serve controls and the moment an outcome is revealed.

**Key Characteristics:**

- Warm paper and white working surfaces
- Compact numerical typography
- Paired green and amber conditions
- Flat panels with restrained control depth

## Colors

A subdued botanical palette sits on warm paper, with amber identifying the calculated-EV condition.

### Primary

- **Forest:** the custom interface’s green accent family. Catalyst primary actions use the brighter **Action Green** token from its supplied green variant.

### Secondary

- **Research Amber:** the calculated-EV accent family, with pale amber letter badges and warm white condition surfaces.

### Neutral

- **Warm Paper:** page canvas.
- **White Surface:** working panels and table containers.
- **Deep Botanical Ink:** primary text.
- **Gray Green:** secondary text.
- **Quiet Rule:** separators and panel outlines.
- **Sidebar Sage / Selected Sage:** navigation backdrop and selected navigation item.

### Named Rules

**The Paired Evidence Rule.** Keep the two conditions visually comparable; use color alongside explicit condition names.

## Typography

**Display Font:** Inter Variable, sans-serif fallback.
**Body Font:** Inter Variable, sans-serif fallback.

**Character:** a single variable sans-serif keeps the workbench restrained. Tables, stakes, counters, and returns use tabular numerals.

### Hierarchy

- **Display:** page titles use the display token; responsive titles adjust to 26px at the medium breakpoint and 27px on mobile.
- **Headline:** panel headings use the headline token.
- **Title:** smaller section titles use the title token.
- **Body:** the body token establishes the base; explanatory text commonly uses 11–13px.
- **Label:** compact metadata uses 9–11px; retain explicit labels beside status colors.

## Layout

The desktop shell uses a 224px sticky sidebar and a flexible workspace. Main content caps at 1560px with desktop gutters. The offer/history column and wider decision column use a 23px gap and a minmax(270px, .84fr) / minmax(0, 1.75fr) split. Decision conditions remain equal-width columns.

At 1200px the sidebar narrows to 190px and controls wrap. At 950px navigation becomes a horizontal header. At 700px the offer and comparison panels stack, controls use two columns, and the decision conditions remain paired side by side. The ledger keeps its 680px minimum width inside horizontal scrolling. At 1600px panel padding and some metadata sizes increase.

The Experiments surface extends this shell with a full-width evidence chart followed by a linked ledger. Its controls and scenario summaries wrap naturally. Below 700px, chart headings and magnitude controls stack, panel padding tightens to 16px, and the pan slider moves onto its own row. The plot preserves a 570px minimum width within horizontal scrolling; the ledger retains every column.

## Elevation & Depth

Custom panels are flat: white or subtly tinted surfaces, thin rules, and tonal separation establish structure. Catalyst buttons and selects retain their supplied small shadow and inset control treatment. Do not describe the full system as shadow-free.

## Shapes

Panels use generous restrained corners; table containers are slightly tighter. Controls, navigation items, and dice step down through the documented radius scale. The die uses a small repeated square silhouette; status dots and action markers are circular.

## Components

### Buttons

Catalyst green buttons carry primary experiment actions; outline buttons carry evidence, export, and reset actions. The supplied component has rounded controls, an optical border, subtle depth, a white hover overlay, blue keyboard focus, and half-opacity disabled state. Experiment controls have a 37px minimum height; the mobile decision action has a 42px minimum height.

### Chips

Catalyst’s green badge identifies positive EV; zinc identifies study provenance. The model tag is a small white outlined label. Labels communicate meaning independently of color.

### Cards / Containers

White offer and comparison panels use thin Quiet Rule borders and the panel radius. The calculated condition uses a barely warm white surface. Content padding responds to available width rather than forcing uniform spacing everywhere.

### Inputs / Fields

Catalyst selects use a white surface, rounded border, chevrons, blue inset focus, and disabled opacity. Lab overrides make them compact with 12px text. Error messages use a warm red surface and border with icon and text.

### Navigation

Desktop navigation uses compact icon-and-label buttons, muted default text, a pale sage hover, and a stronger selected sage fill. Mobile navigation becomes icons while accessible labels remain available.

### Paired decisions and outcome reveal

Equal condition columns show information supplied, the binary Bet/Skip action, and session return. Action weights are omitted. Mixed sessions shuffle all six positive/negative EV offers in each six-round block; the study view archives earlier Score analysis separately from the current binary-only results. The outcome reveal uses a 450ms clipped reveal with cubic-bezier(.16,1,.3,1). Busy icons spin over 1.2s. Reduced-motion preference disables animations and transitions.

### Ledger and history

The ledger uses a genuine table with right-sized compact type and horizontal overflow. Historical wins and losses use pale green and warm clay cells, with numerals and a legend. Empty states use a thin dashed boundary and concise guidance.

### History experiment comparison

Experiments uses restrained underlined scenario tabs, compact correct-action summaries, and the existing Catalyst selects and outline buttons. Mixed outcomes, Six wins, and Six losses share identical presentation. Scenario selection uses Forest text and an underline; these history labels describe the supplied evidence, not judgment quality.

The expected-profit chart sits in a flat white, thin-bordered panel with the existing panel radius. Payouts only uses a solid Forest line; With calculated EV uses a dashed Research Amber line. Explicit legend labels and distinct line styles preserve the paired comparison beyond color. Hollow circles mark correct actions and warm-red outlined diamonds identify incorrect EV actions. Quiet grid lines, dollar-formatted tabular labels, and an emphasized zero baseline keep numerical evidence primary. The chart caption states the fixed $100 bet basis and separates expected profit from realized outcomes or reinvestment.

Selecting a chart point or ledger row links the two views using a vertical dashed chart guide and a pale sage table-row fill. The 30-roll overview can narrow to a 10-roll viewport with a slider and Earlier/Later controls. The ledger keeps a sticky header inside a bounded scrolling container. Chart points support keyboard selection; roll-number buttons provide an explicit table action.

The selected-decision inspector repeats the paired condition layout in a flat panel beneath the chart. Each condition shows its action, EV verdict, and exact model request and response in a bounded, scrollable monospace block. These columns stack on mobile using the existing log disclosure layout. Keep the visible correctness explanation independent of the sampled face.

## Do's and Don'ts

### Do:

- **Do** preserve side-by-side condition comparison on narrow screens.
- **Do** keep numerical columns aligned with tabular numerals.
- **Do** retain provenance labels and visible keyboard focus.

### Don't:

- **Don’t** add decorative hero imagery to the workbench.
- **Don’t** use winning-roll styling to imply a correct judgment.
- **Don’t** hide table columns to fit small screens; allow horizontal scrolling.

## Round interaction update
One Roll button sits above the paired columns. Decisions use Bet/Skip with no stake subtitle. The offer omits the stake block and explanatory footnote, and displays expected return as a percentage of stake. The rolled payout row stays highlighted for two seconds before the next offer. There is no separate outcome strip. Offer changes use a 350ms clip-path reveal and a 250ms exit; reduced motion removes these effects. Payout faces vary using authentic new recordings.

Current model interaction: only Bet/Skip is requested. No Score, EV class or win estimate appears in the game. Completed ledger rows have Inspect/Close disclosure controls with side-by-side exact JSON requests and raw responses, stacked on mobile.
After a roll, each decision shows a compact green/red EV verdict (Correct/Incorrect EV action). The identical verdict is retained below the action in the ledger. Verdicts depend on offered EV and action, never the sampled face.

EV verdicts are icon-only immediately to the right of Bet/Skip, in both the decision display and ledger. Hover titles and accessible labels carry the verdict and its EV explanation; icons are keyboard focusable.

Roll and Autoplay are in one toolbar above the entire offer/comparison grid. Autoplay has a Pause state and caps at 30 rounds. Each comparison column groups actual dollar net with total staked, expected dollar net and EV/stake percentage. All display amounts use dollar notation; exact archived model payloads remain unchanged.
The history selector is labeled Displayed history, and the historical panel says it is not sent to JEV. Decision input copy explicitly says No history. The current results view uses fresh current-offer-only recordings.
Input copy identifies JSON payouts. The visible payout table stays readable for people; the model receives structured JSON, shown verbatim in the expandable experiment log.

## Live-home refinement
The homepage has only EV magnitude, recent-roll scenario, and session controls; its response-source selector is removed. Both condition headings are clickable, with a chevron and the existing A/B badge. A Catalyst dialog shows a scrollable JSON payout excerpt, with B including the EV calculation. Dialogs identify prepared versus submitted requests and retain Close/Escape dismissal. The introductory subtitle, sidebar descriptive paragraph and page footer are removed.

Expanded recorded runs derive their visible counts and chart bounds from the dataset. The default chart window is 100 rolls, with 10-roll detail and all-roll overview options. Existing scenario tabs, two expected-profit curves, selection markers and the scrollable ledger are retained for the 1,000-roll run.

The all-roll experiment overview renders only the two line paths, without point/diamond markers or the Earlier/Later slider toolbar. The diamond legend is hidden with its markers. Detail windows retain decision markers and pan controls; overview click-to-select and table selection remain available.

Experiments now use Recharts ResponsiveContainer/LineChart with two linear Line series. Both dot and activeDot are disabled in every window. Forest solid and amber dashed distinguish strategies; hover tooltip exposes decision correctness, while click and table selection share a vertical reference line. The All history tab combines 3,000 samples for one EV magnitude, retaining source history/round in the table and inspector. Full-run view hides pan controls.

Experiment charts label the amber benchmark Optimal EV, computed from the offer rather than another model response. Selected-roll details pair a six-face payout table with shared home-page die icons and the payout-only JSON inspector; these stack on mobile. Supplied-EV model reporting is removed from Experiments.

The live lab now has one full-width decision column beside the offer, one model response in the ledger and one call per roll. A/B comparison badges are removed. Findings & discussion replaces Earlier studies in navigation; it leads with the supplied-EV control result, then explains why the product centers on payout-only inference and recent-history susceptibility. Earlier reports remain in a disclosure.

Experiment browsing now uses summary tabs with correct-action counts directly beneath each history label. The separate summary strip and full roll ledger are removed. Clicking the graph reveals the selected payout/response card below it; no card is shown before selection. Export retains all rows.

Experiments begins with the initial history-bias finding and the replication design. Its tab-linked comparison table sits beneath the history tabs and above the graph, with the selected history labeled and shaded sage. Rate cells include numerator/denominator on a secondary line; wide comparisons scroll within the page on mobile. Findings reuses the same comparison across all ranges and adds discussion of alternative mechanisms and statistical limits.

## Can Jev Play refinement
Experiment charts always display the full selected run; window sizes and pan controls are removed. Totals and plotted endpoints cover the same scope. The graph precedes the comparison table, with full evidence accessible by graph selection or a labeled roll-number form and Previous/Next actions. History tabs support arrow/Home/End keyboard navigation. Mobile navigation has visible Dice lab, Experiments, Findings and Guide labels with active-page semantics. The live rate table appears after the first decision; the compact opening explains the task and trading-demo motivation. Repeated Findings conclusions are removed while evidence, caveats and source provenance remain.

## Noul experiment selection
Experiments reuses the existing labeled Select beside EV magnitude for question type: Choice or Noul. A short contextual note states Noul's fixed >0.5 Bet rule and separate-batch provenance. Both modes share the full-run chart, history tabs, metrics, and exact-payload inspector; no additional chart style or card system is introduced.
