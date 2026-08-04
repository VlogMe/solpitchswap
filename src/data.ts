import type { Project } from "./types";

export const projects: Project[] = [
  {
    slug: "onyx",
    name: "Onyx",
    symbol: "ONYX",
    contractAddress: "5uHh5i8KUHmu6334mcQpc6FejLuoJQSjJZYPgQ8cpump",
    projectStatus: "graduated",
    pitch: "A community-listed Solana project approved for the SolPitch directory.",
    description: "Onyx is the first real named listing in the new SolPitch directory. The project page is structured to support verified links, live market data, media, updates, voting and direct access to the existing SolPitch swap.",
    badges: ["Graduated", "Verified", "Featured"],
    marketCap: "Live soon",
    liquidity: "Live soon",
    volume24h: "Live soon",
    holders: "Live soon",
    votes: 128,
    listedLabel: "Recently",
    links: {},
  },
  {
    slug: "launch-preview",
    name: "New Launch Preview",
    symbol: "TOKEN",
    contractAddress: "Verified contract address",
    projectStatus: "launched",
    pitch: "A realistic preview of how an approved live launch appears with its status clearly labeled.",
    description: "This placeholder demonstrates the reusable project structure without pretending the project is real.",
    badges: ["Launched", "Trending"],
    marketCap: "$245K",
    liquidity: "$41K",
    volume24h: "$18K",
    holders: "1.2K",
    votes: 94,
    listedLabel: "2 days ago",
    links: {},
  },
];

export const promoted = projects.slice(0, 2);
export const mostVoted = [...projects].sort((a, b) => b.votes - a.votes);
