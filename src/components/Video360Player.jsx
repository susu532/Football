import React, { useLayoutEffect } from 'react';
import { useVideoTexture, Sphere } from '@react-three/drei';
import * as THREE from 'three';

const Video360Player = ({ videoUrl, scale = 50 }) => {
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
      rotation={[Math.PI, Math.PI / 2, Math.PI  ]}
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
