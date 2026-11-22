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
float da=clamp(fwidth(m.b)*.78,.004,.14),d=uDemo?min(l,smoothstep(.5-da,.5+da,m.b)):0.;
float ba=clamp(fwidth(m.g)*.85,.006,.18),bt=mix(.86,.48,clamp(ba*5.,0.,1.)),b=uBorders?smoothstep(bt-ba,bt+ba,m.g)*l:0.;
vec3 n=normalize(vN);float lo=atan(-n.z,n.x),lt=asin(clamp(n.y,-1.,1.));
float sl=sin(lo*6.),st=sin(lt*6.);
float ml=1.-smoothstep(0.,max(fwidth(sl)*1.15,.001),abs(sl)),pl=1.-smoothstep(0.,max(fwidth(st)*1.15,.001),abs(st));
float g=max(ml*smoothstep(1.38,1.18,abs(lt)),pl)*(1.-l)*.16;
float h=0.;
if(uHover==1&&lo>-.35&&lo<.12&&lt>.46&&lt<.78)h=1.;
else if(uHover==2&&lo>-2.1&&lo<-1.48&&lt>.23&&lt<.58)h=1.;
else if(uHover==3&&lo>2.12&&lo<2.7&&lt>.41&&lt<.82)h=1.;
vec3 o=mix(vec3(.845,.872,.87),vec3(.54,.59,.58),g);
o=mix(o,vec3(.928,.91,.868),l);
o=mix(o,mix(vec3(.773,.373,.243),vec3(.675,.285,.168),h),d);
o=mix(o,mix(vec3(.46,.49,.46),vec3(.2,.23,.21),co),max(co*.62,b*.44));
c=vec4(mix(o*(.88+.12*sqrt(vF)),vec3(.22,.25,.23),(1.-smoothstep(0.,.12,vF))*.2),1.);}`;
