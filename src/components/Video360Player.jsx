/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 *
 * For licensing inquiries: hentertrabelsi@gmail.com
 */

import React, { useLayoutEffect } from 'react';
import { useVideoTexture, Sphere } from '@react-three/drei';
import * as THREE from 'three';

const Video360Player = ({ videoUrl, scale = 5 }) => {
  console.log("Video360Player: Rendering with", { videoUrl, scale });
  
  const texture = useVideoTexture(videoUrl, {
    unsuspended: true,
    muted: true,
    loop: true,
    start: true,
    crossOrigin: "Anonymous"
  });

  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    // texture.flipY = false; // Try this if video is upside down
    console.log("Video360Player: Texture readyState", texture.image?.readyState);
  }

  return (
    <Sphere 
      args={[10, 64, 64]} 
      scale={[scale, scale, scale]} 
      position={[0, 0, 0]} 
      rotation={[Math.PI, Math.PI / 2, Math.PI / 1.5  ]}
    >
      <meshBasicMaterial 
        map={texture} 
        side={THREE.BackSide} 
        transparent={false}
        depthWrite={true}
      />
    </Sphere>
  );
};

export default Video360Player;
