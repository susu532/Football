Your codebase is a multiplayer Rocket League-style soccer game using RAPIER physics (server-authoritative at 120Hz) with Colyseus networking and sophisticated client-side prediction. The ball currently responds only to discrete kick impulses with no continuous contact mechanics. The existing collision prediction system in @src/Ball.jsx is highly advanced with ping-aware sweep tests, making it an ideal foundation for dribbling. The server handles all authoritative physics in @server/rooms/SoccerRoom.js, while clients predict and reconcile.

Approach
Implement contact stabilization with corrective impulses as a server-authoritative mechanic with client-side prediction mirroring. The dribble state will be implicit (detected each frame via geometry) rather than explicit state, preventing desync issues. Server applies small centering/upward impulses and velocity matching when ball is detected on top of player. Client mirrors the same logic for instant visual feedback. Break conditions (hard acceleration, sharp rotation, jumps) naturally disable stabilization. This approach integrates seamlessly with your existing 120Hz physics loop and ping-aware prediction system.

Implementation Steps
1. Server-Side Dribble Detection & Stabilization
Location: @server/rooms/SoccerRoom.js in physicsUpdate() method

Add dribble detection logic after player physics updates (around line 639, before this.world.step()):

Dribble Detection Constants (add near top of class):

DRIBBLE_RADIUS: 1.2 (horizontal distance threshold)
DRIBBLE_HEIGHT: 1.5 (vertical distance threshold)
BALL_RADIUS: 0.8
PLAYER_TOP_Y: 0.5 (approximate top of player collider)
Detection Logic (for each player):

Check if ball Y > player Y
Calculate horizontal distance (XZ plane) between ball and player
Calculate vertical distance: ball.y - (player.y + PLAYER_TOP_Y)
Set isDribbling = isAbove && horizontalDist < DRIBBLE_RADIUS && verticalDist < DRIBBLE_HEIGHT
Stabilization Impulses (when isDribbling is true):

Centering impulse: Calculate normalized direction from ball to player center (XZ plane only, Y=0). Apply small impulse: ballBody.applyImpulse({ x: centerDir.x * 0.15, y: 0, z: centerDir.z * 0.15 })
Upward impulse: Counter gravity with small upward force: ballBody.applyImpulse({ x: 0, y: 0.06, z: 0 })
Velocity matching: Lerp ball's horizontal velocity toward player's velocity: ball.vx = lerp(ball.vx, player.vx, 0.25), ball.vz = lerp(ball.vz, player.vz, 0.25)
Dynamic Physics Properties (when isDribbling):

Store original ball collider properties on first dribble
Temporarily modify: ballCollider.setRestitution(0.2) (reduced bounce), ballCollider.setFriction(1.2) (increased grip)
Restore original values when dribble ends
Break Conditions (disable stabilization when):

Player acceleration exceeds threshold: Math.sqrt(player.vx² + player.vz²) > 12
Player rotation changes rapidly: Math.abs(player.rotY - player.prevRotY) > 0.3 (store prevRotY each frame)
Player jumps: player.vy > 2
Ball velocity relative to player exceeds escape threshold: relativeSpeed > 8
Giant Power-Up Adjustment:

Scale DRIBBLE_RADIUS by 10x when player.giant === true
Scale impulse magnitudes by 1.5x for stronger stabilization
2. Client-Side Dribble Prediction
Location: @src/Ball.jsx in ClientBallVisual component's useFrame hook

Add dribble detection after collision prediction logic (around line 396, after player collision handling):

Detection Logic (mirror server):

Use same constants and detection algorithm
Access localPlayerRef.current.position and localPlayerRef.current.userData.velocity
Calculate isDribbling state each frame
Stabilization Application (when isDribbling):

Apply same centering impulse to predictedVelocity.current
Apply same upward impulse
Lerp predictedVelocity.current toward player velocity (XZ only)
Modify targetPos.current with small centering offset for instant visual feedback
Visual Feedback:

Reduce interpolation lerp factor during dribble for "stickier" feel: use LERP_DRIBBLE = 35 (between normal and collision)
Add subtle scale pulse to ball when dribble starts (optional): trigger kickFeedback.current() on dribble state change
Sync with Server:

Server state always takes priority during reconciliation
Client prediction only fills gaps between server updates
No explicit dribble state needed - geometry-based detection stays in sync
3. State Schema Extension (Optional)
Location: @server/schema/GameState.js

If you want explicit dribble state for debugging/UI:

Add to BallState:

dribblingPlayerId: 'string' (sessionId of dribbling player, empty string if none)
Add to PlayerState:

isDribbling: 'boolean'
Update in physicsUpdate():

Set this.state.ball.dribblingPlayerId = sessionId when dribble detected
Set player.isDribbling = true
Clear when dribble breaks
Client Usage:

Display dribble indicator UI
Trigger special effects/sounds
Show tutorial hints
4. Multiplayer Synchronization
Server Authority:

All stabilization impulses applied server-side in physicsUpdate()
Ball state synced at 60Hz patch rate (already configured)
No client can "force" dribble - server validates geometry
Client Prediction:

Local player mirrors server logic for 0-ping feel
Remote players' dribbles visible via synced ball state
Prediction errors corrected by server reconciliation (already implemented)
Latency Handling:

Existing ping-aware system in Ball.jsx already compensates
Dribble detection uses current positions (no lookahead needed)
Impulses are small and continuous, so missed frames don't break mechanic
5. Tuning Parameters
Create tunable constants for gameplay feel:

Server (@server/rooms/SoccerRoom.js):

DRIBBLE_RADIUS: 1.2          // Horizontal catch zone
DRIBBLE_HEIGHT: 1.5          // Vertical catch zone
CENTERING_IMPULSE: 0.15      // Pull toward center strength
UPWARD_IMPULSE: 0.06         // Anti-gravity strength
VELOCITY_MATCH_RATE: 0.25    // How fast ball matches player speed
DRIBBLE_RESTITUTION: 0.2     // Reduced bounce
DRIBBLE_FRICTION: 1.2        // Increased grip
BREAK_ACCEL_THRESHOLD: 12    // Max acceleration before break
BREAK_ROTATION_THRESHOLD: 0.3 // Max rotation change before break
BREAK_VELOCITY_THRESHOLD: 8   // Max relative speed before break
Client (<traycer-file absPath="c:\Users\slayer\OneDrive\Bureau\soccer\src\Ball.jsx">src/Ball.jsx</traycer-file>

LERP_DRIBBLE: 35             // Visual interpolation during dribble
DRIBBLE_VISUAL_OFFSET: 0.05  // Extra centering for visuals
6. Testing & Iteration
Single Player Testing:

Drive under stationary ball - should "catch" and stabilize
Accelerate slowly - ball should stay on top
Accelerate hard - ball should fly off naturally
Jump - ball should launch upward
Turn sharply - ball should roll off
Multiplayer Testing:

Test with 50ms, 100ms, 200ms simulated latency
Verify remote players' dribbles look smooth
Check for desync issues (ball teleporting)
Ensure no "sticky ball" exploits
Tuning Priorities:

Adjust CENTERING_IMPULSE for catch difficulty
Adjust VELOCITY_MATCH_RATE for "locked" feel
Adjust break thresholds for skill expression
Balance giant power-up dribble scaling
Architecture Diagram
RAPIER Physics
Server (SoccerRoom.js)
Client (Ball.jsx)
RAPIER Physics
Server (SoccerRoom.js)
Client (Ball.jsx)
Every Frame (120Hz server, 60Hz client)
alt
[Ball is on top of player]
[Ball not on top]
alt
[Local player dribbling]
Update player positions
Detect ball-on-top (geometry check)
Calculate centering direction
Apply centering impulse (0.15)
Apply upward impulse (0.06)
Lerp ball velocity → player velocity
Set restitution=0.2, friction=1.2
Restore restitution=0.75, friction=0.5
Step physics simulation
Updated ball state
Sync ball state (60Hz)
Receive server ball state
Detect ball-on-top (local player)
Apply same stabilization to prediction
Use LERP_DRIBBLE for sticky feel
Reconcile with server state
Render ball at predicted position
Key Integration Points
Existing Systems to Leverage:

@src/Ball.jsx lines 273-396: Collision prediction system - add dribble detection here
@server/rooms/SoccerRoom.js lines 547-676: Physics update loop - add stabilization here
@src/PlayerController.jsx lines 250-253: Player velocity exposure - already available for dribble
@server/rooms/SoccerRoom.js lines 722-763: Giant power-up handling - scale dribble parameters here
Files to Modify:

@server/rooms/SoccerRoom.js - Core dribble logic (150-200 lines)
@src/Ball.jsx - Client prediction mirroring (50-80 lines)
@server/schema/GameState.js - Optional state extension (10 lines)
No Changes Needed:

Input handling (@src/InputManager.js) - works as-is
Network sync (@src/useColyseus.jsx) - existing system handles it
Player controller (@src/PlayerController.jsx) - velocity already exposed