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
