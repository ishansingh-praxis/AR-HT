import { toFrame, fromFrame } from '../src/utils/frame.ts';
import { hangOnWall, wallNormal } from '../src/utils/wall.ts';
const close=(x:number,y:number,m:string)=>{ if(Math.abs(x-y)>1e-6) throw new Error(`${m}: ${x} vs ${y}`) };
// Session 1: A at (1,0,2), B at (3,0,2.5). Sofa 1.2 m along from A, 0.7 across, turned 30 deg.
const A:any=[1,0,2], B:any=[3,0,2.5];
const world={position:[1.9,0,2.9] as any, rotationY:30};
const f=toFrame(A,B,world);
// Session 2: the AR world origin moved: rotate by 40deg (Viro convention) about y and shift. Re-tap the same physical corners.
const th=40*Math.PI/180, rot=(p:any)=>[p[0]*Math.cos(th)+p[2]*Math.sin(th)+5,p[1],-p[0]*Math.sin(th)+p[2]*Math.cos(th)-3];
const A2=rot(A),B2=rot(B), want=rot(world.position);
const got=fromFrame(A2,B2,f);
close(got.position[0],want[0],'x');close(got.position[2],want[2],'z');close(got.position[1],0,'y');
close(((got.rotationY-(30+40))%360+360)%360,0,'rotation follows the world turn');
console.log('frame: placement survives a moved/rotated AR session (pos + rotation)');
// Re-tapping 3 cm off moves the result by about 3 cm
const got2=fromFrame([A2[0]+0.03,0,A2[2]],B2,f); console.log('3cm tap error ->',Math.hypot(got2.position[0]-want[0],got2.position[2]-want[2]).toFixed(3),'m');
// Wall along +x from (0,0,0) to (4,0,0); room side flips
const w:any={a:[0,0,0],b:[4,0,0],flip:false};
const n=wallNormal(w); console.log('normal',n.map(v=>+v.toFixed(2)),'flipped',wallNormal({...w,flip:true}).map(v=>+v.toFixed(2)));
const h=hangOnWall(w,[1.5,0,2.0],{w:60,h:40,d:3});
close(h.position[0],1.5,'slides to hit x');close(h.position[1],1.25,'bottom=1.45-0.2');
close(Math.hypot(h.position[0]-1.5,h.position[2]),0.02,'stand-off');
console.log('hang',h.position.map(v=>+v.toFixed(3)),'rotY',+h.rotationY.toFixed(1));
const e=hangOnWall(w,[-3,0,1],{w:60,h:40,d:3}); close(e.position[0],0.3,'clamped to wall start');
const big=hangOnWall(w,[2,0,0],{w:500,h:40,d:3}); close(big.position[0],2,'wider than wall -> centred');
// Cloud-anchor style: origin + yaw come from an anchor pose instead of two taps.
import { toFrameYaw, fromFrameYaw } from '../src/utils/frame.ts';
const anchor1:any=[2,0.1,1], yaw1=25;
const item={position:[3.2,0,2.4] as any, rotationY:-70};
const fy=toFrameYaw(anchor1,yaw1,item);
// New session: world turned by 40 deg and shifted; the same physical anchor is resolved with a new pose.
const anchor2=rot(anchor1), yaw2=yaw1+40, wantItem=rot(item.position);
const gy=fromFrameYaw(anchor2,yaw2,fy);
close(gy.position[0],wantItem[0],'anchor x');close(gy.position[2],wantItem[2],'anchor z');close(gy.position[1],0,'anchor y');
close(((gy.rotationY-(item.rotationY+40))%360+360)%360,0,'anchor rotation');
console.log('wall + frame + anchor-pose tests passed');
