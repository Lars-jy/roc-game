import { CARDS, CARD_MAP, TASK_IDS } from './data.js';

const isNote = card => ['note','conclusion','account','organization'].includes(card.type);

// Coordinates are independent of the viewport: moving past the original desk
// rectangle never clamps a card or the camera to an edge.
const defaults = Object.fromEntries(CARDS.map(card => {
  if (card.position) return [card.id,card.position];
  const peers=CARDS.filter(item=>item.type!=='task'&&isNote(item)===isNote(card));
  const index=peers.findIndex(item=>item.id===card.id);
  return [card.id,{x:1820+(index%4)*320,y:(isNote(card)?1660:120)+Math.floor(index/4)*(isNote(card)?240:370)}];
}));

export function getCardPosition(state,id) {
  const point=state.positions[id]||defaults[id];
  return point?{...point}:null;
}

// Keep answers and connections in their existing state; only replace positions
// for the cards on the desk. Measured heights include expanded question strips.
export function organizeCards(state,ids,sizes={}) {
  const selected=[...new Set(ids)].filter(id=>CARD_MAP[id]);
  const positions={...state.positions};
  function rows(list,{x,y,columns,gapX,gapY}) {
    for(let i=0;i<list.length;i+=columns) {
      const row=list.slice(i,i+columns);
      row.forEach((id,column)=>{positions[id]={x:x+column*gapX,y};});
      y+=Math.max(...row.map(id=>sizes[id]?.height||(CARD_MAP[id].type==='task'?720:isNote(CARD_MAP[id])?180:277)))+gapY;
    }
    return y;
  }
  rows(TASK_IDS.filter(id=>selected.includes(id)),{x:100,y:120,columns:4,gapX:400,gapY:100});
  const documents=selected.filter(id=>CARD_MAP[id].type!=='task'&&!isNote(CARD_MAP[id]));
  const notes=selected.filter(id=>CARD_MAP[id].type!=='task'&&isNote(CARD_MAP[id]));
  const noteTop=rows(documents,{x:1820,y:120,columns:4,gapX:340,gapY:85});
  rows(notes,{x:1820,y:noteTop+(documents.length?40:0),columns:4,gapX:340,gapY:80});
  return {...state,positions};
}
