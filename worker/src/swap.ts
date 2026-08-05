interface SwapEnv { SOLANA_RPC_URL?: string; JUPITER_API_URL?: string }

const SOLANA_ADDRESS=/^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
function json(data:unknown,status=200,headers:HeadersInit={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}})}
async function upstreamJson(url:string,init:RequestInit={}){const response=await fetch(url,{...init,headers:{accept:"application/json",...(init.headers??{})},signal:AbortSignal.timeout(12000)});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(String((body as {error?:string}).error||`Upstream request failed (${response.status})`));return body;}

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
   const token=await upstreamJson(`https://tokens.jup.ag/token/${encodeURIComponent(mint)}`) as Record<string,unknown>;
   return json({symbol:String(token.symbol??"TOKEN"),name:String(token.name??token.symbol??"Solana Token"),mint:String(token.address??mint),decimals:Number(token.decimals??6),logoURI:String(token.logoURI??"")||undefined},200,{...cors,"cache-control":"public, max-age=300"});
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
