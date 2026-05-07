import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

const snoiseGLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}
vec3 snoiseVec3( vec3 x ){
  float s  = snoise(vec3( x ));
  float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
  float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
  vec3 c = vec3( s , s1 , s2 );
  return c;
}
`;

export const ParticleDispersionMaterial = shaderMaterial(
  {
    uTime: 0.0,
    uProgress: 0.0,
    uDispersionStrength: 8.0,
    uColorStart: new THREE.Color(0x00f5ff),
    uColorEnd: new THREE.Color(0xff0055),
    uMouse: new THREE.Vector2(0, 0),
    uPointSize: 6.0,
    uDispersionMode: 0,
    uIsDualTone: 1 // NEW UNIFORM
  },
  `
    uniform float uTime;
    uniform float uProgress;
    uniform float uDispersionStrength;
    uniform vec2 uMouse;
    uniform float uPointSize;
    uniform int uDispersionMode;
    uniform int uIsDualTone;
    uniform vec3 uColorStart;
    uniform vec3 uColorEnd;
    
    attribute vec3 targetPosition;
    varying vec3 vColor;
    
    ${snoiseGLSL}

    void main() {
      vec3 mixedPos = mix(position, targetPosition, uProgress);
      vec3 finalPos = mixedPos;
      
      float peakProgress = uProgress * (1.0 - uProgress) * 4.0; 

      if (uDispersionMode == 0) {
        vec3 noise = snoiseVec3(position * 2.0 + uTime) * peakProgress;
        finalPos += (noise * uDispersionStrength);
      } else if (uDispersionMode == 1) {
        float distToCenter = length(mixedPos.xz);
        float angle = peakProgress * uDispersionStrength * (5.0 / (distToCenter + 1.0));
        float s = sin(angle);
        float c = cos(angle);
        finalPos.x = mixedPos.x * c - mixedPos.z * s;
        finalPos.z = mixedPos.x * s + mixedPos.z * c;
        finalPos.y += peakProgress * uDispersionStrength * 1.5;
        finalPos += snoiseVec3(position + uTime) * peakProgress * 2.0;
      } else if (uDispersionMode == 2) {
        finalPos = mix(mixedPos, vec3(0.0), peakProgress * 0.98);
        finalPos += snoiseVec3(position * 10.0 + uTime * 5.0) * peakProgress * (uDispersionStrength * 0.5);
      } else if (uDispersionMode == 3) {
        finalPos.x += peakProgress * uDispersionStrength * 4.0;
        finalPos.y += snoise(vec3(position.x, position.y + uTime, position.z)) * peakProgress * (uDispersionStrength * 0.8);
        finalPos.z += snoise(vec3(position.x, position.y, position.z - uTime)) * peakProgress * (uDispersionStrength * 0.8);
      }
      
      float dist = distance(finalPos.xy, uMouse);
      float repelRadius = 7.0;
      float force = max(0.0, repelRadius - dist) / repelRadius;
      
      if (force > 0.0) {
        vec2 dir = normalize(finalPos.xy - uMouse);
        finalPos.xy += dir * force * 3.0;
        finalPos.x += -dir.y * force * 2.0;
        finalPos.y += dir.x * force * 2.0;
        finalPos.z += force * 4.0; 
      }

      // MONO VS DUAL LOGIC
      if (uIsDualTone == 1) {
        float mixFactor = smoothstep(-15.0, 15.0, finalPos.x + finalPos.y);
        vColor = mix(uColorStart, uColorEnd, mixFactor);
      } else {
        vColor = uColorStart;
      }

      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      gl_PointSize = uPointSize * (1.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  `
    varying vec3 vColor;
    void main() {
      float dist = distance(gl_PointCoord, vec2(0.5));
      if(dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.1, dist);
      gl_FragColor = vec4(vColor, alpha);
    }
  `
);