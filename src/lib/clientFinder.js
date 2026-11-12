// Client Finder playbook (docs/features/client-finder-harvey.md).
//
// The method facts come from a reel Scott saved (Nick Saraev, @nick_saraev,
// 2026-10-31) presenting Harvey, and from the public repo, verified on
// GitHub on 2026-11-04. Every description on the page is written for this
// playbook; none of the reel's wording is copied. The ICP, the example
// email, and the guardrails are Scott's own prospecting terms and rules.

export const HARVEY = {
  name: "Harvey",
  summary:
    "Harvey is a free, open-source autonomous AI sales agent. It runs inside Claude Code or Codex: you describe your business, and it builds a prospect list, researches each business, finds the owner and a verified email, and then runs the outreach and the follow-ups.",
  repoUrl: "https://github.com/ethanplusai/harvey",
  stats: {
    license: "MIT",
    language: "Python",
    stars: "4,361",
    forks: "912",
    created: "Mar 12, 2026",
    lastPush: "Nov 2, 2026",
    verifiedOn: "Nov 4, 2026",
  },
};

export const VERDICT_POINTS = [
  "The tool is real. Harvey is free and open source under the MIT license, the repo is public, and it was still being updated days before this page was written.",
  "The results in the reel are demo only. Its example contacts use reserved .test email addresses, so the reel shows the workflow working, not real prospects or real sales.",
  "The reel gates its download link behind commenting a keyword. We do not engage with gated links; the public repo linked above is the source, found directly.",
];

export const WORKFLOW_STEPS = [
  {
    n: 1, title: "Describe the business",
    description: "You start by telling the agent what your business sells, who it helps, and what a good customer looks like, in plain words.",
  },
  {
    n: 2, title: "Build the ideal customer profile",
    description: "From that description it drafts an ICP: the industries to target, the cities to work, and the company size that fits the offer.",
  },
  {
    n: 3, title: "Search business listings",
    description: "It searches business listings in those cities and industries and builds a working list of candidate companies.",
  },
  {
    n: 4, title: "Study websites and ad libraries",
    description: "For each candidate it reads the website and checks the ad libraries, looking for signs the business is active and spending to grow.",
  },
  {
    n: 5, title: "Spot the businesses that fit",
    description: "It compares the list against the offer and keeps the businesses whose situation matches what you sell.",
  },
  {
    n: 6, title: "Find the owner and a verified email",
    description: "For each fit it looks up the owner's name and title and a verified email address, so outreach reaches a person instead of a general inbox.",
  },
  {
    n: 7, title: "Send a personalized email",
    description: "It writes and sends an email tailored to that business, referencing what it found. In Scott's setup this step stays off until he approves a batch (see Guardrails).",
  },
  {
    n: 8, title: "Keep the conversation going",
    description: "When a prospect replies, it answers and works toward booking a call. In Scott's setup, replies are his to handle, not the agent's.",
  },
  {
    n: 9, title: "Follow up when a prospect goes cold",
    description: "If a prospect stops answering, it sends follow-ups on a schedule. In Scott's setup, follow-ups use only the sequence he has approved.",
  },
];

export const ICP_INTRO =
  "This is the profile Harvey needs before it searches, filled in with Scott's approved prospecting terms for the websites service.";

export const ICP_FIELDS = [
  {
    label: "Industries",
    value: "Local service businesses: trades such as roofing, plumbing, electrical, and auto repair, plus clinics, salons and barbers, restaurants, cleaners, and similar owner-run services.",
  },
  {
    label: "Cities",
    value: "St. John's and the metro area: Mount Pearl, Paradise, Conception Bay South, and Torbay.",
  },
  {
    label: "Company size",
    value: "Small teams. Owner-run, or a handful of staff: big enough to take bookings, small enough that the owner still answers the phone.",
  },
  {
    label: "The offer",
    value: "The website is built free upfront. It is $300 if they love it, then $50 per month for care and updates.",
  },
];

export const ICP_FIT_SIGNALS = [
  "A weak or dated website that undersells good reviews",
  "No website at all, only a Facebook page or a directory listing",
  "Phone-only booking: no online booking, contact form, or email path",
  "Strong ratings and review counts with nowhere for customers to land",
  "Ads running that point at a page which cannot take a booking",
];

export const PROSPECT_FIELDS = [
  "Business name",
  "Owner name and title",
  "Verified email",
  "Rating",
  "Review count",
  "Category",
  "Address",
  "Opening hours",
  "Phone",
];

export const EXAMPLE_EMAIL = {
  note: "Draft example. The business is fictional; the shape, the gap it names, and the terms are the real ones.",
  company: "Harbourline Roofing (fictional)",
  subject: "A website for Harbourline Roofing, built free first",
  body: [
    "Hi Mark,",
    "I found Harbourline Roofing while looking at roofers in St. John's. Your reviews are strong, but customers can only reach you by phone, and there is no website where they can check your work or send a request after hours.",
    "I build websites for local service businesses. I will build yours free upfront, so you see the finished thing before you pay anything. If you love it, it is $300, then $50 a month for care and updates. If you do not, you owe nothing.",
    "Worth a look? I can have a first version in front of you this week.",
    "Scott Adams",
  ],
};

export const GUARDRAILS = [
  "Automatic sending stays OFF. Harvey does not email anyone in Scott's setup on its own.",
  "Automatic replies stay OFF. When a prospect answers, Scott handles the conversation himself.",
  "Scott approves the outreach kit and every batch before anything sends. That standing rule does not change for this tool.",
  "CASL applies to every send: a lawful basis for the message, accurate sender identification, and a working unsubscribe.",
  "The club outreach sequence Scott already approved for myBackyard is a separate lane. This playbook covers website clients only.",
];
