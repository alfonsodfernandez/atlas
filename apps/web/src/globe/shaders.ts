export const earthVertex = `#version 300 es
precision highp float;
layout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec2 aU;
uniform mat4 uMvp;uniform vec3 uEye;
out highp vec2 vU;out highp vec3 vN;out mediump float vF;
void main(){vU=aU;vN=aN;vF=max(dot(aN,normalize(uEye-aP)),0.);gl_Position=uMvp*vec4(aP,1.);}`;

export const earthFragment = `#version 300 es
precision highp float;
in highp vec2 vU;in highp vec3 vN;in mediump float vF;
uniform sampler2D uMap;uniform bool uBorders;uniform bool uDemo;uniform int uHover;
out vec4 c;
void main(){
vec3 m=texture(uMap,vU).rgb;
float fm=fwidth(m.r),la=clamp(fm*.78,.004,.14),l=smoothstep(.5-la,.5+la,m.r),co=(1.-smoothstep(la*.25,la*1.35,abs(m.r-.5)))*smoothstep(.001,.012,fm);
float fd=fwidth(m.b),da=clamp(fd*.78,.004,.14),d=uDemo?min(l,smoothstep(.5-da,.5+da,m.b)):0.;
float de=uDemo&&uBorders?(1.-smoothstep(da*.2,da*1.2,abs(m.b-.5)))*smoothstep(.001,.012,fd)*l:0.;
vec3 n=normalize(vN);
float tp=clamp(length(fwidth(n))*float(textureSize(uMap,0).x)*.159155,.015,4.);
float gv=0.,gr=1.;
if(uBorders&&l>.01&&tp<1.1&&m.g>.01){
vec2 t=.65/vec2(textureSize(uMap,0));
float g0=texture(uMap,vU+t).g,g1=texture(uMap,vU+vec2(-t.x,t.y)).g,g2=texture(uMap,vU+vec2(t.x,-t.y)).g,g3=texture(uMap,vU-t).g;
gv=(g0+g1+g2+g3)*.25;gr=length(vec2(g0+g2-g1-g3,g0+g1-g2-g3));}
float fg=max(fwidth(gr),.008),zm=(1.-smoothstep(fg*.45,fg*1.85,gr))*smoothstep(.12,.3,gv),ov=smoothstep(.22,.5,m.g);
float b=uBorders?max(de,mix(zm,ov,smoothstep(.55,1.1,tp))*l*(uDemo?smoothstep(.06,.24,abs(m.b-.5)):1.)):0.;
float lo=atan(-n.z,n.x),lt=asin(clamp(n.y,-1.,1.)),sl=sin(lo*6.),st=sin(lt*6.);
float ml=1.-smoothstep(0.,max(fwidth(sl)*1.15,.001),abs(sl)),pl=1.-smoothstep(0.,max(fwidth(st)*1.15,.001),abs(st));
float g=max(ml*smoothstep(1.38,1.18,abs(lt)),pl)*(1.-l)*.16;
float h=uHover==1&&lo>-.35&&lo<.12&&lt>.46&&lt<.78||uHover==2&&lo>-2.1&&lo<-1.48&&lt>.23&&lt<.58||uHover==3&&lo>2.12&&lo<2.7&&lt>.41&&lt<.82?1.:0.;
vec3 o=mix(vec3(.845,.872,.87),vec3(.54,.59,.58),g);
o=mix(o,vec3(.928,.91,.868),l);
o=mix(o,mix(vec3(.773,.373,.243),vec3(.675,.285,.168),h),d);
o=mix(o,vec3(.24,.27,.25),b*.5);
o=mix(o,vec3(.2,.23,.21),co*.62);
c=vec4(mix(o*(.88+.12*sqrt(vF)),vec3(.22,.25,.23),(1.-smoothstep(0.,.12,vF))*.2),1.);}`;
