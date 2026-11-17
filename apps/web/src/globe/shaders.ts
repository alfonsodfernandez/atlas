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
out vec4 color;
void main(){
 vec3 n=normalize(vNormal);
 float daylight=max(dot(n,uSun),0.0);
 float light=mix(1.0,0.24+0.76*sqrt(daylight),uLighting);
 vec3 land=texture(uEarth,vUv).rgb*light;
 float rim=pow(1.0-max(dot(n,normalize(uEye-vPosition)),0.0),3.0);
 color=vec4(land+vec3(0.025,0.11,0.18)*rim,1.0);
}`;

export const atmosphereVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
uniform mat4 uMvp;
out vec3 vNormal;
out vec3 vPosition;
void main(){vNormal=aNormal;vPosition=aPosition*1.025;gl_Position=uMvp*vec4(vPosition,1.0);}`;

export const atmosphereFragment = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vPosition;
uniform vec3 uEye;
uniform vec3 uSun;
uniform float uLighting;
out vec4 color;
void main(){
 vec3 n=normalize(vNormal);
 float rim=pow(1.0-abs(dot(n,normalize(uEye-vPosition))),3.0);
 float day=mix(1.0,0.3+0.7*max(dot(n,uSun),0.0),uLighting);
 color=vec4(0.12,0.42,0.7,rim*day*0.48);
}`;

export const lineVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
uniform mat4 uMvp;
void main(){gl_Position=uMvp*vec4(aPosition,1.0);}`;
export const lineFragment = `#version 300 es
precision mediump float;
out vec4 color;
void main(){color=vec4(0.57,0.86,0.75,0.68);}`;

export const starVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in float aSize;
uniform mat4 uView;
uniform mat4 uProjection;
uniform float uPixelRatio;
out float vBrightness;
void main(){
 gl_Position=uProjection*uView*vec4(aPosition,0.0);
 gl_Position.z=gl_Position.w*0.999;
 gl_PointSize=aSize*uPixelRatio;
 vBrightness=0.3+aSize*0.2;
}`;
export const starFragment = `#version 300 es
precision mediump float;
in float vBrightness;
out vec4 color;
void main(){float alpha=1.0-smoothstep(0.08,0.5,length(gl_PointCoord-0.5));color=vec4(0.75,0.84,0.88,alpha*vBrightness);}`;
