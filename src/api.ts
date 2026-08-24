import type { CoinSubmission, Project, ProjectCategory, ProjectStatus } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "https://api.solpitch.com";
type ApiError = { error?: string };
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined && init.body !== null;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: hasBody ? { "content-type": "application/json", ...(init.headers ?? {}) } : init.headers,
  });
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function normalizeLogoUrl(value: unknown) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  const ipfsMatch = url.match(/^ipfs:\/\/(?:ipfs\/)?([^/?#]+)/i) ?? url.match(/\/ipfs\/([^/?#]+)/i);
  const cid = ipfsMatch?.[1] ?? (/^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]+)$/i.test(url) ? url : "");
  return cid ? `https://${cid}.ipfs.dweb.link/` : url;
}

export type TokenAnalysis = { found:boolean; address:string; tradable:boolean; name?:string; symbol?:string; logoUrl?:string; website?:string; xUrl?:string; telegramUrl?:string; dexScreenerUrl?:string; dexId?:string; pairAddress?:string; priceUsd?:string; liquidityUsd?:number; marketCap?:number; volume24h?:number; metadataFound?:number; metadataTotal?:number; analysisLevel?:"strong"|"review"|"manual"; description?:string; pitch?:string; metadataSource?:string; descriptionFound?:boolean };
export type ClaimRequest = { id:string; projectName:string; projectSymbol:string; projectSlug:string; walletAddress:string; evidenceUrl:string; submitterEmail:string; createdAt:string };
export type ActivityEvent = { id:string; projectId?:string; eventType:string; eventText:string; createdAt:string; slug?:string; name?:string; symbol?:string; logoUrl?:string };
export type SubmissionPayload = { name:string; symbol:string; contractAddress:string; projectStatus:ProjectStatus; pitch:string; description:string; website?:string; xUrl?:string; telegramUrl?:string; logoUrl?:string; statusProofUrl:string; submitterEmail:string; turnstileToken?:string };
export type XSession = { authenticated:boolean; username?:string; userId?:string };
export type MyProjectUpdate = { name?:string; pitch?:string; description?:string; website?:string; xUrl?:string; telegramUrl?:string; logoUrl?:string };

export function getXLoginUrl(){return `${API_BASE}/api/auth/x/login`;}
export async function getXSession(){return request<XSession>('/api/auth/x/session');}
export async function logoutX(){return request<{ok:true}>('/api/auth/x/logout',{method:'POST',body:'{}'});}
export async function getMyProjects(){const result=await request<{projects:Record<string,unknown>[]}>('/api/my/projects');return result.projects.map(mapProjectRow);}
export async function updateMyProject(id:string,payload:MyProjectUpdate){return request<{ok:true}>(`/api/my/projects/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)});}
export async function deleteMyProject(id:string){return request<{ok:true}>(`/api/my/projects/${encodeURIComponent(id)}`,{method:'DELETE'});}
export async function analyzeToken(address:string){const result=await request<TokenAnalysis>(`/api/analyze-token?address=${encodeURIComponent(address)}`);return{...result,logoUrl:normalizeLogoUrl(result.logoUrl)||undefined};}
export async function getPublishedProjects(){const result=await request<{projects:Record<string,unknown>[]}>('/api/projects');return result.projects.map(mapProjectRow);}
export async function getActivity(){const result=await request<{events:Record<string,unknown>[]}>('/api/activity');return result.events.map(row=>({id:String(row.id),projectId:String(row.project_id??'')||undefined,eventType:String(row.event_type),eventText:String(row.event_text),createdAt:String(row.created_at),slug:String(row.slug??'')||undefined,name:String(row.name??'')||undefined,symbol:String(row.symbol??'')||undefined,logoUrl:normalizeLogoUrl(row.logo_url)||undefined}));}
export async function submitCoin(payload:SubmissionPayload){return request<{id:string;status:"pending";projectStatus:ProjectStatus}>('/api/submissions',{method:'POST',body:JSON.stringify(payload)});}
export async function createClaimNonce(projectSlug:string,walletAddress:string){return request<{nonce:string;message:string}>('/api/claims/nonce',{method:'POST',body:JSON.stringify({projectSlug,walletAddress})});}
export async function submitClaim(payload:{nonce:string;walletAddress:string;signature:string;evidenceUrl?:string;submitterEmail?:string}){return request<{id:string;status:"pending"}>('/api/claims',{method:'POST',body:JSON.stringify(payload)});}
export async function createVoteNonce(projectSlug:string,walletAddress:string){return request<{nonce:string;message:string;weekKey:string}>('/api/votes/nonce',{method:'POST',body:JSON.stringify({projectSlug,walletAddress})});}
export async function submitVote(payload:{nonce:string;walletAddress:string;signature:string}){return request<{ok:true;votes:number;weekKey:string}>('/api/votes',{method:'POST',body:JSON.stringify(payload)});}
export async function adminLogin(password:string){return request<{ok:true}>('/api/admin/login',{method:'POST',body:JSON.stringify({password})});}
export async function adminLogout(){return request<{ok:true}>('/api/admin/logout',{method:'POST',body:'{}'});}
export async function getAdminSession(){return request<{authenticated:boolean}>('/api/admin/session');}
export async function getPendingSubmissions(){const result=await request<{submissions:Record<string,unknown>[]}>('/api/admin/submissions?status=pending');return result.submissions.map(mapSubmissionRow);}
export async function getPendingClaims(){const result=await request<{claims:Record<string,unknown>[]}>('/api/admin/claims');return result.claims.map(row=>({id:String(row.id),projectName:String(row.project_name),projectSymbol:String(row.project_symbol),projectSlug:String(row.project_slug),walletAddress:String(row.wallet_address),evidenceUrl:String(row.evidence_url??''),submitterEmail:String(row.submitter_email??''),createdAt:String(row.created_at)}));}
export async function reviewSubmission(id:string,status:"approved"|"rejected",reviewerNotes:string,options:{addedToSwap?:boolean;promoted?:boolean;logoUrl?:string}={}){return request<{ok:true}>(`/api/admin/submissions/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status,reviewerNotes,...options})});}
export async function reviewClaim(id:string,status:"approved"|"rejected",reviewerNotes:string){return request<{ok:true}>(`/api/admin/claims/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status,reviewerNotes})});}

function categoryFromDescription(value: string): ProjectCategory {
  const match = value.match(/^\[Category: ([^\]]+)\]/);
  const category = match?.[1] as ProjectCategory | undefined;
  return category ?? "Other";
}
function cleanDescription(value: string) { return value.replace(/^\[Category: [^\]]+\]\s*/, ""); }
function mapProjectRow(row:Record<string,unknown>):Project{
  const promoted=Number(row.promoted??0)===1;
  const description=String(row.description??"");
  const publishedAt=String(row.published_at??"");
  return{
    id:String(row.id??"")||undefined,
    slug:String(row.slug),name:String(row.name),symbol:String(row.symbol),contractAddress:String(row.contract_address),
    projectStatus:String(row.project_status) as ProjectStatus,claimStatus:String(row.claim_status??'unclaimed') as Project['claimStatus'],
    category:categoryFromDescription(description),pitch:String(row.pitch||"No public short description has been provided."),description:cleanDescription(description)||"No public project description has been provided.",
    badges:promoted?["Community Listed","Featured"]:["Community Listed"],logoURI:normalizeLogoUrl(row.logo_url)||undefined,
    marketCap:'Updating…',liquidity:'Updating…',volume24h:'Updating…',holders:'Unavailable',votes:Number(row.votes??0),
    addedToSwap:Number(row.added_to_swap??0)===1,promoted,listedLabel:publishedAt?new Date(publishedAt).toLocaleDateString():"Recently",publishedAt,
    xUserId:String(row.x_user_id??'')||undefined,xUsername:String(row.x_username??'')||undefined,
    links:{website:String(row.website??'')||undefined,x:String(row.x_url??'')||undefined,telegram:String(row.telegram_url??'')||undefined}
  };
}
function mapSubmissionRow(row:Record<string,unknown>):CoinSubmission{return{id:String(row.id),name:String(row.name),symbol:String(row.symbol),contractAddress:String(row.contract_address),projectStatus:String(row.project_status) as ProjectStatus,pitch:String(row.pitch),description:String(row.description),website:String(row.website??''),x:String(row.x_url??''),telegram:String(row.telegram_url??''),statusProof:String(row.status_proof_url),submitterEmail:String(row.submitter_email??''),reviewerNote:String(row.reviewer_notes??''),status:String(row.status) as CoinSubmission['status'],submittedAt:String(row.created_at)};}
