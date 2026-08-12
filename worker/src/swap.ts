interface SwapEnv { SOLANA_RPC_URL?: string; JUPITER_API_URL?: string }

const SOLANA_ADDRESS=/^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
function json(data:unknown,status=200,headers:HeadersInit={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}})}
async function upstreamJson(url:string,init:RequestInit={}){const response=await fetch(url,{...init,headers:{accept:"application/json",...(init.headers??{})},signal:AbortSignal.timeout(12000)});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(String((body as {error?:string}).error||`Upstream request failed (${response.status})`));return body;}
async function tryJson(url:string){try{return await upstreamJson(url) as Record<string,unknown>}catch{return null}}

async function lookupToken(mint:string){
 const jupiter=await tryJson(`https://tokens.jup.ag/token/${encodeURIComponent(mint)}`);
 if(jupiter?.symbol){return {symbol:String(jupiter.symbol),name:String(jupiter.name??jupiter.symbol),mint:String(jupiter.address??mint),decimals:Number(jupiter.decimals??6),logoURI:String(jupiter.logoURI??"")||undefined}}
 const dex=await tryJson(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`) as {pairs?:Array<Record<string,unknown>>}|null;
 const pair=Array.isArray(dex?.pairs)?dex!.pairs![0]:undefined;
 const base=(pair?.baseToken??{}) as Record<string,unknown>;const quote=(pair?.quoteToken??{}) as Record<string,unknown>;
 const token=String(base.address??"")===mint?base:String(quote.address??"")===mint?quote:base;
 const pump=await tryJson(`https://frontend-api-v3.pump.fun/coins-v2/${encodeURIComponent(mint)}`);
 if(pump?.symbol){return {symbol:String(pump.symbol),name:String(pump.name??pump.symbol),mint,decimals:6,logoURI:String(pump.image_uri??"")||undefined}}
 if(token.symbol){return {symbol:String(token.symbol),name:String(token.name??token.symbol),mint,decimals:6,logoURI:undefined}}
 throw new Error("Token metadata could not be loaded. Confirm the CA is live/bonded and tradable with sufficient liquidity for a Jupiter route. Jupiter has no fixed dollar minimum; routability depends on pool depth and price impact.");
}

export async function handleSwapRequest(request:Request,env:SwapEnv,cors:HeadersInit):Promise<Response|null>{
 const url=new URL(request.url);const jupiter=(env.JUPITER_API_URL||"https://lite-api.jup.ag/swap/v1").replace(/\/$/,"");
 try{
  if(url.pathname==="/api/swap/quote"&&request.method==="GET"){
   const inputMint=url.searchParams.get("inputMint")??"";const outputMint=url.searchParams.get("outputMint")??"";const amount=url.searchParams.get("amount")??"";const slippageBps=url.searchParams.get("slippageBps")??"50";
   if(!SOLANA_ADDRESS.test(inputMint)||!SOLANA_ADDRESS.test(outputMint)||!/^\d+$/.test(amount))return json({error:"Invalid swap quote request."},400,cors);
   const query=new URLSearchParams({inputMint,outputMint,amount,slippageBps,restrictIntermediateTokens:"true"});
   return json(await upstreamJson(`${jupiter}/quote?${query}`),200,{...cors,"cache-control":"no-store"});
  }
  if(url.pathname==="/api/swap/token"&&request.method==="GET"){
   const mint=(url.searchParams.get("mint")??"").trim();if(!SOLANA_ADDRESS.test(mint))return json({error:"Enter a valid Solana contract address."},400,cors);
   return json(await lookupToken(mint),200,{...cors,"cache-control":"public, max-age=300"});
  }
  if(url.pathname==="/api/swap/build"&&request.method==="POST"){
   const body=await request.json<{quoteResponse?:unknown;userPublicKey?:string}>().catch(()=>({}));if(!body.quoteResponse||!body.userPublicKey||!SOLANA_ADDRESS.test(body.userPublicKey))return json({error:"Quote and Phantom wallet are required."},400,cors);
   const result=await upstreamJson(`${jupiter}/swap`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({quoteResponse:body.quoteResponse,userPublicKey:body.userPublicKey,wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true,prioritizationFeeLamports:"auto"})});
   return json(result,200,{...cors,"cache-control":"no-store"});
  }
  if(url.pathname==="/api/swap/send"&&request.method==="POST"){
   const body=await request.json<{signedTransaction?:string}>().catch(()=>({}));if(!body.signedTransaction)return json({error:"Signed transaction is required."},400,cors);
   const rpc=env.SOLANA_RPC_URL||"https://api.mainnet-beta.solana.com";const result=await upstreamJson(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"sendTransaction",params:[body.signedTransaction,{encoding:"base64",skipPreflight:false,maxRetries:3}]})}) as {result?:string;error?:{message?:string}};
   if(result.error||!result.result)return json({error:result.error?.message||"Transaction submission failed."},502,cors);return json({signature:result.result},200,cors);
  }
 }catch(error){return json({error:error instanceof Error?error.message:"Swap service unavailable."},502,cors)}
 return null;
}
