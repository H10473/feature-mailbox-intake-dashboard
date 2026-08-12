# Power BI: Mailbox Intake report design (match the Intake web app)

This folder contains a **Power BI theme** and a **design spec** to make the
`MailboxIntake.pbix` report look and behave like the Mailbox Intake web app
(dark UI, KPI cards, SLA tracking, aging, volume trends, day×hour heatmap,
inbox table).

> The `.pbix` itself can't be edited programmatically here (it's a binary Power
> BI Desktop file on an internal network share). Apply the theme + follow the
> layout below in Power BI Desktop.

## 1. Apply the theme

1. Open `MailboxIntake.pbix` in **Power BI Desktop**.
2. **View → Themes → Browse for themes** → select `mailbox-intake-theme.json`.
3. The report canvas turns dark navy (`#0f172a`) with indigo accents to match the app.

Palette (from the app's `client/src/index.css`):

| Token | Hex | Use |
| --- | --- | --- |
| Background | `#0f172a` | Page background |
| Panel | `#1e293b` | Visual/card background |
| Panel-2 | `#263449` | Table alt rows, chips |
| Border | `#334155` | Card borders |
| Accent (indigo) | `#6366f1` | Primary series, headers |
| Blue | `#38bdf8` | "Received" / New |
| Good (green) | `#22c55e` | SLA met / Resolved |
| Warn (amber) | `#f59e0b` | In progress / near SLA |
| Bad (red) | `#ef4444` | SLA breached / Urgent |
| Text | `#e2e8f0` | Labels |
| Muted | `#94a3b8` | Secondary labels |

## 2. Data model expectations

Assume the mailbox export loads into a table named `Emails` with (at least):

| Column | Type | Notes |
| --- | --- | --- |
| `ReceivedAt` | DateTime | When the email arrived |
| `FirstResponseAt` | DateTime (nullable) | First reply / acknowledgement |
| `ResolvedAt` | DateTime (nullable) | Completion time |
| `Status` | Text | `new` / `in_progress` / `resolved` |
| `Priority` | Text | `low` / `normal` / `high` / `urgent` |
| `Folder` | Text | `Inbox` / `Processing` / `Completed` / `Escalations` |
| `Sender` | Text | |
| `Subject` | Text | |

Rename columns in Power Query if the source uses different headers. Add a
`Date` calendar table (mark as date table) related to `Emails[ReceivedAt]` for
the trend visual.

SLA policy (matches the app): **acknowledge ≤ 15 min**, **complete ≤ 240 min (4h)**.

## 3. DAX measures

```DAX
Ack SLA (min) = 15
Completion SLA (min) = 240

Volume = COUNTROWS ( Emails )

Open = CALCULATE ( [Volume], Emails[Status] <> "resolved" )
Resolved = CALCULATE ( [Volume], Emails[Status] = "resolved" )

Avg First Response (min) =
AVERAGEX (
    FILTER ( Emails, NOT ISBLANK ( Emails[FirstResponseAt] ) ),
    DATEDIFF ( Emails[ReceivedAt], Emails[FirstResponseAt], MINUTE )
)

Avg Handle Time (min) =
AVERAGEX (
    FILTER ( Emails, Emails[Status] = "resolved" && NOT ISBLANK ( Emails[ResolvedAt] ) ),
    DATEDIFF ( Emails[ReceivedAt], Emails[ResolvedAt], MINUTE )
)

-- Acknowledge SLA: met if acknowledged within 15 min; breached if
-- acknowledged late OR still open past 15 min.
Ack Met =
CALCULATE (
    [Volume],
    FILTER (
        Emails,
        NOT ISBLANK ( Emails[FirstResponseAt] )
            && DATEDIFF ( Emails[ReceivedAt], Emails[FirstResponseAt], MINUTE ) <= [Ack SLA (min)]
    )
)

Ack Breached =
CALCULATE (
    [Volume],
    FILTER (
        Emails,
        ( NOT ISBLANK ( Emails[FirstResponseAt] )
            && DATEDIFF ( Emails[ReceivedAt], Emails[FirstResponseAt], MINUTE ) > [Ack SLA (min)] )
        || ( ISBLANK ( Emails[FirstResponseAt] )
            && DATEDIFF ( Emails[ReceivedAt], NOW (), MINUTE ) > [Ack SLA (min)] )
    )
)

Ack SLA Compliance % =
DIVIDE ( [Ack Met], [Ack Met] + [Ack Breached] )

Completion Met =
CALCULATE (
    [Volume],
    FILTER (
        Emails,
        NOT ISBLANK ( Emails[ResolvedAt] )
            && DATEDIFF ( Emails[ReceivedAt], Emails[ResolvedAt], MINUTE ) <= [Completion SLA (min)]
    )
)

Completion Breached =
CALCULATE (
    [Volume],
    FILTER (
        Emails,
        ( NOT ISBLANK ( Emails[ResolvedAt] )
            && DATEDIFF ( Emails[ReceivedAt], Emails[ResolvedAt], MINUTE ) > [Completion SLA (min)] )
        || ( ISBLANK ( Emails[ResolvedAt] )
            && DATEDIFF ( Emails[ReceivedAt], NOW (), MINUTE ) > [Completion SLA (min)] )
    )
)

Completion SLA Compliance % =
DIVIDE ( [Completion Met], [Completion Met] + [Completion Breached] )

Received (day) = CALCULATE ( [Volume] )   -- use on a Date axis
Resolved (day) = CALCULATE ( [Volume], USERELATIONSHIP ( 'Date'[Date], Emails[ResolvedAt] ) )
```

Helper **calculated columns** on `Emails`:

```DAX
Age (min) = DATEDIFF ( Emails[ReceivedAt], NOW (), MINUTE )

Aging Bucket =
VAR a = Emails[Age (min)]
RETURN
SWITCH (
    TRUE (),
    Emails[Status] = "resolved", "Closed",
    a <= 15, "1. <= 15m (ack window)",
    a <= 60, "2. 15m - 1h",
    a <= 240, "3. 1h - 4h",
    "4. > 4h (breached)"
)

Received Day = FORMAT ( Emails[ReceivedAt], "ddd" )      -- Sun..Sat
Received Day Sort = WEEKDAY ( Emails[ReceivedAt], 1 )      -- 1..7 for sort order
Received Hour = HOUR ( Emails[ReceivedAt] )               -- 0..23
```

Sort `Received Day` by `Received Day Sort` (Column tools → Sort by column).

## 4. Page layout (mirrors the app)

Canvas: 1280×720, background `#0f172a`.

1. **Header band** (top): a Text box "Mailbox Intake Dashboard" (18pt, `#e2e8f0`)
   with the mailbox address below in muted `#94a3b8`. Add two rounded rectangles
   (shapes) as SLA "pills": "Acknowledge ≤ 15m" and "Complete ≤ 4h".

2. **KPI row** (5 Card visuals, left→right):
   - `Volume` · `Avg First Response (min)` · `Ack SLA Compliance %` ·
     `Completion SLA Compliance %` · `Avg Handle Time (min)`.
   - Format the two SLA cards' callout with **conditional formatting → font
     color**: rules `>= 0.95` green `#22c55e`, `>= 0.85` amber `#f59e0b`, else
     red `#ef4444` (matches the app's colored left borders).

3. **Aging** (Clustered bar chart): Axis = `Aging Bucket`, Value = `Volume`,
   filtered to `Status <> "resolved"`. Set per-bar data colors by bucket
   (green / amber / amber / red).

4. **Volume & trends** (Line and clustered column, or clustered column):
   X = `Date`, columns = `Received (day)` (blue `#38bdf8`) and `Resolved (day)`
   (green `#22c55e`). Filter to last 14 days.

5. **Volume heatmap** (Matrix visual):
   - Rows = `Received Day`, Columns = `Received Hour`, Values = `Volume`.
   - Turn **off** row/column subtotals; set the values cell **background color →
     conditional formatting → color scale**: minimum `#1e293b` → maximum
     `#6366f1` (indigo), matching the app's heatmap intensity.

6. **Inbox** (Table visual): columns `Subject`, `Sender`, `Folder`,
   `ReceivedAt`, `Age (min)`, `Avg First Response (min)` (or per-row response),
   `Status`.
   - **Status** cell background via conditional formatting: `new` blue, `in_progress`
     amber, `resolved` green.
   - **Priority**/SLA columns similarly colored (green met / red breached).
   - Add slicers for `Status`, `Folder`, and `Priority` (chip-styled, matching
     the app's filter chips).

## 5. Notes

- The web app's per-row **Open in Outlook** link maps to a Power BI table column
  formatted as a **Web URL** (Column tools → Data category → Web URL) using the
  message `webLink`; Power BI renders it as a clickable link/button.
- Colors, fonts, and the value scale are all driven by
  `mailbox-intake-theme.json`, so applying the theme gets you ~80% of the look;
  the layout steps above cover the rest.
