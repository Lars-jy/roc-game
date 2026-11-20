import { WIDTH, HEIGHT } from './player-model.js';
import { OPEN_RESPONSE_FIELDS, validateOpenResponse } from '../open-response.js';

export function endingViewport(width,height) {
  const scale=Math.min(width/WIDTH,height/HEIGHT);
  if(!Number.isFinite(scale)||scale<=0)throw new Error('Invalid ending viewport.');
  return {scale,x:Math.max(0,(width-WIDTH*scale)/2),y:Math.max(0,(height-HEIGHT*scale)/2)};
}
export function normalizeEndingAnswer(value) {
  if(!validateOpenResponse(value,{submitted:true}))return null;
  return Object.fromEntries(OPEN_RESPONSE_FIELDS.map(({id})=>[id,value[id]]));
}
