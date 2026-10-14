// Retry one transient provider failure. Never loop on invalid keys, quota or invalid model output.
export async function retryAiRequest<T>(request:()=>Promise<T>, wait:()=>Promise<void>=()=>new Promise(resolve=>setTimeout(resolve,750))):Promise<T>{
  try{return await request();}catch(error){
    const e=error as {status?:number;cause?:{code?:string}};
    if(![500,502,503,504].includes(Number(e.status)) && !['ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT'].includes(e.cause?.code||''))throw error;
    await wait();
    return request();
  }
}
export function aiFailureMessage(error:unknown){
  const e=error as {status?:number;cause?:{code?:string}};
  if(Number(e?.status)===429)return 'The AI request or provider quota limit was reached. Wait before retrying or review the server usage policy.';
  if([401,403].includes(Number(e?.status)))return 'The AI service rejected the server credential or its permissions.';
  if(Number(e?.status)===404)return 'The configured AI service is unavailable.';
  if([500,502,503,504].includes(Number(e?.status)))return 'The AI service is temporarily unavailable after a retry. Please try again shortly.';
  if(e?.cause?.code)return 'The server could not reach the AI service. Check its network access and retry.';
  return 'AI request or result validation failed. Please retry; check server logs if this continues.';
}
