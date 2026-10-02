import {validateRequest, type AiRequest} from '../../../../features/screenshot-editor/ai';
import {runAi,aiModels,AiFailure} from '../../../../features/screenshot-editor/aiService';

export const runtime='nodejs';
export const maxDuration=120;
export async function GET(){return Response.json({models:aiModels()});}
export async function POST(request:Request){
 let input:AiRequest;
 try{
  if(Number(request.headers.get('content-length'))>30_000_000)throw new AiFailure('UPLOAD_TOO_LARGE','Uploads are too large.','',false,413);
  const source=await request.text();
  if(source.length>30_000_000)throw new AiFailure('UPLOAD_TOO_LARGE','Uploads are too large.','',false,413);
  input=validateRequest(JSON.parse(source));
  if(input.phase!=='edit' && input.screenshots.some((item,i)=>item.assetIndex!==i))throw new Error('Upload indexes must follow screenshot order.');
 }catch(error){return Response.json({error:(error as Error).message,code:error instanceof AiFailure?error.code:'REQUEST_INVALID',retryable:false,models:aiModels()},{status:error instanceof AiFailure?error.status:400});}
 const controller=new AbortController();
 const timeout=AbortSignal.timeout(110_000);
 const signal=AbortSignal.any([request.signal,controller.signal,timeout]);
 try{return Response.json(await runAi(input,signal));}
 catch(error){
  const failure=error instanceof AiFailure?error:new AiFailure(signal.aborted?(timeout.aborted?'TIMEOUT':'CANCELLED'):'DESIGN_INVALID',signal.aborted?(timeout.aborted?'AI exceeded the 110 second request limit. Retry with fewer screenshots.':'AI request was cancelled.'):'AI could not validate this design. Canvas was kept unchanged.',signal.aborted?'':(error as Error).message,true);
  return Response.json({error:failure.message,code:failure.code,detail:failure.detail,retryable:failure.retryable,models:aiModels()},{status:failure.status});
 }finally{controller.abort();}
}
