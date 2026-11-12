// Ad Formats library (docs/features/ad-formats-library.md).
//
// The format names and numbers come from a reel Scott saved ("35 S-Tier Ad
// Formats to Steal", @byjoeym, 2026-10-28). Numbers 32, 33 and 35 were too
// small to read in the reel, so they are absent rather than invented; the
// numbering keeps the reel's own numbers. Every description and example is
// written for this library, in Scott's businesses: the Lift Club, myBackyard,
// BONSAI, and the websites service (eight examples each).

export const AD_FORMAT_BUSINESSES = ["St. John's Lift Club", "myBackyard", "BONSAI", "Websites"];

export const AD_FORMATS = [
  {
    n: 1, name: "Censored", business: "St. John's Lift Club",
    description: "The product or payoff is hidden behind a censor bar or a blur, with only a hint showing. The gap between the tease and the reveal makes people stop scrolling and wait for the answer.",
    example: "A blurred photo of Saturday's workout board with a censor bar over the movements: “Uncensored Saturday, 3 PM at Ignite. Free to try.”",
  },
  {
    n: 2, name: "The truth", business: "myBackyard",
    description: "Lead with the honest, slightly uncomfortable thing everyone in the niche already knows but nobody says out loud. Owning it builds more trust than any promise could.",
    example: "“The truth: clubs do not lose members at events. They lose them in the dead group chat between events. myBackyard keeps the conversation in one place.”",
  },
  {
    n: 3, name: "Don't be an idiot", business: "Websites",
    description: "Call out the one common mistake the audience keeps making, bluntly, then show the smarter move. It works because nobody wants to be the person still doing it the dumb way.",
    example: "“Still sending customers to a Facebook page instead of a website? Don't be an idiot. Yours is built free, and it is $300 only if you love it.”",
  },
  {
    n: 4, name: "X for X", business: "BONSAI",
    description: "Describe the offer as a famous product for a new audience, the “like Duolingo, but for history” pattern. The borrowed name does all the explaining in about four words.",
    example: "“HubSpot, but for the trades. BONSAI keeps your leads, quotes, and follow-ups in one place, without the enterprise price tag.”",
  },
  {
    n: 5, name: "Song playlist", business: "myBackyard",
    description: "Present the offer as a music playlist: a cover card, track titles that are really activities or benefits, and runtimes beside them. The layout is familiar, so nobody has to learn how to read the ad.",
    example: "A playlist card titled “A Week With Your People”: “Trail Crew Tuesday (45:00)”, “Trivia Night (2:00:00)”, “Sunday Hike Club (3:30:00)”. Every track is a club on myBackyard.",
  },
  {
    n: 6, name: "Tap your goals", business: "myBackyard",
    description: "An app-style card that asks the viewer to tap their goal from a short list, as if the ad were a screen in the product. Even in a still image, people mentally pick one, and picking one feels like starting.",
    example: "“Tap your goal: Find a club. Run an event. Meet people nearby.” Every answer lands on the same place: myBackyard.space.",
  },
  {
    n: 7, name: "Native", business: "Websites",
    description: "Make the ad look exactly like an ordinary post from a real person: same framing, same caption voice, no logo wall. It slips past the scroll reflex because nothing says “ad” until the last line.",
    example: "A plain photo of a cafe counter, captioned “finally got our website done, wish we had done it a year ago”, with the new site's link in the first comment.",
  },
  {
    n: 8, name: "Let's talk numbers", business: "St. John's Lift Club",
    description: "Open with the figures: price, savings, counts, times. Numbers stop the scroll because they promise a concrete answer instead of a vibe.",
    example: "“Let's talk numbers. $0 to join. 25% off Ignite memberships, 15% off Engage, 10% off Alphas in store. One signup form. That is the whole pitch.”",
  },
  {
    n: 9, name: "Science article", business: "BONSAI",
    description: "Style the ad like a newspaper or journal article, headline, byline, and dry tone included. The borrowed authority of the format makes a simple claim feel like it was studied.",
    example: "Headline: “Local Businesses Lose Leads in the Gaps Between Apps, Owners Report.” A short, straight-faced article about quotes that never got followed up, ending with BONSAI as the one place leads live.",
  },
  {
    n: 10, name: "Tier list", business: "Websites",
    description: "Rank the options in the category from S tier down to F tier, placed honestly, with your offer at the top. Tier lists are built to be argued with, and arguments are reach.",
    example: "“Ranking ways to get a business website. S: built for you in a week. A: a DIY builder and a free weekend. F: a Linktree and hope.”",
  },
  {
    n: 11, name: "Venn diagram", business: "St. John's Lift Club",
    description: "Two or three overlapping circles, and the overlap is the punchline. The sweet spot in the middle is exactly where the offer sits.",
    example: "Two circles: “People who lift” and “People who like free stuff.” The overlap reads: “You, at the Lift Club.”",
  },
  {
    n: 12, name: "Zero stars", business: "myBackyard",
    description: "A poster that proudly shows a terrible rating for a joke reason. The self-deprecation reads as confidence, and the fake complaint is the testimonial.",
    example: "“0 stars. Joined for one hike and now my weekends are fully booked with people I actually like.” Signed, a myBackyard member, probably.",
  },
  {
    n: 13, name: "Email screenshot", business: "BONSAI",
    description: "Show the offer as a screenshot of an email, subject line as the headline and a short body as the pitch. Inboxes are where business gets decided, so the format feels like work, not marketing.",
    example: "Subject: “Your quotes, followed up.” Body: “You sent three quotes on Tuesday. By Friday, all three had answers. That is what BONSAI does while you are on the tools.”",
  },
  {
    n: 14, name: "Doodle", business: "Websites",
    description: "A rough hand-drawn sketch explains the offer: stick figures, arrows, one circled word. The unfinished look stands out against polished ads and reads like a note from a friend.",
    example: "A notebook doodle: a stick-figure shop owner, an arrow running from “no website” to a ringing phone, circled twice: “fixed in a week.”",
  },
  {
    n: 15, name: "Reddit style", business: "St. John's Lift Club",
    description: "Format the ad as a Reddit post: subreddit name, upvote count, a confessional title. People read it like a real story because the layout tells them it is one.",
    example: "r/StJohns: “Showed up to a free lifting club knowing nobody. Six months later these are my people.” Posted by the club account; the pinned comment carries the signup link.",
  },
  {
    n: 16, name: "Quiz", business: "myBackyard",
    description: "One question, three or four tap-style answers, and every result points at the offer. A quiz turns a passive viewer into someone who has already answered.",
    example: "“What kind of club person are you? A) Trails. B) Barbells. C) Board games. D) All of it.” Every result: “There is a club for that on myBackyard.”",
  },
  {
    n: 17, name: "Daily use does X", business: "BONSAI",
    description: "Show what using the product every day adds up to over a month or a year. Small daily numbers compound into a result big enough to be the whole ad.",
    example: "“Two minutes of follow-up a day is forty leads a month that never go cold. Daily use does that. That is the BONSAI habit.”",
  },
  {
    n: 18, name: "Free ticket", business: "Websites",
    description: "Style a timed offer like an event ticket: perforated edge, admit-one energy, and a date it expires. A ticket feels like something you already own and would waste by ignoring.",
    example: "A gold ticket graphic: “Admit one local business. One free website build slot. This week only.”",
  },
  {
    n: 19, name: "Cartoon", business: "St. John's Lift Club",
    description: "Draw a simple cartoon outline over a real photo: speech bubbles, arrows, and little annotations. The photo keeps it real while the doodle overlay makes it funny and readable.",
    example: "A photo from the gym floor with a hand-drawn arrow aimed at the whiteboard: “Saturday: costume workout. Yes, really.”",
  },
  {
    n: 20, name: "Recipes", business: "myBackyard",
    description: "Present the offer as a recipe card: ingredients, steps, and a prep time. A familiar format that makes any process feel easy and already proven.",
    example: "“Recipe for a Saturday well spent. Ingredients: one free club, six new people, zero planning. Steps: open myBackyard, pick a club, show up.”",
  },
  {
    n: 21, name: "WhatsApp text", business: "BONSAI",
    description: "Show the pitch as a chat conversation: a customer's question in one bubble, the business answering fast in the next. Chat is how people actually talk to businesses, so the ad feels like a leaked conversation.",
    example: "Customer: “Do you have anything Thursday?” Business: “Booked and confirmed, see you at 10.” Caption: “Answered in under a minute. That is BONSAI watching the inbox.”",
  },
  {
    n: 22, name: "X signs you", business: "Websites",
    description: "A listicle of warning signs, “5 signs you need a new website” style. Each sign is a small pain the viewer recognizes, and recognition does the selling.",
    example: "“5 signs your website is costing you customers. One: the footer still says 2019. Two: it loads like dial-up…” and the fifth sign lands on the free build offer.",
  },
  {
    n: 23, name: "Breaking news", business: "St. John's Lift Club",
    description: "Put a news chyron or anchor-desk frame around a small announcement. The urgency of the format makes ordinary news feel like an event.",
    example: "A lower-third graphic: “BREAKING: Local club lifts heavy things, then eats pizza. Halloween Meet, Saturday 3 PM, Ignite.”",
  },
  {
    n: 24, name: "Sourcing", business: "BONSAI",
    description: "Behind-the-scenes material showing how the thing gets made: the messy spreadsheet, the workshop, the first version. Showing the making builds more trust than showing the result.",
    example: "A screen recording of a chaotic lead spreadsheet becoming one clean BONSAI board, captioned: “Sunday night admin, so Monday is just work.”",
  },
  {
    n: 25, name: "Avoid this", business: "BONSAI",
    description: "Lead with the mistake to dodge instead of the product. The fear of doing it wrong pulls harder than the promise of doing it right.",
    example: "“Avoid this: a quote sitting unanswered for four days. The job went to whoever replied first. BONSAI never lets one sit.”",
  },
  {
    n: 26, name: "Whiteboard", business: "Websites",
    description: "A photo of a whiteboard with the offer explained in marker: boxes, arrows, one circled number. It looks like a strategy session, so viewers lean in like students.",
    example: "A whiteboard photo: “Customers Google you, find no site, call the other guy”, with one big arrow to “Site live in 7 days.”",
  },
  {
    n: 27, name: "Greenscreen", business: "St. John's Lift Club",
    description: "The creator stands in front of a screenshot, post, or photo, pointing at it while they talk. The background does the proving while the person does the reacting.",
    example: "Greenscreen in front of the Halloween Meet signup page: “You are telling me this is free, and there is a costume contest?”",
  },
  {
    n: 28, name: "Receipt", business: "myBackyard",
    description: "Style the proof as a receipt: itemized lines, a total, and a thank-you at the bottom. Receipts are the one document everyone reads all the way down.",
    example: "A receipt reads: “One new club joined: $0.00. Three events this month: $0.00. Total due: $0.00. Thank you for showing up.”",
  },
  {
    n: 29, name: "Partnership carousels", business: "BONSAI",
    description: "A carousel made with a partner: your slides and theirs alternate, both accounts post it, and each audience meets the other brand halfway.",
    example: "A carousel with a local bookkeeper: their slides on clean books, BONSAI's slides on clean pipelines, and one shared last slide: “Run the whole office from two tools.”",
  },
  {
    n: 30, name: "Notification offer", business: "Websites",
    description: "Format the offer as a stack of phone notifications on a lock screen, the bubbles carrying the pitch. Notifications are the most-tapped surface on a phone, and the format borrows that reflex.",
    example: "A lock screen with one notification: “Websites: your new site is live. First customer inquiry arrived 12 minutes after launch.”",
  },
  {
    n: 31, name: "Demographic callout", business: "St. John's Lift Club",
    description: "Name exactly who it is for, right in the headline: age, place, situation. The right people feel personally addressed, and everyone else scrolling on is the point.",
    example: "“St. John's, in your 20s or 30s, lifting alone because your friends will not go: this free club was built for you.”",
  },
  {
    n: 34, name: "Google search", business: "myBackyard",
    description: "Build the ad inside a fake Google search: the query on top and the offer as the top result. It borrows the trust of the results page and answers the exact question people already type.",
    example: "Search bar: “things to do in St. John's this weekend.” Top result: “myBackyard: clubs, meetups, and people nearby. Free to join.”",
  },
];

/**
 * Case-insensitive substring filter across every card field. A blank query
 * returns the list unchanged, so clearing the box restores the full grid.
 */
export function filterAdFormats(formats, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return formats;
  return formats.filter((f) =>
    [f.name, f.business, f.description, f.example]
      .some((field) => String(field || "").toLowerCase().includes(q)));
}
