export type ProjectBadge = "Graduated" | "Verified" | "Featured" | "Trending";

export type Project = {
  slug: string;
  name: string;
  symbol: string;
  contractAddress: string;
  pitch: string;
  description: string;
  badges: ProjectBadge[];
  marketCap: string;
  liquidity: string;
  volume24h: string;
  holders: string;
  votes: number;
  listedLabel: string;
  links: {
    website?: string;
    x?: string;
    telegram?: string;
    discord?: string;
  };
};

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type CoinSubmission = {
  id: string;
  submittedAt: string;
  status: SubmissionStatus;
  name: string;
  symbol: string;
  contractAddress: string;
  pitch: string;
  description: string;
  website: string;
  x: string;
  telegram: string;
  graduationProof: string;
  reviewerNote?: string;
};
