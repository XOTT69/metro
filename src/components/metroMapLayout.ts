import { lines, stationById, stations } from '../data/metro'
import type { LineId, Station } from '../types'

export interface MapView { x:number; y:number; width:number; height:number }
export interface Point { x:number; y:number }
export interface CanvasSize { width:number; height:number }
export interface LabelPlacement { dx:number; dy:number; anchor:'start'|'middle'|'end' }
interface ScreenRect { left:number; top:number; right:number; bottom:number }
interface LabelCandidate { key:string; baseX:number; baseY:number; lines:string[]; priority:number; placements:LabelPlacement[]; className:string; plate?:boolean }
export interface PlacedLabel extends LabelCandidate { placement:LabelPlacement; x:number; y:number; rect:ScreenRect }

export const FULL_VIEW:MapView={x:28,y:14,width:904,height:678}
export const MAP_BOUNDS={x:0,y:0,width:960,height:710}
export const MAP_ASPECT=FULL_VIEW.width/FULL_VIEW.height
export const MIN_VIEW_WIDTH=285
export const MAX_VIEW_WIDTH=1080
export const lineIds:LineId[]=['M1','M2','M3']

const LABEL_OVERRIDES:Record<string,LabelPlacement>={
  akademmistechko:{dx:8,dy:20,anchor:'start'},lisova:{dx:-8,dy:20,anchor:'end'},
  'heroiv-dnipra':{dx:-12,dy:3,anchor:'end'},teremky:{dx:-12,dy:4,anchor:'end'},
  syrets:{dx:0,dy:-15,anchor:'middle'},'chervonyi-khutir':{dx:-10,dy:18,anchor:'end'},
  teatralna:{dx:-17,dy:-18,anchor:'end'},'zoloti-vorota':{dx:-17,dy:22,anchor:'end'},
  khreshchatyk:{dx:18,dy:-17,anchor:'start'},'maidan-nezalezhnosti':{dx:18,dy:22,anchor:'start'},
  'ploshcha-ukrainskykh-heroiv':{dx:-17,dy:24,anchor:'end'},'palats-sportu':{dx:18,dy:23,anchor:'start'},
  universytet:{dx:-9,dy:18,anchor:'end'},arsenalna:{dx:0,dy:18,anchor:'middle'},
  dnipro:{dx:0,dy:18,anchor:'middle'},vokzalna:{dx:-9,dy:18,anchor:'end'},vydubychi:{dx:12,dy:17,anchor:'start'},
}
const MAJOR_STATIONS=new Set(['vokzalna','universytet','arsenalna','dnipro','livoberezhna','pochaina','demiivska','vydubychi'])
const terminalIds=new Set(Object.values(lines).flatMap(line=>[line.stationIds[0],line.stationIds.at(-1)!]))
const TRANSFER_HUBS:Array<{ids:[string,string];placements:LabelPlacement[]}>= [
  {ids:['teatralna','zoloti-vorota'],placements:[{dx:-19,dy:-30,anchor:'end'},{dx:-19,dy:-43,anchor:'end'}]},
  {ids:['khreshchatyk','maidan-nezalezhnosti'],placements:[{dx:19,dy:-30,anchor:'start'},{dx:19,dy:-45,anchor:'start'}]},
  {ids:['ploshcha-ukrainskykh-heroiv','palats-sportu'],placements:[{dx:-19,dy:34,anchor:'end'},{dx:19,dy:39,anchor:'start'},{dx:-19,dy:58,anchor:'end'},{dx:19,dy:-20,anchor:'start'}]},
]

const labelPosition=(id:string,line:LineId):LabelPlacement=>LABEL_OVERRIDES[id]??(line==='M1'?{dx:0,dy:18,anchor:'middle'}:line==='M2'?{dx:-12,dy:4,anchor:'end'}:{dx:12,dy:-10,anchor:'start'})
const alternates=(p:LabelPlacement):LabelPlacement[]=>[p,{dx:-p.dx,dy:p.dy,anchor:p.anchor==='start'?'end':p.anchor==='end'?'start':'middle'},{dx:p.anchor==='middle'?0:p.dx,dy:p.dy>0?-16:20,anchor:p.anchor}]
const constrainAxis=(value:number,size:number,start:number,bounds:number)=>{const overscroll=Math.min(50,size*.075),min=start-overscroll,max=start+bounds-size+overscroll;return min>max?start+(bounds-size)/2:Math.min(max,Math.max(min,value))}
export const clampView=(candidate:MapView):MapView=>{const width=Math.min(MAX_VIEW_WIDTH,Math.max(MIN_VIEW_WIDTH,candidate.width)),height=width/MAP_ASPECT;return{x:constrainAxis(candidate.x,width,MAP_BOUNDS.x,MAP_BOUNDS.width),y:constrainAxis(candidate.y,height,MAP_BOUNDS.y,MAP_BOUNDS.height),width,height}}
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
export const midpoint=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2})
export const roundedPath=(points:Point[],radius=16)=>{if(!points.length)return'';if(points.length===1)return`M ${points[0].x} ${points[0].y}`;if(points.length===2)return`M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;let path=`M ${points[0].x} ${points[0].y}`;for(let i=1;i<points.length-1;i++){const prev=points[i-1],cur=points[i],next=points[i+1],incoming=distance(prev,cur),outgoing=distance(cur,next),corner=Math.min(radius,incoming/2,outgoing/2),before={x:cur.x+((prev.x-cur.x)/incoming)*corner,y:cur.y+((prev.y-cur.y)/incoming)*corner},after={x:cur.x+((next.x-cur.x)/outgoing)*corner,y:cur.y+((next.y-cur.y)/outgoing)*corner};path+=` L ${before.x} ${before.y} Q ${cur.x} ${cur.y} ${after.x} ${after.y}`}const last=points.at(-1)!;return`${path} L ${last.x} ${last.y}`}
export const viewForStations=(ids:string[],padding=105):MapView|null=>{const selected=ids.map(id=>stationById.get(id)).filter(Boolean) as Station[];if(!selected.length)return null;const minX=Math.min(...selected.map(s=>s.mapX)),maxX=Math.max(...selected.map(s=>s.mapX)),minY=Math.min(...selected.map(s=>s.mapY)),maxY=Math.max(...selected.map(s=>s.mapY)),contentWidth=Math.max(150,maxX-minX+padding*2),contentHeight=Math.max(150,maxY-minY+padding*2),width=Math.max(contentWidth,contentHeight*MAP_ASPECT),height=width/MAP_ASPECT;return clampView({x:(minX+maxX)/2-width/2,y:(minY+maxY)/2-height/2,width,height})}
const wrapLabel=(text:string,maxChars:number)=>{if(text.length<=maxChars||!text.includes(' '))return[text];const words=text.split(' ');let best:[string,string]|null=null,diff=Infinity;for(let i=1;i<words.length;i++){const a=words.slice(0,i).join(' '),b=words.slice(i).join(' '),longest=Math.max(a.length,b.length),next=Math.abs(a.length-b.length);if(longest<=maxChars+5&&next<diff){best=[a,b];diff=next}}return best??[text]}
const overlaps=(a:ScreenRect,b:ScreenRect,gap=5)=>a.left<b.right+gap&&a.right+gap>b.left&&a.top<b.bottom+gap&&a.bottom+gap>b.top

export interface LabelLayoutInput { activeStationId?:string; routeSet:Set<string>; routeEndpoints:Set<string>; focusedLine:LineId|'all'; zoomLevel:number; view:MapView; canvasSize:CanvasSize; stationName:(station:Station)=>string }
export interface LabelLayoutResult { placedLabels:PlacedLabel[]; renderScale:number; mapPixels:(pixels:number)=>number; compactCanvas:boolean; isOverview:boolean; labelFontPx:number; labelLineHeightPx:number; labelStrokePx:number }
export const buildLabelLayout=(input:LabelLayoutInput):LabelLayoutResult=>{
  const {activeStationId,routeSet,routeEndpoints,focusedLine,zoomLevel,view,canvasSize,stationName}=input
  const renderScale=Math.max(.1,Math.min(canvasSize.width/view.width,canvasSize.height/view.height)),mapPixels=(px:number)=>px/renderScale,compactCanvas=canvasSize.width<620,isOverview=focusedLine==='all'&&zoomLevel<1.17,useHubs=focusedLine==='all'&&zoomLevel<1.42,labelFontPx=compactCanvas?(isOverview?10.2:11.2):12,labelLineHeightPx=labelFontPx*1.16,labelStrokePx=isOverview?3.2:3.8,candidates:LabelCandidate[]=[]
  stations.forEach(station=>{const active=activeStationId===station.id,onRoute=routeSet.has(station.id),endpoint=routeEndpoints.has(station.id),terminal=terminalIds.has(station.id),transfer=Boolean(station.transferTo),major=MAJOR_STATIONS.has(station.id),lineFocused=focusedLine===station.line,index=lines[station.line].stationIds.indexOf(station.id);let visible=active||endpoint||terminal;if(!isOverview)visible=visible||(onRoute&&zoomLevel>=1.12)||(!useHubs&&transfer)||(major&&zoomLevel>=1.1)||lineFocused||(zoomLevel>=1.32&&index%2===0)||zoomLevel>=1.68;if(!visible||(useHubs&&transfer&&!active&&!endpoint))return;const primary=labelPosition(station.id,station.line),priority=active?1000:endpoint?960:onRoute?900:terminal?840:transfer?780:lineFocused?700:major?650:500;candidates.push({key:`station-${station.id}`,baseX:station.mapX,baseY:station.mapY,lines:wrapLabel(stationName(station),compactCanvas?(terminal?17:20):24),priority,placements:station.id==='chervonyi-khutir'&&compactCanvas?[{dx:-72,dy:-16,anchor:'end'},{dx:-72,dy:10,anchor:'end'},...alternates(primary)]:alternates(primary),className:`station-label ${active?'is-active-label':''} ${onRoute?'is-route-label':''}`,plate:active||endpoint})})
  if(useHubs)TRANSFER_HUBS.forEach(({ids,placements})=>{const a=stationById.get(ids[0])!,b=stationById.get(ids[1])!,center=midpoint({x:a.mapX,y:a.mapY},{x:b.mapX,y:b.mapY});candidates.push({key:`hub-${ids.join('-')}`,baseX:center.x,baseY:center.y,lines:[stationName(a),stationName(b)],priority:810,placements,className:'station-label transfer-hub-label'})})
  const contentWidth=view.width*renderScale,contentHeight=view.height*renderScale,offsetX=(canvasSize.width-contentWidth)/2,offsetY=(canvasSize.height-contentHeight)/2,occupied:ScreenRect[]=[],placedLabels:PlacedLabel[]=[]
  if(compactCanvas){occupied.push({left:canvasSize.width-68,top:Math.max(0,canvasSize.height-245),right:canvasSize.width,bottom:canvasSize.height});if(canvasSize.width>390)occupied.push({left:0,top:canvasSize.height-56,right:Math.min(210,canvasSize.width*.58),bottom:canvasSize.height})}
  candidates.sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key)).forEach(candidate=>{for(const placement of candidate.placements){const screenX=(candidate.baseX-view.x)*renderScale+offsetX+placement.dx,lineOffset=((candidate.lines.length-1)*labelLineHeightPx)/2,screenY=(candidate.baseY-view.y)*renderScale+offsetY+placement.dy-lineOffset,longest=Math.max(...candidate.lines.map(line=>Array.from(line).length)),width=longest*labelFontPx*.61+10,height=candidate.lines.length*labelLineHeightPx+5,left=placement.anchor==='start'?screenX-3:placement.anchor==='end'?screenX-width+3:screenX-width/2,rect={left,top:screenY-labelFontPx*.9-2,right:left+width,bottom:screenY-labelFontPx*.9-2+height},inside=rect.left>=3&&rect.right<=canvasSize.width-3&&rect.top>=3&&rect.bottom<=canvasSize.height-3;if(!inside||occupied.some(box=>overlaps(rect,box)))continue;occupied.push(rect);placedLabels.push({...candidate,placement,x:candidate.baseX+mapPixels(placement.dx),y:candidate.baseY+mapPixels(placement.dy-lineOffset),rect});break}})
  return{placedLabels,renderScale,mapPixels,compactCanvas,isOverview,labelFontPx,labelLineHeightPx,labelStrokePx}
}
