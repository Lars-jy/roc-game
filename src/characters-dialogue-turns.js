// One click sends a player line; the complete NPC response follows automatically.
// Keep source indexes so partial transcripts never expose unplayed later lines.
export function dialogueTurns(lines) {
  const turns=[];
  for(let index=0;index<lines.length;index++){
    const line=lines[index];
    if(line.speaker==='player')turns.push({prompt:{line,index},responses:[]});
    else {
      if(!turns.length)turns.push({prompt:null,responses:[]});
      turns.at(-1).responses.push({line,index});
    }
  }
  return turns;
}
