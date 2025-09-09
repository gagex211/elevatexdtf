"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import ToolbarButton from "./ToolbarButton";
import { autoNest } from "./nesting";

const DEFAULT_DPI = 300;
const IN_TO_PX = (inches:number, dpi:number) => Math.round(inches * dpi);
const PX_TO_IN = (px:number, dpi:number) => px / dpi;
const rad = (deg:number)=> (deg * Math.PI)/180;
const clamp = (n:number, min:number, max:number)=> Math.max(min, Math.min(max, n));

const PRESETS = [
  { label: "22 × 60 in (Standard)", w: 22, h: 60 },
  { label: "22 × 84 in (Tall)", w: 22, h: 84 },
  { label: "24 × 36 in (Sheet)", w: 24, h: 36 },
  { label: "Custom", w: 22, h: 60 }
];

function checkerPattern(ctx:CanvasRenderingContext2D, size=16, c1="#e5e7eb", c2="#ffffff"){
  const p=document.createElement("canvas"); p.width=p.height=size*2;
  const c=p.getContext("2d")!;
  c.fillStyle=c1; c.fillRect(0,0,p.width,p.height);
  c.fillStyle=c2; c.fillRect(0,0,size,size); c.fillRect(size,size,size,size);
  return ctx.createPattern(p,"repeat");
}

async function whiteBackgroundPercent(img: HTMLImageElement){
  const c=document.createElement("canvas"); c.width=img.naturalWidth; c.height=img.naturalHeight;
  const ctx=c.getContext("2d")!; ctx.drawImage(img,0,0);
  const d=ctx.getImageData(0,0,c.width,c.height).data;
  let whiteish=0, tot=c.width*c.height;
  for(let i=0;i<d.length;i+=4){ const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3]; if(a>10&&r>245&&g>245&&b>245) whiteish++; }
  return (whiteish/tot)*100;
}

export default function GangBuilder(){
  const [presetIndex, setPresetIndex] = useState(0);
  const [sheetWIn, setSheetWIn] = useState(PRESETS[0].w);
  const [sheetHIn, setSheetHIn] = useState(PRESETS[0].h);
  const [dpi, setDpi] = useState(DEFAULT_DPI);
  const [zoom, setZoom] = useState(0.18);
  const [gridIn, setGridIn] = useState(1);
  const [snap, setSnap] = useState(true);
  const [bleedIn, setBleedIn] = useState(0.25);
  const [ratePerSqFt, setRatePerSqFt] = useState(parseFloat(process.env.NEXT_PUBLIC_PRICE_PER_SQFT as any) || 6.0);

  const [items, setItems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [allowRotation, setAllowRotation] = useState(true);
  const [utilization, setUtilization] = useState(0);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const sheetPxW = useMemo(()=> IN_TO_PX(sheetWIn, dpi), [sheetWIn, dpi]);
  const sheetPxH = useMemo(()=> IN_TO_PX(sheetHIn, dpi), [sheetHIn, dpi]);
  const viewW = Math.max(400, sheetPxW * zoom);
  const viewH = Math.max(400, sheetPxH * zoom);
  const sqFt = (sheetWIn * sheetHIn) / 144.0;
  const estPrice = (sqFt * ratePerSqFt).toFixed(2);

  const dragRef = useRef<any>(null);
  useEffect(()=>{ const p=PRESETS[presetIndex]; if(p.label!=="Custom"){ setSheetWIn(p.w); setSheetHIn(p.h);} }, [presetIndex]);

  async function guardrailsCheck(img: HTMLImageElement, targetWIn:number){
    const natDpi = img.naturalWidth/targetWIn;
    const warns:string[]=[];
    if(natDpi<300) warns.push(`Low resolution: ~${Math.round(natDpi)} DPI at ${targetWIn}" width (min 300).`);
    try{ const whitePct=await whiteBackgroundPercent(img); if(whitePct>75) warns.push(`White background detected (~${whitePct.toFixed(0)}%). Use transparent PNG.`);}catch{}
    setWarnings(prev=>[...prev, ...warns]);
  }

  function handleDrop(e:React.DragEvent<HTMLDivElement>){
    e.preventDefault(); const fl=e.dataTransfer.files; const next:File[]=[];
    for(let i=0;i<fl.length;i++){ const f=fl[i]; if(f.type.startsWith("image/")) next.push(f); }
    next.forEach((f,idx)=> addItemFromFile(f,idx));
  }

  function handleFileInput(e:React.ChangeEvent<HTMLInputElement>){
    const fl=e.target.files; if(!fl) return;
    const next:File[]=[];
    for(let i=0;i<fl.length;i++){ const f=fl[i]; if(f.type.startsWith("image/")) next.push(f);}
    next.forEach((f,idx)=> addItemFromFile(f,idx));
  }

  function addItemFromFile(file:File, k=0){
    const url=URL.createObjectURL(file); const img=new Image();
    img.onload=async()=>{
      const natW=img.naturalWidth, natH=img.naturalHeight; const targetWIn=4; const targetHIn=targetWIn*(natH/natW);
      await guardrailsCheck(img, targetWIn);
      const xIn=0.5+(k%4)*(targetWIn+0.25); const yIn=0.5+Math.floor(k/4)*(targetHIn+0.25);
      setItems(prev=>[...prev,{ id:crypto.randomUUID(), src:url, natW, natH, xIn, yIn, wIn:targetWIn, hIn:targetHIn, rotation:0, name:file.name }]);
    };
    img.src=url;
  }

  function draw(){
    const canvas=canvasRef.current; if(!canvas) return; const ctx=canvas.getContext("2d")!;
    canvas.width=viewW; canvas.height=viewH;
    ctx.save();
    ctx.fillStyle=checkerPattern(ctx as any) as any; ctx.fillRect(0,0,canvas.width,canvas.height);
    const zx=zoom; const sheetX=20, sheetY=20; const sheetVW=sheetPxW*zx, sheetVH=sheetPxH*zx;
    ctx.fillStyle="rgba(255,255,255,0.92)"; ctx.fillRect(sheetX,sheetY,sheetVW,sheetVH);
    ctx.strokeStyle="#111827"; ctx.lineWidth=2; ctx.strokeRect(sheetX,sheetY,sheetVW,sheetVH);
    const bleedVW=IN_TO_PX(bleedIn,dpi)*zx; ctx.setLineDash([6,6]); ctx.strokeStyle="#ef4444";
    ctx.strokeRect(sheetX+bleedVW,sheetY+bleedVW,sheetVW-2*bleedVW,sheetVH-2*bleedVW); ctx.setLineDash([]);

    if(gridIn>0){
      ctx.strokeStyle="#d1d5db"; ctx.lineWidth=1; const step=IN_TO_PX(gridIn,dpi)*zx;
      for(let gx=sheetX; gx<=sheetX+sheetVW+1; gx+=step){ ctx.beginPath(); ctx.moveTo(gx,sheetY); ctx.lineTo(gx,sheetY+sheetVH); ctx.stroke(); }
      for(let gy=sheetY; gy<=sheetY+sheetVH+1; gy+=step){ ctx.beginPath(); ctx.moveTo(sheetX,gy); ctx.lineTo(sheetX+sheetVW,gy); ctx.stroke(); }
    }

    items.forEach(it=>{
      const img=new Image(); img.src=it.src;
      const x=sheetX+IN_TO_PX(it.xIn,dpi)*zx; const y=sheetY+IN_TO_PX(it.yIn,dpi)*zx;
      const w=IN_TO_PX(it.wIn,dpi)*zx; const h=IN_TO_PX(it.hIn,dpi)*zx;
      ctx.save(); ctx.translate(x+w/2,y+h/2); ctx.rotate(rad(it.rotation));
      ctx.drawImage(img,-w/2,-h/2,w,h);
      if(it.id===selectedId){ ctx.strokeStyle="#3b82f6"; ctx.lineWidth=2; ctx.setLineDash([8,6]); ctx.strokeRect(-w/2,-h/2,w,h); ctx.setLineDash([]); }
      ctx.restore();
    });

    if(showHeatmap){ ctx.fillStyle="rgba(34,197,94,0.08)"; ctx.fillRect(sheetX,sheetY,sheetVW,sheetVH); }

    ctx.fillStyle="#111827"; ctx.font="12px ui-sans-serif";
    ctx.fillText(`${sheetWIn}" × ${sheetHIn}" @ ${dpi} DPI • Util ${(utilization*100).toFixed(0)}%`, 20, 16);
    ctx.restore();
  }
  useEffect(()=>{ draw(); }, [items, zoom, sheetWIn, sheetHIn, dpi, gridIn, bleedIn, selectedId, showHeatmap, utilization]);

  function itemAt(viewX:number, viewY:number){
    const sheetX=20, sheetY=20, zx=zoom; const sx=viewX-sheetX, sy=viewY-sheetY;
    const inX=PX_TO_IN(sx/zx,dpi), inY=PX_TO_IN(sy/zx,dpi);
    for(let i=items.length-1;i>=0;i--){ const it=items[i]; if(inX>=it.xIn&&inX<=it.xIn+it.wIn&&inY>=it.yIn&&inY<=it.yIn+it.hIn) return it; }
    return null;
  }

  function onCanvasPointerDown(e:React.PointerEvent<HTMLCanvasElement>){
    const r=(e.target as HTMLCanvasElement).getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;
    const it=itemAt(x,y);
    if(it){ setSelectedId(it.id); dragRef.current={ id:it.id, startX:x, startY:y, startPos:{ xIn:it.xIn, yIn:it.yIn, wIn:it.wIn, hIn:it.hIn } }; }
    else { setSelectedId(null); }
  }

  function onCanvasPointerMove(e:React.PointerEvent<HTMLCanvasElement>){
    if(!dragRef.current) return;
    const r=(e.target as HTMLCanvasElement).getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;
    const dpxX=(x-dragRef.current.startX)/zoom, dpxY=(y-dragRef.current.startY)/zoom;
    const dInX=PX_TO_IN(dpxX,dpi), dInY=PX_TO_IN(dpxY,dpi);
    setItems(prev=>prev.map(it=>{
      if(it.id!==dragRef.current.id) return it;
      let nx=dragRef.current.startPos.xIn+dInX; let ny=dragRef.current.startPos.yIn+dInY;
      const minX=bleedIn, minY=bleedIn; const maxX=sheetWIn-bleedIn-it.wIn; const maxY=sheetHIn-bleedIn-it.hIn;
      if(snap&&gridIn>0){ nx=Math.round(nx/gridIn)*gridIn; ny=Math.round(ny/gridIn)*gridIn; }
      nx=clamp(nx,minX,Math.max(minX,maxX)); ny=clamp(ny,minY,Math.max(minY,maxY));
      return { ...it, xIn:nx, yIn:ny };
    }));
  }

  function onCanvasPointerUp(){ dragRef.current=null; }
  function removeSelected(){ if(!selectedId) return; setItems(prev=>prev.filter(it=>it.id!==selectedId)); setSelectedId(null); }
  function duplicateSelected(){ const it=items.find(i=>i.id===selectedId); if(!it) return; const copy={ ...it, id:crypto.randomUUID(), xIn:it.xIn+0.25, yIn:it.yIn+0.25 }; setItems(prev=>[...prev, copy]); }
  function scaleSelected(delta:number){ setItems(prev=>prev.map(it=>{ if(it.id!==selectedId) return it; const nw=clamp(it.wIn*(1+delta),0.25,sheetWIn); const nh=nw*(it.natH/it.natW); return { ...it, wIn:nw, hIn:nh }; })); }

  function autoPack(){
    let x=bleedIn,y=bleedIn,rowH=0; const maxW=sheetWIn-bleedIn; const packed=items.map(it=>({...it}));
    for(let i=0;i<packed.length;i++){
      const it=packed[i];
      if(x+it.wIn>maxW){ x=bleedIn; y+=rowH+0.25; rowH=0; }
      it.xIn=snap&&gridIn>0?Math.round(x/gridIn)*gridIn:x;
      it.yIn=snap&&gridIn>0?Math.round(y/gridIn)*gridIn:y;
      rowH=Math.max(rowH,it.hIn); x=it.xIn+it.wIn+0.25;
    }
    setItems(packed); recalcUtil();
  }

  function autoNestPack(){
    const rects = items.map(it=>({ id:it.id, w:it.wIn, h:it.hIn }));
    const { placed, utilization } = autoNest(sheetWIn-bleedIn*2, sheetHIn-bleedIn*2, rects, allowRotation);
    const mapped = items.map(it=>{
      const p = placed.find(x=>x.id===it.id); if(!p) return it;
      return { ...it, xIn: bleedIn + p.x, yIn: bleedIn + p.y, wIn: p.w, hIn: p.h };
    });
    setItems(mapped); setUtilization(utilization);
  }

  function recalcUtil(){
    const usedArea = items.reduce((s,it)=> s + it.wIn*it.hIn, 0);
    setUtilization( usedArea / (sheetWIn*sheetHIn) );
  }

  // Flatten with labels (for RIP PDF)
  async function renderFlattenedPNGBlob(withLabels=false, targetDPI=dpi): Promise<Blob> {
    const expDpi=targetDPI; const expW=IN_TO_PX(sheetWIn,expDpi), expH=IN_TO_PX(sheetHIn,expDpi);
    const c=document.createElement("canvas"); c.width=expW; c.height=expH; const ctx=c.getContext("2d")!;
    ctx.clearRect(0,0,expW,expH); ctx.save();
    for(const it of items){
      const img=new Image(); img.src=it.src; await img.decode();
      const x=IN_TO_PX(it.xIn,expDpi), y=IN_TO_PX(it.yIn,expDpi), w=IN_TO_PX(it.wIn,expDpi), h=IN_TO_PX(it.hIn,expDpi);
      ctx.save(); ctx.translate(x+w/2,y+h/2); ctx.rotate(rad(it.rotation));
      ctx.drawImage(img,-w/2,-h/2,w,h);
      if(withLabels){
        ctx.fillStyle="rgba(0,0,0,0.6)";
        ctx.font = `${Math.max(18, Math.floor(w*0.06))}px Arial`;
        ctx.textAlign="center"; ctx.fillText(`${(it.wIn).toFixed(2)}"×${(it.hIn).toFixed(2)}"`, 0, h/2 - 6);
      }
      ctx.restore();
    }
    ctx.restore();
    return await new Promise((res)=> c.toBlob(b=>res(b as Blob), "image/png"));
  }

  function drawCropMarks(doc:jsPDF, wIn:number, hIn:number){
    const m=0.125; // 1/8" crop marks
    const lines: [number,number,number,number][] = [
      [0,0, m,0],[0,0,0,m], [wIn,0, wIn-m,0],[wIn,0, wIn, m],
      [0,hIn, m,hIn],[0,hIn,0,hIn-m], [wIn,hIn, wIn-m,hIn],[wIn,hIn, wIn, hIn-m]
    ];
    doc.setDrawColor(0); lines.forEach(([x1,y1,x2,y2])=> doc.line(x1,y1,x2,y2));
  }

  async function exportRIPPDF600(){
    const doc=new jsPDF({ unit:"in", format:[sheetWIn, sheetHIn], orientation: sheetHIn>=sheetWIn?"portrait":"landscape"});
    drawCropMarks(doc, sheetWIn, sheetHIn);
    for(const it of items){
      const img=new Image(); img.src=it.src; await img.decode();
      const tmp=document.createElement("canvas");
      const pixW=IN_TO_PX(it.wIn, 600), pixH=IN_TO_PX(it.hIn, 600);
      tmp.width=pixW; tmp.height=pixH; const t=tmp.getContext("2d")!;
      t.clearRect(0,0,pixW,pixH); t.drawImage(img,0,0,pixW,pixH);
      t.fillStyle="rgba(0,0,0,0.5)"; t.fillRect(0,pixH- Math.max(30, Math.floor(pixH*0.08)), pixW, Math.max(30, Math.floor(pixH*0.08)));
      t.fillStyle="#fff"; t.font = `${Math.max(18, Math.floor(pixW*0.04))}px Arial`; t.textAlign="center";
      t.fillText(`${it.name||"image"} • ${it.wIn.toFixed(2)}"×${it.hIn.toFixed(2)}"`, pixW/2, pixH-10);
      const data=tmp.toDataURL("image/png");
      doc.addImage(data, "PNG", it.xIn, it.yIn, it.wIn, it.hIn, undefined, "FAST");
    }
    doc.save(`demi-dtf-gang-${sheetWIn}x${sheetHIn}-RIP-600dpi.pdf`);
  }

  async function uploadToS3(filename:string, contentType:string, blob:Blob){
    const presign=await fetch("/api/upload",{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ filename, contentType }) });
    const { url, key } = await presign.json();
    await fetch(url,{ method:"PUT", headers:{"Content-Type":contentType}, body: blob });
    return key as string;
  }

  async function exportPNG(){
    const blob=await renderFlattenedPNGBlob(false, dpi);
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download=`demi-dtf-gang-${sheetWIn}x${sheetHIn}@${dpi}dpi.png`; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF(){
    const doc=new jsPDF({ unit:"in", format:[sheetWIn, sheetHIn], orientation: sheetHIn>=sheetWIn?"portrait":"landscape"});
    for(const it of items){
      const img=new Image(); img.src=it.src; await img.decode();
      const tmp=document.createElement("canvas");
      const pixW=IN_TO_PX(it.wIn,dpi), pixH=IN_TO_PX(it.hIn,dpi);
      tmp.width=pixW; tmp.height=pixH; const t=tmp.getContext("2d")!;
      t.clearRect(0,0,pixW,pixH); t.drawImage(img,0,0,pixW,pixH);
      const data=tmp.toDataURL("image/png");
      doc.addImage(data, "PNG", it.xIn, it.yIn, it.wIn, it.hIn, undefined, "FAST");
    }
    doc.save(`demi-dtf-gang-${sheetWIn}x${sheetHIn}.pdf`);
  }

  // === Clean createCheckout with dev no-S3 bypass ===
  async function createCheckout(){
    const devNoS3 = process.env.NEXT_PUBLIC_DEV_NO_S3 === "1";
    const blob = await renderFlattenedPNGBlob(false, dpi);
    let s3Key = "local-dev";
    if (!devNoS3) {
      s3Key = await uploadToS3(`gang-${Date.now()}.png`, "image/png", blob);
    }
    const res = await fetch("/api/checkout", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ sheetWIn, sheetHIn, dpi, sqFt, unitPrice: ratePerSqFt, s3Key })
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  return (
    <div className="w-full h-full p-4 grid grid-cols-12 gap-4">
      <div className="col-span-3 space-y-4">
        <div className="p-4 rounded-2xl border bg-white shadow-sm space-y-3">
          <h2 className="text-xl font-semibold">DTF Sheet</h2>
          <label className="block text-sm">Preset</label>
          <select className="w-full border rounded-xl px-3 py-2" value={presetIndex} onChange={e=>setPresetIndex(parseInt(e.target.value))}>
            {PRESETS.map((p,i)=>(<option key={i} value={i}>{p.label}</option>))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-xs text-gray-600">Width (in)</label><input type="number" step="0.1" value={sheetWIn} onChange={e=>setSheetWIn(parseFloat(e.target.value)||0)} className="w-full border rounded-xl px-2 py-1"/></div>
            <div><label className="block text-xs text-gray-600">Height (in)</label><input type="number" step="0.1" value={sheetHIn} onChange={e=>setSheetHIn(parseFloat(e.target.value)||0)} className="w-full border rounded-xl px-2 py-1"/></div>
            <div><label className="block text-xs text-gray-600">DPI</label><input type="number" step="1" value={dpi} onChange={e=>setDpi(parseInt(e.target.value)||300)} className="w-full border rounded-xl px-2 py-1"/></div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div><label className="block text-xs text-gray-600">Grid (in)</label><input type="number" step="0.25" value={gridIn} onChange={e=>setGridIn(parseFloat(e.target.value)||0)} className="w-full border rounded-xl px-2 py-1"/></div>
            <div><label className="block text-xs text-gray-600">Bleed (in)</label><input type="number" step="0.1" value={bleedIn} onChange={e=>setBleedIn(parseFloat(e.target.value)||0)} className="w-full border rounded-xl px-2 py-1"/></div>
            <div className="flex items-end gap-2"><input id="snap" type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/><label htmlFor="snap" className="text-sm">Snap</label></div>
          </div>
          <div className="flex items-center gap-2"><label className="text-xs text-gray-600">Zoom</label><input type="range" min={0.05} max={0.4} step={0.01} value={zoom} onChange={e=>setZoom(parseFloat(e.target.value))} className="w-full"/><div className="w-12 text-right text-sm">{Math.round(zoom*100)}%</div></div>
        </div>

        <div className="p-4 rounded-2xl border bg-white shadow-sm space-y-3">
          <h2 className="text-xl font-semibold">Upload</h2>
          <label className="block text-sm text-gray-600">PNG/SVG/JPG. Transparent PNG recommended.</label>
          <input type="file" accept="image/*" multiple onChange={handleFileInput} className="w-full"/>
          <div className="text-xs text-gray-600">Drag & drop onto the canvas, too.</div>
          <div className="max-h-40 overflow-auto border rounded-xl p-2 space-y-1">
            {items.map(it=> (
              <div key={it.id} className={`text-sm flex items-center justify-between px-2 py-1 rounded ${selectedId===it.id?"bg-blue-50":""}`}>
                <span className="truncate" title={it.name}>{it.name || "image"}</span>
                <div className="text-xs text-gray-500">{it.wIn.toFixed(2)} × {it.hIn.toFixed(2)} in</div>
              </div>
            ))}
          </div>
          {warnings.length>0 && (<div className="text-xs text-red-600 space-y-1 pt-2">{warnings.map((w,i)=><div key={i}>• {w}</div>)}</div>)}
        </div>

        <div className="p-4 rounded-2xl border bg-white shadow-sm space-y-3">
          <h2 className="text-xl font-semibold">Estimate</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600">Area</div><div>{sqFt.toFixed(2)} sq ft</div>
            <div className="text-gray-600">Rate</div><div><input type="number" step="0.5" value={ratePerSqFt} onChange={e=>setRatePerSqFt(parseFloat((e.target as any).value)||0)} className="w-24 border rounded px-2 py-0.5"/> $/sq ft</div>
            <div className="text-gray-600">Est. Price</div><div className="font-semibold">${estPrice}</div>
          </div>
          <div className="text-xs text-gray-500">Front-end estimate; final charge via checkout.</div>
          <ToolbarButton onClick={createCheckout} title="Pay & place order">Checkout</ToolbarButton>
        </div>

        <div className="p-4 rounded-2xl border bg-white shadow-sm space-y-2">
          <h2 className="text-xl font-semibold">Layout</h2>
          <div className="flex gap-2 flex-wrap">
            <ToolbarButton onClick={autoPack} title="Simple pack">Auto Pack</ToolbarButton>
            <ToolbarButton onClick={autoNestPack} title="Rotation-aware nest">Auto-Nest</ToolbarButton>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowRotation} onChange={e=>setAllowRotation(e.target.checked)}/> Allow 90° rotation</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showHeatmap} onChange={e=>setShowHeatmap(e.target.checked)}/> Heatmap overlay</label>
          </div>
          <div className="text-xs text-gray-600">Utilization: <b>{(utilization*100).toFixed(0)}%</b></div>
        </div>

        <div className="p-4 rounded-2xl border bg-white shadow-sm space-y-2">
          <h2 className="text-xl font-semibold">Export</h2>
          <div className="flex gap-2 flex-wrap">
            <ToolbarButton onClick={exportPNG} title="Transparent PNG">PNG</ToolbarButton>
            <ToolbarButton onClick={exportPDF} title="Print-ready PDF">PDF</ToolbarButton>
            <ToolbarButton onClick={exportRIPPDF600} title="Crop marks + 600 DPI + labels">RIP PDF 600 DPI</ToolbarButton>
          </div>
        </div>
      </div>

      <div className="col-span-9">
        <div onDragOver={e=>e.preventDefault()} onDrop={handleDrop} className="w-full h-[80vh] rounded-2xl border bg-white shadow-sm flex items-center justify-center overflow-auto">
          <canvas ref={canvasRef} className="touch-none cursor-move" width={viewW} height={viewH} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp}/>
        </div>
        <div className="text-xs text-gray-500 mt-2">Transparent PNGs; design at 300–600 DPI. RIP handles CMYK.</div>
      </div>
    </div>
  );
}
