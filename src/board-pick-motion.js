// Small visual copies only. Picking and matching remain synchronous game actions.
const FLIGHT_MS = 200, MATCH_MS = 150, MAX_GROUPS = 3;
const rectangle = value => value && ['left','top','width','height'].every(key => Number.isFinite(value[key]))
  && value.width > 0 && value.height > 0;

export function createBoardPickMotion({ host = globalThis.document?.body, reducedMotion = false } = {}) {
  const groups = new Set();
  function cancel() { for (const group of [...groups]) group.cleanup(); }
  function play({ source, destination, matched = [] } = {}) {
    const document = host?.ownerDocument, view = document?.defaultView;
    const target = destination?.rect ?? destination;
    if (reducedMotion || view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      || !host?.append || host.isConnected === false || !document?.createElement
      || typeof source?.html !== 'string' || !source.html || !rectangle(source.rect) || !rectangle(target)) return false;
    const layer = document.createElement('div');
    if (typeof layer.animate !== 'function') return false;
    while (groups.size >= MAX_GROUPS) groups.values().next().value.cleanup();
    layer.className = 'board-pick-motion';
    layer.setAttribute('aria-hidden','true'); layer.inert = true;
    Object.assign(layer.style,{position:'fixed',inset:'0',zIndex:'100',pointerEvents:'none'});
    const animations = new Set();
    let ended = false;
    const group = { cleanup() {
      if (ended) return;
      ended = true; groups.delete(group);
      for (const animation of animations) { animation.finished?.catch?.(() => {}); animation.cancel(); }
      animations.clear(); layer.remove();
    } };
    function ghost(snapshot) {
      const node = document.createElement('div'), rect = snapshot.rect;
      node.className = 'board-pick-ghost';node.innerHTML = snapshot.html;
      node.setAttribute('aria-hidden','true');node.inert = true;
      for (const child of node.querySelectorAll?.('*') || []) {
        for (const key of ['id','data-tile','data-reserve','autofocus','name']) child.removeAttribute(key);
        if (['BUTTON','INPUT','TEXTAREA','SELECT'].includes(child.tagName)) child.disabled = true;
        if (child.tagName === 'A') child.removeAttribute('href');
      }
      Object.assign(node.style,{position:'absolute',left:`${rect.left}px`,top:`${rect.top}px`,
        width:`${rect.width}px`,height:`${rect.height}px`,pointerEvents:'none',
        transformOrigin:'0 0',willChange:'transform,opacity'});
      const face=node.firstElementChild;
      if(face)Object.assign(face.style,{position:'absolute',inset:'0',left:'0',top:'0',
        width:'100%',height:'100%',margin:'0',transform:'none',translate:'none',transition:'none'});
      layer.append(node);return node;
    }
    function animate(node,frames,options) {
      const animation=node.animate(frames,options);animations.add(animation);return animation;
    }
    try {
      const companions = Array.isArray(matched) && matched.length >= 2
        && matched.slice(0,2).every(item=>typeof item?.html==='string' && rectangle(item.rect))
        ? matched.slice(0,2).map(ghost) : [];
      const incoming = ghost(source);
      host.append(layer);groups.add(group);
      const dx=target.left-source.rect.left,dy=target.top-source.rect.top;
      const sx=target.width/source.rect.width,sy=target.height/source.rect.height;
      const flight=animate(incoming,[
        {transform:'translate3d(0,0,0) scale(1,1)',opacity:1},
        {transform:`translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})`,opacity:1},
      ],{duration:FLIGHT_MS,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'});
      flight.finished.then(()=>{
        if(ended)return;
        if(companions.length!==2){group.cleanup();return;}
        // Retarget after arrival so a short match collapse uses the slot's size.
        Object.assign(incoming.style,{left:`${target.left}px`,top:`${target.top}px`,
          width:`${target.width}px`,height:`${target.height}px`});
        animations.delete(flight);flight.cancel();
        try {
          const collapse=[...companions,incoming].map(node=>animate(node,[
            {transformOrigin:'50% 50%',transform:'scale(1)',opacity:1},
            {transformOrigin:'50% 50%',transform:'scale(.2)',opacity:0},
          ],{duration:MATCH_MS,easing:'cubic-bezier(.4,0,1,1)',fill:'both'}));
          Promise.allSettled(collapse.map(animation=>animation.finished)).then(group.cleanup);
        } catch {group.cleanup();}
      },group.cleanup);
      return true;
    } catch {group.cleanup();return false;}
  }
  return {play,cancel};
}
