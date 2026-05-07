import React, { useRef, useMemo, useEffect } from 'react';
import { extend, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleDispersionMaterial } from '../materials/ParticleDispersionMaterial';

extend({ ParticleDispersionMaterial });

export const ParticleDispersion = ({ 
  shapeA, 
  shapeB, 
  progressRef, 
  colorStart = "#00f5ff",
  colorEnd = "#ff0055",
  dispersionStrength = 8.0,
  pointSize = 6.0,
  dispersionMode = 0,
  isDualTone = true,
  autoRotate = true
}) => {
  const materialRef = useRef();
  const pointsRef = useRef();
  
  const rotRef = useRef({ x: 0, y: 0, z: 0 });
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      if (autoRotate) {
        timeRef.current += delta;
        rotRef.current.y += delta * 0.15;
        rotRef.current.x = Math.sin(timeRef.current * 0.5) * 0.05;
        rotRef.current.z = Math.cos(timeRef.current * 0.3) * 0.02;
      } else {
        let normalizedY = Math.atan2(Math.sin(rotRef.current.y), Math.cos(rotRef.current.y));
        rotRef.current.y = THREE.MathUtils.lerp(normalizedY, 0, 0.05);
        rotRef.current.x = THREE.MathUtils.lerp(rotRef.current.x, 0, 0.05);
        rotRef.current.z = THREE.MathUtils.lerp(rotRef.current.z, 0, 0.05);
      }
      pointsRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      pointsRef.current.rotation.set(rotRef.current.x, rotRef.current.y, rotRef.current.z);
    }

    if (materialRef.current) {
      materialRef.current.uTime = state.clock.elapsedTime;
      materialRef.current.uProgress = progressRef.current.value;
      materialRef.current.uDispersionStrength = dispersionStrength;

      const rawMouseX = (state.mouse.x * state.viewport.width) / 2;
      const rawMouseY = (state.mouse.y * state.viewport.height) / 2;
      
      const currentRotationY = pointsRef.current ? pointsRef.current.rotation.y : 0;
      const adjustedMouseX = rawMouseX * Math.cos(-currentRotationY) - 0 * Math.sin(-currentRotationY);

      materialRef.current.uMouse.set(adjustedMouseX, rawMouseY);
    }
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(shapeA, 3));
    geo.setAttribute('targetPosition', new THREE.BufferAttribute(shapeB, 3));
    return geo;
  }, [shapeA, shapeB]);

  // STABILITY FIX 1: Explicitly clear GPU memory when geometry changes
  useEffect(() => {
    return () => {
      if (geometry) {
        geometry.dispose();
      }
    };
  }, [geometry]);

  // STABILITY FIX 2: Cleanup material on unmount
  useEffect(() => {
    return () => {
      if (materialRef.current) {
        materialRef.current.dispose();
      }
    };
  }, []);

  return (
    <points ref={pointsRef} geometry={geometry}>
      <particleDispersionMaterial 
        ref={materialRef}
        uPointSize={pointSize}
        uColorStart={new THREE.Color(colorStart)}
        uColorEnd={new THREE.Color(colorEnd)}
        uDispersionMode={dispersionMode}
        uIsDualTone={isDualTone ? 1 : 0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent={true}
      />
    </points>
  );
};