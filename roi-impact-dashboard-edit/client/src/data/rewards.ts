export type RewardEntry = {
  id: string;
  quarter: string;
  title: string;
  recipients: string[];
  highlight: string;
  message: string;
  tagline: string;
};

export const REWARDS: RewardEntry[] = [
  {
    id: "q2-innovator-2025",
    quarter: "Q2 2025",
    title: "Innovator of the Quarter",
    recipients: ["Michael Florida", "Ramya Venugopal"],
    highlight: "You automated it!",
    message:
      "Your creativity, initiative, and problem-solving brilliance are driving smarter processes, saving time, and taking Global Operations to the next level.",
    tagline: "Great minds. Bold ideas. Global impact.",
  },
];
