'use strict';
/* ANGLER! WebGL world renderer — original low-poly island scene. */
const World3D=(()=>{
  let renderer,scene,camera,water,boat,walker,sun,ready=false;
  const islandGroups=[];
  const colors={tropical:['#f5dfa0','#4daa62','#286f42'],volcanic:['#4d342c','#4a4143','#29272c'],desert:['#efd9a0','#d4af62','#a27b39'],swamp:['#6d7f55','#385a38','#1f3924'],twilight:['#65508f','#55428c','#2c2350'],rock:['#a5a9a9','#777b7d','#4a5054']};
  const hex=s=>new THREE.Color(s);
  const mat=(color,rough=.8)=>new THREE.MeshStandardMaterial({color:hex(color),roughness:rough,metalness:0});
  function addMesh(group,geo,material,x,y,z,rot=0){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.rotation.y=rot;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
  function tree(group,x,z,scale,theme){
    if(theme==='volcanic'){ addMesh(group,new THREE.ConeGeometry(10*scale,28*scale,5),mat('#343039'),x,34*scale,z); return; }
    if(theme==='twilight'){ const c=addMesh(group,new THREE.ConeGeometry(6*scale,26*scale,5),mat('#9d74e5',.35),x,34*scale,z); c.material.emissive=hex('#33235c');return; }
    if(theme==='desert'){ addMesh(group,new THREE.CylinderGeometry(3*scale,3*scale,28*scale,7),mat('#548640'),x,26*scale,z); return; }
    const trunk=addMesh(group,new THREE.CylinderGeometry(2.5*scale,3.5*scale,25*scale,6),mat(theme==='swamp'?'#3c3023':'#84522c'),x,26*scale,z);
    trunk.rotation.z=.12;
    const leaf=mat(theme==='swamp'?'#244a32':'#2e883d');
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const l=addMesh(group,new THREE.ConeGeometry(8*scale,22*scale,5),leaf,x+Math.cos(a)*6*scale,45*scale,z+Math.sin(a)*6*scale,a);l.rotation.z=Math.PI/2.9;}
  }
  function island(isl,i){
    const group=new THREE.Group(), pal=colors[isl.theme]||colors.tropical, r=isl.r*.74;
    const cliff=addMesh(group,new THREE.CylinderGeometry(r,r*1.05,78,15),mat(pal[2]),isl.x,39,isl.y);
    cliff.material.flatShading=true;
    const beach=addMesh(group,new THREE.CylinderGeometry(r*.96,r*.97,13,15),mat(pal[0]),isl.x,85,isl.y);beach.material.flatShading=true;
    const grass=addMesh(group,new THREE.CylinderGeometry(r*.67,r*.72,20,15),mat(pal[1]),isl.x,100,isl.y);grass.material.flatShading=true;
    const hill=addMesh(group,new THREE.ConeGeometry(r*.26,66,11),mat(pal[2]),isl.x-r*.07,140,isl.y-r*.08);hill.material.flatShading=true;
    const rng=mulberry(i*1777+31);
    for(let n=0;n<(isl.r>200?13:4);n++){const a=rng()*Math.PI*2,rr=r*(.12+rng()*.48);tree(group,isl.x+Math.cos(a)*rr,isl.y+Math.sin(a)*rr,.75+rng()*.55,isl.theme);}
    scene.add(group);islandGroups.push(group);
  }
  function makeBoat(){
    boat=new THREE.Group();
    const hull=addMesh(boat,new THREE.BoxGeometry(23,7,48),mat('#9f5b2a'),0,8,0);hull.scale.set(1,1,.9);
    addMesh(boat,new THREE.BoxGeometry(17,5,23),mat('#e9e7de'),0,13,-2);
    const mast=addMesh(boat,new THREE.CylinderGeometry(1,1,36,7),mat('#6f401f'),0,29,4);
    const sail=addMesh(boat,new THREE.PlaneGeometry(23,22),new THREE.MeshStandardMaterial({color:hex('#f6f0dc'),side:THREE.DoubleSide,roughness:.9}),7,35,4);sail.rotation.y=Math.PI/2;
    boat.add(new THREE.PointLight('#8fdfff',.55,120));scene.add(boat);
  }
  function makeWalker(){
    walker=new THREE.Group();
    addMesh(walker,new THREE.CylinderGeometry(7,8,22,8),mat('#2e9caf'),0,22,0);
    addMesh(walker,new THREE.SphereGeometry(7,12,10),mat('#d89b73'),0,40,0);
    addMesh(walker,new THREE.CylinderGeometry(3,3,16,6),mat('#1b3856'),-4,8,0);addMesh(walker,new THREE.CylinderGeometry(3,3,16,6),mat('#1b3856'),4,8,0);
    walker.visible=false;scene.add(walker);
  }
  function init(){
    if(ready||!window.THREE) return; const canvas=document.getElementById('world3d'); if(!canvas) return;
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
    scene=new THREE.Scene();scene.background=hex('#78c5e7');scene.fog=new THREE.FogExp2('#78c5e7',.00022);
    camera=new THREE.PerspectiveCamera(47,1,.1,9000);
    scene.add(new THREE.HemisphereLight('#b9eeff','#254332',2.1));sun=new THREE.DirectionalLight('#fff1c7',3.1);sun.position.set(-700,1100,-500);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
    const waterMat=new THREE.ShaderMaterial({transparent:false,uniforms:{time:{value:0}},vertexShader:'uniform float time; varying vec3 vP; void main(){vec3 p=position; p.y=sin(p.x*.012+time*.7)*2.2+cos(p.z*.016+time*.5)*1.6; vP=p; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',fragmentShader:'varying vec3 vP; void main(){float w=sin(vP.x*.035+vP.z*.025)*.5+.5; vec3 deep=vec3(.018,.16,.27); vec3 shallow=vec3(.045,.39,.57); gl_FragColor=vec4(mix(deep,shallow,w),1.0);}' });
    water=new THREE.Mesh(new THREE.PlaneGeometry(7200,7200,72,72),waterMat);water.rotation.x=-Math.PI/2;water.receiveShadow=true;scene.add(water);
    ISLANDS.forEach(island);makeBoat();makeWalker();ready=true;resize();requestAnimationFrame(render);
  }
  function resize(){if(!ready)return;const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function render(t){requestAnimationFrame(render);if(!ready)return;water.material.uniforms.time.value=t*.001;const actor=G.player&&G.player.onFoot?G.player:G.boat;if(actor){const tx=actor.x,tz=actor.y;camera.position.lerp(new THREE.Vector3(tx+560,720,tz+670),.08);camera.lookAt(tx,35,tz);boat.position.set(G.boat.x,10,G.boat.y);boat.rotation.y=-G.boat.head;const s=G.boat.boost>0?1.08:1;boat.scale.lerp(new THREE.Vector3(s,s,s),.08);walker.visible=!!G.player.onFoot;if(walker.visible){walker.position.set(G.player.x,112,G.player.y);walker.rotation.y=-G.player.head;}}const night=G.state&&G.state.time==='Night';scene.fog.color.set(night?'#101632':'#78c5e7');sun.intensity=night?.35:3.1;renderer.render(scene,camera);}
  window.addEventListener('resize',resize);setTimeout(init,0);return {get active(){return ready;},init};
})();
window.World3D=World3D;
