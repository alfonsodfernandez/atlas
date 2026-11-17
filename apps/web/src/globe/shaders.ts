export const earthVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
uniform mat4 uMvp;
out vec3 vPosition;
out vec3 vNormal;
out vec2 vUv;
void main(){vPosition=aPosition;vNormal=aNormal;vUv=aUv;gl_Position=uMvp*vec4(aPosition,1.0);}`;

export const earthFragment = `#version 300 es
precision highp float;
in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;
uniform sampler2D uEarth;
uniform vec3 uSun;
uniform vec3 uEye;
uniform float uLighting;
uniform bool uGrid;
out vec4 color;
void main(){
 vec3 n=normalize(vNormal);
 float daylight=max(dot(n,uSun),0.0);
 float light=mix(1.0,0.24+0.76*sqrt(daylight),uLighting);
 vec3 land=texture(uEarth,vUv).rgb*light;
 float edge=1.0-max(dot(n,normalize(uEye-vPosition)),0.0);
 float rim=edge*edge*edge;
 if(uGrid){
   vec2 axes=vUv*vec2(24.0,12.0);
   vec2 distanceToLine=abs(fract(axes+0.5)-0.5);
   vec2 width=max(fwidth(axes),vec2(0.0001));
   vec2 lines=vec2(1.0)-smoothstep(width*0.25,width*1.15,distanceToLine);
   float meridians=lines.x*(1.0-smoothstep(0.92,1.0,abs(n.y)));
   land=mix(land,vec3(0.59,0.85,0.79),max(meridians,lines.y)*0.36);
 }
 color=vec4(land+vec3(0.025,0.11,0.18)*rim,1.0);
}`;

export const starVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in float aSize;
uniform mat4 uMvp;
uniform float uPixelRatio;
out float vBrightness;
void main(){
 gl_Position=uMvp*vec4(aPosition,0.0);
 gl_Position.z=gl_Position.w*0.999;
 gl_PointSize=aSize*uPixelRatio;
 vBrightness=0.3+aSize*0.2;
}`;
export const starFragment = `#version 300 es
precision mediump float;
in float vBrightness;
out vec4 color;
void main(){float alpha=1.0-smoothstep(0.08,0.5,length(gl_PointCoord-0.5));color=vec4(0.75,0.84,0.88,alpha*vBrightness);}`;
