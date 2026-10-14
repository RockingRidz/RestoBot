import {describe,it,expect,vi} from 'vitest';
import {retryAiRequest,aiFailureMessage} from '../lib/aiReliability';
describe('AI provider failure handling',()=>{
 it('retries a transient deadline once and returns the real response',async()=>{
  const request=vi.fn().mockRejectedValueOnce({status:504}).mockResolvedValueOnce({text:'real'});
  expect(await retryAiRequest(request,async()=>{})).toEqual({text:'real'});
  expect(request).toHaveBeenCalledTimes(2);
 });
 it('stops after two failures',async()=>{
  const request=vi.fn().mockRejectedValue({status:503});
  await expect(retryAiRequest(request,async()=>{})).rejects.toEqual({status:503});
  expect(request).toHaveBeenCalledTimes(2);
 });
 it.each([401,403,404,429])('does not retry configuration or quota failure %s',async(status)=>{
  const request=vi.fn().mockRejectedValue({status});
  await expect(retryAiRequest(request,async()=>{})).rejects.toEqual({status});
  expect(request).toHaveBeenCalledTimes(1);
 });
 it('never includes provider raw messages in the user-facing error',()=>{
  expect(aiFailureMessage({status:403,message:'secret credential content'})).not.toContain('secret');
  expect(aiFailureMessage({status:429})).toContain('quota');
 });
});
