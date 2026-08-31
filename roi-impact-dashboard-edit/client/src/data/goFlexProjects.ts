export type GoFlexImpactMetric = {
  label: string;
  value: string;
  detail?: string;
};

export type GoFlexProject = {
  id: string;
  name: string;
  period: string;
  summary: string;
  highlights: string[];
  metrics: GoFlexImpactMetric[];
};

export const GO_FLEX_BUSINESS_UNIT = {
  name: "GO-Flex Business Unit",
  description:
    "Automation and operational excellence initiatives across GO-Flex workflows.",
};

export const GO_FLEX_PROJECTS: GoFlexProject[] = [
  {
    id: "open-order-hivesight",
    name: "Open Order Process — HiveSight Automation",
    period: "Q4 2025 baseline",
    summary:
      "This initiative automates the GO-Flex Open Order workflow across email and portal requests using HiveSight. Based on Q4 2025 DOMO data, the automation reduces average processing time by 7 minutes per request—from 31.08 to 24.08 minutes—driving measurable labor savings and faster turnaround for completed orders.",
    highlights: [
      "12,027 Open Order requests completed in Q4 2025 (749 email, 11,278 portal).",
      "Average volume of ~4,009 requests per month (~194 per business day).",
      "Estimated 1,403.2 labor hours saved in Q4 if automation applies to all completed requests.",
      "Projected ~$21.4K in Q4 labor cost avoidance at a blended $15.28/hr offshore rate.",
      "~$20K in annual licensing cost avoidance through Salesforce license reduction.",
    ],
    metrics: [
      {
        label: "Q4 volume",
        value: "12,027",
        detail: "749 email · 11,278 portal",
      },
      {
        label: "Time saved / request",
        value: "7 min",
        detail: "31.08 → 24.08 min avg",
      },
      {
        label: "Hours saved / day",
        value: "23",
        detail: "~468 hrs / month",
      },
      {
        label: "Q4 labor savings",
        value: "$21.4K",
        detail: "at $15.28/hr blended rate",
      },
    ],
  },
];
