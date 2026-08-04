export type ProjectBadge = "Verified" | "Featured" | "Trending" | "Community Listed" | "Owner Verified" | "Founding Project";
export type ProjectStatus = "graduated" | "bonding" | "launched" | "presale" | "upcoming";
export type ClaimStatus = "unclaimed" | "pending" | "verified" | "disputed";

export type Project = {
  slug: string;
  name: string;
  symbol: string;
  contractAddress: string;
  projectStatus: ProjectStatus;
  claimStatus: ClaimStatus;
  pitch: string;
  description: string;
  badges: ProjectBadge[];
  logoURI?: string;
  marketCap: string;
  liquidity: string;
  volume24h: string;
  holders: string;
  votes: number;
  listedLabel: string;
  links: { website?: string; x?: string; telegram?: string; discord?: string };
};

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type CoinSubmission = {
  id: string;
  submittedAt: string;
  status: SubmissionStatus;
  projectStatus: ProjectStatus;
  name: string;
  symbol: string;
  contractAddress: string;
  pitch: string;
  description: string;
  website: string;
  x: string;
  telegram: string;
  statusProof: string;
  submitterEmail: string;
  reviewerNote?: string;
};
