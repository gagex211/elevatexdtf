// Simple rotation-aware shelf/guillotine hybrid packer for rectangles (in inches)
export type ItemRect = { id:string; w:number; h:number; rot?:boolean };
export type Placed = ItemRect & { x:number; y:number; rotated:boolean };
export function autoNest(sheetW:number, sheetH:number, items: ItemRect[], allowRotation=true){
  const placed: Placed[] = []; let cursorY = 0; let shelfH = 0; let cursorX = 0; const pad = 0.25;
  const sorted = [...items].sort((a,b)=> Math.max(b.w,b.h) - Math.max(a.w,a.h));
  for (const it of sorted){
    let w=it.w, h=it.h, rotated=false;
    if (allowRotation && h<w && h <= sheetW && w <= sheetH && (w>sheetW || cursorX + w > sheetW) && (h <= sheetH)){
      [w,h] = [h,w]; rotated=true;
    }
    if (cursorX + w + pad > sheetW){ cursorY += shelfH + pad; cursorX = 0; shelfH = 0; }
    if (cursorY + h + pad > sheetH) break;
    placed.push({ id: it.id, w, h, x: cursorX, y: cursorY, rotated });
    cursorX += w + pad; shelfH = Math.max(shelfH, h);
  }
  const usedArea = placed.reduce((s,p)=> s + p.w*p.h, 0);
  const util = usedArea / (sheetW*sheetH);
  return { placed, utilization: util };
}
