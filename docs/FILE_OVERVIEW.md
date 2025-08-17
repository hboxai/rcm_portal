## Centralization Overview

Shared modules introduced (no behavior change):

Added
- frontend/src/constants/claimStatus.ts: Status & closure options + style helper.
- frontend/src/utils/format.ts: Date formatting helper.

Updated
- SummaryCard.tsx: Imports shared status/closure arrays.
- SearchResults.tsx: Uses shared date + status style helpers.

Future opportunities: consolidate currency formatting, status icon mapping, and GlassCard usage patterns.
