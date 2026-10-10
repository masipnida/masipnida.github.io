# Pigeon portfolio

## Overview
Personal Korean-language portfolio. A circular opening reveals a pigeon head on the home page. The “mas? →” link beneath the role opens #menu: the opening expands, the pigeon faces left at 50 degrees, and a vertical about/stack/work/history navigation appears on the left at 7vw. The greeting, names, and role are hidden in this menu state while preserving the position of “← mas.” to return home. The return link uses an underline for keyboard focus rather than a box outline. No header or bottom navigation.

## Colors
Source: https://share.google/mBrBKHK1oAHBxvUm8
Resolved image: https://i.pinimg.com/564x/fc/2e/1f/fc2e1f7a84d71fcdef40e54166c8a013.jpg
Sampled from the center of each swatch in the supplied JPEG, left to right:

| Order | Color | Runtime token | Use |
| --- | --- | --- | --- |
| 1 | #585D57 | --palette-1 | Home foreground layer, controls |
| 2 | #9997A4 | --palette-2 | Selection accent |
| 3 | #B2C7C0 | --palette-3 | Solid base background |
| 4 | #E2E1DF | --palette-4 | Home text and selected controls |
| 5 | #BBBAB8 | --palette-5 | Home navigation border |

CSS variables in portfolio.css own runtime values. #303730 is the supporting readable ink on the third palette color.

## Typography
Retain Bricolage Grotesque for large names/headings, Pretendard for Korean prose, and JetBrains Mono for navigation and metadata.
Home profile order: “Hello, I'm ...” (43.2px, reduced by 10%), “Chaemin Shin” and outline-only “Masipnida” (both 112px, same responsive sizes), then “신채민” (48px, locally installed Pretendard Regular preferred with web Pretendard fallback) and “mas? →”. The role/location line is removed. The name and nickname have a tighter line gap. Profile text fades in over 450ms after the actual scene, bubble, and pigeon-turn animations finish; it fades out over 300ms before leaving home. Interrupted navigation cancels stale fades. Reduced motion makes these fades immediate. Sizes scale down on narrow screens. Contact links live only in the pigeon bubbles. The home pigeon is scaled to 1.3 times its base size while retaining its head alignment within the unchanged opening.

## Layout
Desktop: left text, vertical navigation in the middle, right fixed pigeon. Mobile: vertical navigation and pigeon above content. Natural document scrolling keeps long content accessible. Section pages retain the vertical links and provide “← mas.” above their content. Escape returns home. Hidden navigation is inert; hash links preserve browser back/forward and direct section URLs.

## Elevation & Depth
Flat colors. The circular opening uses a viewport-clipped scene on the first-color background. The WebGL canvas keeps the same dimensions across routes; only CSS transforms animate its position and scale, avoiding drawing-buffer reallocations during navigation.

## Shapes
One expanding circular opening is the signature. Home shows the head; section transitions expand over 1.1 seconds. Reduced motion removes the transition and uses the final direction directly.

## Components
Home bubbles gently float vertically by 8px in staggered 4.8s / 5.6s loops. Hover/focus pauses the motion for interaction; leaving home pauses it during the existing fade. Reduced motion disables it. Infinite loops must not block the profile's entrance-animation wait.
Home-only white iMessage-style bubbles reference https://www.figma.com/design/WOcg9ppu4x5EgZTWydPILb/iMessage-Chat-Bubbles--Community-?node-id=1-1169 . The home opening is slightly enlarged (28vw, up to 390px; 210px on mobile). GitHub overlaps its upper-left edge with a lower-right tail pointing toward the pigeon. The home composition is shifted down by a shared --home-offset (32–64px). Contacts uses a compact 276px width (244px on mobile) and is offset further left below the pigeon with an upper-right curved tail pointing toward its center. Both fade out on section navigation and fade in on home return. Off-home bubbles are inert and hidden after the fade. On mobile, the bubbles sit above the profile text. White (#FFFFFF) is the explicit bubble surface exception to the five-color palette.

Original About, Stack, Work, and History markup is preserved verbatim in portfolio-content.js. Work retains the project/activity records; History retains experience, education, clubs/activities, and awards. History currently uses a provisional shared content layout pending the user's design direction.

The pigeon uses Meshy_AI_Character_output_eyelids.glb, preserved as assets/pigeon-eyelids.glb and extended into assets/pigeon-idle.glb by build-pigeon-idle.cjs, rendered by locally vendored @google/model-viewer 4.1.0 (license alongside the viewer). This replacement contains a skin, four separate upper/lower eyelid meshes, and an embedded Blink clip with rotation keyframes returning to the initial pose. On Home, Blink plays once every 3–7 seconds using the embedded clip. Leaving Home, hiding the browser tab, or enabling reduced motion cancels the timer, pauses playback, and restores the open-eye pose. Returning schedules a fresh interval. Home/About/History face forward; Menu faces left at 50 degrees, Stack at 90 degrees, and Work faces right, orbiting over 850ms. The existing circular opening, responsive layout, bubbles, and profile fades wrap the model. Reduced motion jumps directly to the final camera angle. The prior GLBs and original image assets remain archived and are no longer loaded by the page.

## Do's and Don'ts
Keep all original portfolio facts and links. Keep source palette order. Do not add a header or invent a separate History design before the user specifies it. Do not generate replacement pigeon images without a request.

Menu idle motion: every 3–7 seconds, independently select rest (32%), Blink (17%), Peck (17%), HeadTilt (17%), or LookAround (17%). These are selection probabilities, not fractions of elapsed screen time. Peck closes both eyes, extends the neck forward/down, and bends the chest while foot vertices remain bound to the stationary pelvis; the rear body rises by 0.045 model units. HeadTilt rotates the shared head parent; the head, eyes, and beak are rigidly weighted together with a blend at the neck. Menu camera distance and CSS scale both increase by 1.5 to provide motion margin without reallocating the canvas. Each clip returns to its rest pose. Menu rest continuously loops a subtle four-second chest breathing clip; choosing rest again keeps its current phase. Other actions return to breathing when complete. LookAround turns the rigid head left and right with brief pauses. Home retains intermittent blinking. Navigation, hidden tabs, and reduced motion cancel pending/active motion.

Idle actions play exactly once and wait for the viewer finished event. No selection or return timer runs during a finite action. After completion, breathing starts at the matching neutral pose, then a fresh 3–7 second selection delay begins. Consecutive rest selections retain the breathing phase. Crossfades remain enabled on entry; action tails are never cut short. Navigation, hidden tabs and reduced motion cancel pending work and ignore late completion events.

Do not assign model-viewer currentTime while switching active clips: its setter calls mixer.setTime and resets the global clock, invalidating crossfade weights. Let the viewer initialize new clips/reset completed actions; explicit seeking is reserved for cancelled/hidden states. Runtime tracing verified Peck at 1.7s and HeadTilt at 2s with effective weight 1, followed by 4s breathing.
