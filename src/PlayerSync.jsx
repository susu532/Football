import React, { useRef, useEffect, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { RPC, usePlayerState } from 'playroomkit'
import CharacterSkin from './CharacterSkin'

export const LocalPlayerWithSync = React.forwardRef(function LocalPlayerWithSync(props, ref) {
  const { me, playerRef, playerName = '', playerTeam = '', teamColor = '#888', spawnPosition = [0, 1, 0], powerUps = [], onCollectPowerUp = null, isFreeLook = null, mobileInput = null, characterType = 'cat', onLocalInteraction = null, isHost } = props
  const rigidBodyRef = useRef()

  useImperativeHandle(ref, () => rigidBodyRef.current)
  const handleKick = (data) => {
    if (data) {
      RPC.call('kick-ball', { ...data, playerId: me.id }, RPC.Mode.ALL)
      if (onLocalInteraction) onLocalInteraction()
    }
  }

  const lastUpdate = useRef(0)
  
  useFrame((state) => {
    if (!me || !playerRef.current) return
    
    if (isHost && rigidBodyRef.current) {
      rigidBodyRef.current.setNextKinematicTranslation(playerRef.current.position)
      rigidBodyRef.current.setNextKinematicRotation(playerRef.current.quaternion)
    }

    const now = state.clock.getElapsedTime()
    if (now - lastUpdate.current < 0.033) return
    lastUpdate.current = now

    const pos = playerRef.current.position
    const rot = playerRef.current.rotation ? playerRef.current.rotation.y : 0
    const invisible = playerRef.current.userData?.invisible || false
    const giant = playerRef.current.userData?.giant || false
    
    me.setState('pos', [pos.x, pos.y, pos.z], false)
    me.setState('rot', rot, false)
    me.setState('invisible', invisible, false)
    me.setState('giant', giant, false)
  })

  useEffect(() => {
    if (me) {
      me.setState('profile', {
        name: playerName,
        team: playerTeam,
        color: teamColor,
        character: characterType
      }, true)
    }
  }, [me, playerName, playerTeam, teamColor, characterType])

  const labelRef = useRef()
  
  useFrame(() => {
    if (labelRef.current && playerRef.current) {
      labelRef.current.position.copy(playerRef.current.position)
    }
  })

  const Visuals = (
    <group>
      <CharacterSkin 
        ref={playerRef} 
        position={spawnPosition} 
        teamColor={teamColor} 
        remotePlayers={{}} 
        onKick={handleKick}
        powerUps={powerUps}
        onCollectPowerUp={onCollectPowerUp}
        isFreeLook={isFreeLook}
        mobileInput={mobileInput}
        characterType={characterType}
        onLocalInteraction={onLocalInteraction}
        localPlayerId={me.id}
      />
      {playerName && (
        <group ref={labelRef}>
          <Html position={[0, 2.2, 0]} center distanceFactor={8}>
            <div className={`player-name-label ${playerTeam}`}>{playerName}</div>
          </Html>
        </group>
      )}
    </group>
  )

  if (isHost) {
      return (
          <RigidBody ref={rigidBodyRef} type="kinematicPosition">
              <CapsuleCollider args={[0.5, 0.5]} position={[0, 1, 0]} />
              {Visuals}
          </RigidBody>
      )
  }

  return Visuals
})

export const RemotePlayerWithPhysics = React.forwardRef(function RemotePlayerWithPhysics(props, ref) {
  const { player, isHost } = props
  const rigidBodyRef = useRef()
  const groupRef = useRef()

  useImperativeHandle(ref, () => rigidBodyRef.current || groupRef.current)
  const [position] = usePlayerState(player, 'pos', [0, 1, 0])
  const [rotation] = usePlayerState(player, 'rot', 0)
  const [profile] = usePlayerState(player, 'profile', { name: 'Player', color: '#888', team: '', character: 'cat' })
  const [invisible] = usePlayerState(player, 'invisible', false)
  const [giant] = usePlayerState(player, 'giant', false)

  const { name: playerName, color, team, character } = profile

  const targetPosition = useRef(new THREE.Vector3(...position))
  const targetRotation = useRef(rotation)
  
  useEffect(() => {
    targetPosition.current.set(position[0], position[1], position[2])
    targetRotation.current = rotation
  }, [position, rotation])

  useFrame((_, delta) => {
    if (groupRef.current) {
      const lambda = 20
      
      groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, targetPosition.current.x, lambda, delta)
      groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetPosition.current.y, lambda, delta)
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, targetPosition.current.z, lambda, delta)
      
      let rotDiff = targetRotation.current - groupRef.current.rotation.y
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      
      groupRef.current.rotation.y += rotDiff * Math.min(1, lambda * delta)
    }
  })
  
  useFrame(() => {
      if (isHost && rigidBodyRef.current && groupRef.current) {
          rigidBodyRef.current.setNextKinematicTranslation(groupRef.current.position)
          rigidBodyRef.current.setNextKinematicRotation(groupRef.current.quaternion)
      }
  })

  const Visuals = (
    <group ref={groupRef} position={[position[0], position[1], position[2]]}>
      <CharacterSkin 
        characterType={character}
        teamColor={color}
        isRemote={true}
        invisible={invisible}
        giant={giant}
        key={character} 
      />
      {playerName && !invisible && (
        <Html key={`label-${playerName}`} position={[0, 2.2, 0]} center distanceFactor={8}>
          <div className={`player-name-label ${team}`}>{playerName}</div>
        </Html>
      )}
    </group>
  )

  if (isHost) {
      return (
          <RigidBody ref={rigidBodyRef} type="kinematicPosition">
              <CapsuleCollider args={[0.5, 0.5]} position={[0, 1, 0]} />
              {Visuals}
          </RigidBody>
      )
  }

  return Visuals
})
