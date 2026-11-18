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
out vec4 color;
void main(){
 vec2 map=texture(uMap,vUv).rg;
 float shore=1.0-abs(map.r*2.0-1.0);
 float lines=max(shore*0.38,uBorders?map.g*0.82:0.0);
 vec3 base=mix(vec3(0.925),vec3(0.78),map.r);
 color=vec4(mix(base,vec3(0.26),lines)*vShade,1.0);
}`;
