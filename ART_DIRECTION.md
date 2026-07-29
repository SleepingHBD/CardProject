# Project: Prowl — Card Art Direction

This file is the visual standard for future card and character artwork. The July
2026 overhaul was generated with OpenAI's built-in ImageGen, then reviewed and
packaged as WebP assets for the game.

## Core visual language

- Original 2D fantasy-adventure production cartoon.
- Bold, slightly irregular warm-black outer contours.
- Thinner, purposeful interior lines.
- Flat matte color fills with one hard-edged cel-shadow shape per major form.
- Large eyes, simple muzzle construction, readable brows, and expressive ears.
- Four grouped digits on each visible paw; coherent limbs and prop contact.
- A distinct action silhouette for every character.
- One large graphic background shape plus a few element-specific accents.
- Faces and important props stay readable in the upper-central shallow crop used
  by cards in the player's hand.

## What to avoid

- Repeated distressed-paper, faux-woodcut, or engraved texture.
- Strand-by-strand fur, hatching, airbrush shading, bloom, or glossy rendering.
- Random jewelry, unexplained ornaments, tiny costume filigree, or guild marks.
- Centered mascot poses repeated across the roster.
- Busy scenic backgrounds that compete with the character.
- Extra limbs, duplicated paws, ambiguous prop grips, or human-looking hands.
- Text, card frames, signatures, or watermarks inside the illustration.

## Element palettes

- Ember: cream ground, brick red or deep plum shape, orange-red action accents.
- Gust: sky blue ground, cream shape, olive and teal motion accents.
- Tide: navy or aqua ground, pale aqua shape, royal-blue action accents.

Element colors identify the family; character colors and silhouettes carry the
individual personality.

## Composition checks

Every illustration must pass these checks before being added:

1. Recognizable character and action at thumbnail size.
2. Clear face and both eyes in the card's visible crop.
3. One dominant focal point and one supporting prop or effect.
4. Anatomically coherent pose with deliberate paw placement.
5. No texture noise or ornamental detail that disappears at card size.
6. A silhouette that does not duplicate another card in the same element.

## Anatomy gate

Run this separately from the composition review. A clean silhouette can still
hide a duplicated or missing limb.

1. Count exactly one head, one torso, one tail, two forelegs, and two hind legs.
2. Trace every foreleg from a shoulder to its paw and every hind leg from a hip
   or haunch to its paw. Counting visible paws alone is not sufficient.
3. A raised prop-holding foreleg replaces a planted foreleg; it is not an
   additional arm layered over the default four-legged pose.
4. For full-body action cards, show all four limbs with negative space between
   overlapping limbs whenever possible.
5. A hidden limb is acceptable only when the body, clothing, or a foreground
   prop clearly explains the occlusion.
6. Reject fused joints, duplicated paws, floating paws, limb-like cape folds,
   human finger anatomy, and prop grips that cannot be traced to a shoulder.
7. Repeat the count after the final square crop, because cropping can turn a
   valid hidden limb into one that reads as missing.

## Final prompt recipe

Use the current `sizzle-mittens.webp` as the card style reference and
`rookie.webp` as the full-character style reference:

> Re-illustrate the supplied character concept in the reference image's clean
> hand-inked production-cartoon language. Use a bold, slightly varied warm-black
> outer contour, thinner purposeful inner lines, completely flat matte fills,
> and one hard-edged cel-shadow shape per major form. Keep the face and both eyes
> large in the upper-center, safe for a shallow landscape crop. Use coherent
> feline anatomy and four grouped digits per visible paw. Create a distinct
> asymmetric action silhouette and a sparse, flat elemental background. No
> texture, grain, distress, hatching, engraved lines, individual fur strands,
> airbrush, gradients, glow, painterly rendering, tiny clutter, random
> ornaments, guild symbols, text, border, signature, or watermark.

Append the card-specific action and prop brief below.

## Character and card briefs

- Pawcadet: cheerful orange tabby trainee, teal tunic, purple neckerchief,
  confident raised paw.
- Professor Paws: older lilac longhair mentor, round spectacles, burgundy coat,
  pointer, calm theatrical authority.
- Sizzle Mittens: tuxedo cat dueling with one flaming red yarn ball and spool.
- Candle Pounce: orange tabby acrobat springing diagonally over three candles.
- Toastie Toe Beans: round cream kitten warming its hind toe beans by a compact
  iron hearth.
- Comet Claw: sleek black celestial cat surfing one red-orange comet, with
  clean unhaloed limb contours.
- Cinder Kit: soot-gray apprentice pumping one leather bellows into a brick
  hearth.
- Teapot Tabby: striped tea master balancing one teapot and cup on a tray.
- Sir Squall: compact smoky-silver knight in an open-faced bascinet, mail,
  forest-green heraldic surcoat, and fitted plate pieces, bracing one kite
  shield while raising one arming sword.
- Leafy Loaf: sleeping white-and-gray cat curled inside a leafy cloak.
- Whisker Whirl: seal-point Siamese wind mage with blue eyes, controlling one
  large ribbon spiral.
- Gale Groomer: fluffy white epic airship captain pointing from a wooden prow.
- Kitewhisker: orange kitten bracing against one kite's pull on a rampart.
- Dandelion Dash: compact scruffy brown herald-courier in a low three-point
  starting crouch, wearing a plain quartered tabard and bycocket cap and
  carrying one wax-sealed dispatch.
- Puddle Pouncer: calico kitten leaping into one bold graphic splash.
- Bubble Bengal: compact Bengal court bubble-seer perched low on broad haunches
  in a sleeveless blue surcoat, holding one bubble wand and one open pearl shell.
- Moonpool Mouser: hooded navy cat crouched beside a circular moon pool.
- Empress Ebb: compact, broad-pawed silver-blue Nebelung maritime sovereign with
  an oversized feline head, wearing a coral-and-pearl crown, broad pearl collar,
  and Byzantine-inspired navy-and-teal lamellar armour fitted to her short cat
  stature. She plants one ceremonial trident, points her decree with the other
  paw, and commands one stylized wave with a knowing one-fanged grin, raised
  brow, cocked ear, and lively tail. Keep her pose diagonal and asymmetrical,
  against a clean, uniform navy circle with no dark shadow markings, patterns,
  or creature silhouettes.
- Wellwater Wisp: calico well-keeper in a sleeveless teal wool kirtle and rope
  belt, pulling one bucket with both bare forelegs visible.
- Mizzle Motley: slender slate-blue castle fool and water-juggler in a
  blue-and-cream fool's hood and jagged motley, juggling three water droplets.
