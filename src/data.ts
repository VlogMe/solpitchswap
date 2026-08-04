import type { Project } from "./types";

export const projects: Project[] = [
  {
    slug: "spsp",
    name: "SolPitch Swap Project",
    symbol: "SPSP",
    contractAddress: "gpshGHm3huLsyTDYsQ7hXJtB9Kb3WhqQxesZaHPpump",
    projectStatus: "launched",
    claimStatus: "verified",
    pitch: "The SolPitch ecosystem token, planned for creator tools, promoted placements and platform utility.",
    description: "SPSP is the SolPitch ecosystem token. Its planned utility includes promoted project placements, creator tools, premium visibility options and future ecosystem benefits as those features are released.",
    badges: ["Owner Verified", "Featured"],
    marketCap: "Live data pending",
    liquidity: "Live data pending",
    volume24h: "Live data pending",
    holders: "Live data pending",
    votes: 0,
    listedLabel: "Founding project",
    links: { website: "https://solpitch.net" },
  },
];

export const promoted = projects.filter(project => project.badges.includes("Featured"));
export const mostVoted = [...projects].sort((a, b) => b.votes - a.votes);
