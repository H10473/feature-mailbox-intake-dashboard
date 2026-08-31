# GO-Flex Mailbox Intake — Power BI build guide

Step-by-step guide to build a Power BI report that matches the Mailbox Intake
web app, using the CSV export
`GO-Flex-Mailbox-Intake-Dashboard-single-list-template.csv`.

Source columns are produced by the "GO Flex Mailbox Intake Collector" flow, so
most metrics/statuses are precomputed. This guide **reuses those columns** and
adds DAX only where useful.

> Data notes from the sample (43 rows):
> - `Direction` = `Incoming` (received) / `Outgoing` (sent replies). `FolderName` = `Inbox` / `Sent Items`.
> - Datetimes are `M/d/yyyy H:mm` (24-hour) — parse with **English (United States)** locale.
> - Precomputed & populated: `SLAStatus` (Open/Breached), `AcknowledgmentStatus`, `CompletionStatus`, `AgingBucket`, `AgingDays`, `AckMinutes`, `Priority`, `Importance`, `RequestCategory`.
> - Sparse: `FirstResponseMinutes`/`FirstResponseDateTime` (only on matched replies), `SLAMinutes` (empty), `WebLink`/`OpenWebLink` (empty on many rows).
> - SLA policy (from the app): acknowledge ≤ **15 min**, complete ≤ **4 hours**.

---

## Part A — Load & shape data (Power Query)

1. **Get data → Text/CSV** → select the CSV. Confirm Delimiter = `Comma`,
   File origin = `65001: Unicode (UTF-8)`. Click **Transform Data**.
2. Ensure **Use First Row as Headers** is applied.
3. **Set date/time types with locale** (critical — the dates are US-format):
   for each of `ReceivedDateTime`, `SentDateTime`, `MessageDateTime`,
   `FirstReceivedDateTime`, `LatestReceivedDateTime`, `FirstResponseDateTime`,
   `LastResponseDateTime`, `CompletionResponseDateTime`, `ClosedResolvedDateTime`,
   `IngestedAt`, `LastRefreshAt`, `NextScheduledRefresh`:
   - Right-click the column → **Change Type → Using Locale…** →
     Data Type = **Date/Time**, Locale = **English (United States)** → OK.
4. **Set numeric types**: `AckMinutes`, `CompletionHours`,
   `FirstResponseBusinessMinutes`, `ResolutionBusinessHours`,
   `FirstResponseMinutes`, `FirstResponseHrs`, `AgingDays`, `PriorityScore`,
   `EmailCount`, `IncomingCount`, `OutgoingCount`, `FollowUpCount`,
   `ReopenCount` → **Decimal/Whole Number**.
5. **Normalize blanks**: select the status text columns (`SLAStatus`,
   `AcknowledgmentStatus`, `CompletionStatus`, `AgingBucket`,
   `ResolutionStatus`, `Priority`, `BusinessType`, `Owner`) →
   **Transform → Replace Values** → replace empty with `null`
   (or Transform → Format → Trim + "Replace empty"). Keeps blanks out of slicers.
6. (Optional) Reduce clutter: **Remove Columns** you won't use
   (e.g. `ParentFolderId`, `FlowRunId`, `DataQualityNotes`, `ErrorSummary`,
   `RefreshStatus`, `EmailsCreated/Updated`, `ThreadsUpdated`, etc.).
   Keep IDs (`EmailId`, `ConversationId`), datetimes, statuses, `WebLink`,
   `Direction`, `FolderName`, `SubjectText`, `SenderName`, `SenderEmailText`.
7. Rename the query to **`Emails`**. **Close & Apply**.

---

## Part B — Data model

### B1. Calculated columns on `Emails`

```DAX
Received Date = 
DATE ( YEAR ( Emails[ReceivedDateTime] ), MONTH ( Emails[ReceivedDateTime] ), DAY ( Emails[ReceivedDateTime] ) )

Received Hour = HOUR ( Emails[ReceivedDateTime] )

Received Day Name = FORMAT ( Emails[ReceivedDateTime], "ddd" )      -- Sun..Sat

Received Day Num = WEEKDAY ( Emails[ReceivedDateTime], 1 )          -- 1=Sun .. 7=Sat
```

Then set **`Received Day Name` → Sort by column → `Received Day Num`**
(Column tools), so the heatmap orders Sun→Sat.

Recreate the app's aging buckets consistently (optional — the source
`AgingBucket` also works):

```DAX
Aging Bucket (calc) =
VAR d = Emails[AgingDays]
RETURN
SWITCH (
    TRUE (),
    Emails[Direction] <> "Incoming", BLANK (),
    d <= 1, "0-1 days",
    d <= 2, "1-2 days",
    d <= 5, "2-5 days",
    "5+ days"
)
```

### B2. Date table

```DAX
Date =
ADDCOLUMNS (
    CALENDAR ( MIN ( Emails[Received Date] ), MAX ( Emails[Received Date] ) ),
    "Year", YEAR ( [Date] ),
    "Month", FORMAT ( [Date], "MMM yyyy" ),
    "MonthNum", YEAR ( [Date] ) * 100 + MONTH ( [Date] ),
    "Day", DAY ( [Date] ),
    "Weekday", FORMAT ( [Date], "ddd" ),
    "WeekdayNum", WEEKDAY ( [Date], 1 )
)
```

- Mark as date table: **Table tools → Mark as date table → `Date`[Date]**.
- Create relationship **`Date`[Date] → `Emails`[Received Date]** (single, active).

---

## Part C — DAX measures

Create a `_Measures` table (Enter data → blank table) and add these.

### C1. SLA policy constants
```DAX
Ack SLA Target (min) = 15
Completion SLA Target (hrs) = 4
```

### C2. Volumes
```DAX
Total Emails = COUNTROWS ( Emails )

Intake Volume = CALCULATE ( [Total Emails], Emails[Direction] = "Incoming" )

Responses Sent = CALCULATE ( [Total Emails], Emails[Direction] = "Outgoing" )

Open Items =
CALCULATE ( [Total Emails], Emails[ResolutionStatus] = "Open" )

Unique Threads = DISTINCTCOUNT ( Emails[ConversationId] )
```

### C3. SLA (uses the flow's `SLAStatus`)
```DAX
SLA Breached = CALCULATE ( [Total Emails], Emails[SLAStatus] = "Breached" )

SLA Open = CALCULATE ( [Total Emails], Emails[SLAStatus] = "Open" )

SLA Breach % =
DIVIDE ( [SLA Breached], [SLA Breached] + [SLA Open] )

SLA Within % = 1 - [SLA Breach %]
```

### C4. Acknowledgment (uses `AcknowledgmentStatus`)
```DAX
Acknowledged =
CALCULATE (
    [Total Emails],
    Emails[AcknowledgmentStatus]
        IN { "Acknowledged by reply", "Read/acknowledged, reply unverified" }
)

Awaiting Acknowledgment =
CALCULATE ( [Total Emails], Emails[AcknowledgmentStatus] = "Awaiting acknowledgment" )

Ack Rate % =
DIVIDE ( [Acknowledged], [Acknowledged] + [Awaiting Acknowledgment] )
```

### C5. Completion (uses `CompletionStatus`)
```DAX
Completion Overdue =
CALCULATE ( [Total Emails], Emails[CompletionStatus] = "Completion response overdue" )

Completion % =
DIVIDE (
    CALCULATE ( [Total Emails], Emails[CompletionStatus] = "Completion response unverified" ),
    [Intake Volume]
)
```

### C6. Response & handle time
```DAX
-- Uses the flow's precomputed minutes (populated only on matched replies).
Avg First Response (min) =
AVERAGEX ( FILTER ( Emails, NOT ISBLANK ( Emails[FirstResponseMinutes] ) ), Emails[FirstResponseMinutes] )

-- Fallback recomputation directly from datetimes (use if you backfill responses):
Avg First Response calc (min) =
AVERAGEX (
    FILTER ( Emails, NOT ISBLANK ( Emails[FirstResponseDateTime] ) && NOT ISBLANK ( Emails[ReceivedDateTime] ) ),
    DATEDIFF ( Emails[ReceivedDateTime], Emails[FirstResponseDateTime], MINUTE )
)

Avg Ack (min) =
AVERAGEX ( FILTER ( Emails, Emails[Direction] = "Incoming" ), Emails[AckMinutes] )

Avg Aging (days) =
AVERAGEX ( FILTER ( Emails, Emails[Direction] = "Incoming" ), Emails[AgingDays] )

Ack Within SLA % =
VAR within =
    CALCULATE ( [Total Emails], Emails[Direction] = "Incoming", Emails[AckMinutes] <= [Ack SLA Target (min)], NOT ISBLANK ( Emails[AckMinutes] ) )
VAR total =
    CALCULATE ( [Total Emails], Emails[Direction] = "Incoming", NOT ISBLANK ( Emails[AckMinutes] ) )
RETURN DIVIDE ( within, total )
```

### C7. Trend helpers (put `Date`[Date] on the axis)
```DAX
Received (day) = [Intake Volume]
Responses (day) = [Responses Sent]
```

---

## Part D — Theme & page layout

1. **View → Themes → Browse for themes** → `powerbi/mailbox-intake-theme.json`
   (in this repo). Canvas turns dark navy with indigo accents to match the app.
2. Canvas size **1280×720** (Format pane → Canvas settings → 16:9).

Lay the page out to mirror the app:

### Header
- Text box: **"Mailbox Intake Dashboard"** (Segoe UI Semibold, 18, `#e2e8f0`).
- Text box below (muted `#94a3b8`): `FAHQ-RA-GOFlexBLRTransactional@firstam.com`.
- Two rounded rectangle shapes as SLA pills: "Acknowledge ≤ 15m", "Complete ≤ 4h".

### KPI cards (row of 5 Card visuals)
`Intake Volume` · `Avg First Response (min)` · `Ack Rate %` · `SLA Breach %` · `Avg Aging (days)`
- On `SLA Breach %`: **Conditional formatting → Callout value → Font color** →
  rules: `>= 0.15` red `#ef4444`, `>= 0.05` amber `#f59e0b`, else green `#22c55e`.
- On `Ack Rate %`: `>= 0.95` green, `>= 0.85` amber, else red.

### Aging (Clustered bar chart)
- Y-axis (Axis) = `AgingBucket` (or `Aging Bucket (calc)`), X = `Intake Volume`.
- Visual-level filter: `Direction = Incoming`.
- Data colors by bucket: `0-1 days` green, `1-2 days` amber, `2-5 days` amber, `5+ days` red.

### Volume & trends (Line and clustered column, or Clustered column)
- X-axis = `Date`[Date]. Columns: `Received (day)` (blue `#38bdf8`) and
  `Responses (day)` (green `#22c55e`). Filter last 14 days via a relative date filter.

### Volume heatmap (Matrix)
- Rows = `Received Day Name`, Columns = `Received Hour`, Values = `Intake Volume`.
- Turn OFF row/column subtotals and stepped layout.
- **Cell elements → Background color → Conditional formatting → Format style =
  Gradient**: Minimum `#1e293b`, Maximum `#6366f1` (indigo). Matches the app heatmap.

### Status breakdown (2 small visuals — optional, extends the app)
- Donut/Bar on `AcknowledgmentStatus` and `CompletionStatus` with `Total Emails`.

### Inbox (Table visual)
- Columns: `SubjectText`, `SenderName`, `FolderName`, `ReceivedDateTime`,
  `AgingDays`, `AcknowledgmentStatus`, `CompletionStatus`, `SLAStatus`, `WebLink`.
- **`WebLink`**: select column → **Column tools → Data category → Web URL**
  (renders the app's "Open in Outlook" link). Optionally set it as an icon
  in table formatting (Values → URL icon → On).
- Conditional formatting (Table → Cell elements → Background color) on:
  - `SLAStatus`: `Breached` → red `#ef4444`, `Open` → amber `#f59e0b`.
  - `AgingDays`: gradient min green → max red.

### Slicers (chip-styled)
- Add slicers for `Direction`, `FolderName`, `Priority`, and `Date` (relative).
- Default `Direction = Incoming` for the intake-centric KPIs.

---

## Part E — Refresh & publish

- **Home → Refresh** to pull new CSV rows (point the source at the network path
  `\\fai-blr01sfSB01\gost-blr\Source Data\MailboxIntake` if the CSV is refreshed
  there, or a SharePoint/Gateway source for scheduled refresh).
- **Publish** to the Power BI Service; configure a **gateway** + scheduled
  refresh if the source is the on-prem share.

> Because the collector flow already computes statuses, keep those columns as the
> source of truth. The DAX above only aggregates/rederives where the report needs
> flexible slicing. If you later backfill `FirstResponseDateTime`/`WebLink`, the
> response-time KPI and Open link populate automatically.
