import React, { useEffect, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const Video360Player = ({ videoUrl, glbUrl, scale = 10 }) => {
  const { scene } = useGLTF(glbUrl);
  const videoRef = useRef();
  const [videoTexture, setVideoTexture] = useState(null);

  useEffect(() => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.loop = true;
    video.muted = true; // Autoplay usually requires mute
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.play().catch(err => console.error("Video play failed:", err));
    
    videoRef.current = video;
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    setVideoTexture(texture);

    return () => {
      video.pause();
      video.src = "";
      video.load();
    };
  }, [videoUrl]);

  useEffect(() => {
    if (scene && videoTexture) {
      scene.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshBasicMaterial({
            map: videoTexture,
            side: THREE.BackSide, // We are inside the sphere
          });
        }
      });
    }
  }, [scene, videoTexture]);

  return <primitive object={scene} scale={[scale, scale, scale]} position={[0, 0, 0]} />;
};

export default Video360Player;
