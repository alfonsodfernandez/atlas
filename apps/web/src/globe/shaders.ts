export const earthVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
uniform mat4 uMvp;
uniform vec3 uEye;
out highp vec2 vUv;
out mediump float vShade;
void main(){
 vUv=aUv;
 float facing=max(dot(aNormal,normalize(uEye-aPosition)),0.0);
 vShade=0.82+0.18*facing;
 gl_Position=uMvp*vec4(aPosition,1.0);
}`;

export const earthFragment = `#version 300 es
precision mediump float;
in highp vec2 vUv;
in mediump float vShade;
uniform sampler2D uMap;
uniform bool uBorders;
uniform bool uDemo;
out vec4 color;
void main(){
 vec3 map=texture(uMap,vUv).rgb;
 float shore=1.0-abs(map.r*2.0-1.0);
 float lines=max(shore*0.26,uBorders?map.g*0.64:0.0);
 vec3 base=mix(vec3(0.49,0.63,0.66),vec3(0.65,0.69,0.52),map.r);
 if(uDemo)base=mix(base,vec3(0.84,0.60,0.30),map.b);
 color=vec4(mix(base,vec3(0.26,0.35,0.29),lines)*vShade,1.0);
}`;
