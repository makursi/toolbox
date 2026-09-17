# A manual colour-scheme switch

> **Updated by ADR-0009**: the switch is now an icon-only button — a moon in the light scheme, a sun in the dark one — whose accessible name is `sr-only` text in the markup. That turns two things below into history rather than current state: the second implementation note ("the visible word is its accessible name (verified: '深色'…)") and the closing sentence ("a labelled button rather than a sun and a moon because this site has no icon set yet"). The reasoning about CSS choosing the state, and about a hand-written `aria-label` being unusable, still holds — the hidden sentence is a sentence now («切换到深色»), which is what invisible text bought.

ADR-0007 set the scheme to `auto` in both `ColorSchemeScript` and the provider, and `docs/design.md` section 7 turned that into a rule: "跟随操作系统，**不做手动切换开关**". It held while the dark scheme had never been rendered; once both schemes had been seen in a browser, a dark scheme nobody can choose is a dark scheme nobody sees. The header now carries a two-state switch.

The trade-off, taken deliberately: the site follows the operating system **until the switch is touched**, and stops following it afterwards. `localStorageColorSchemeManager` (Mantine's default manager) persists the choice and `ColorSchemeScript` reads it before the first paint, so no theme flashes on load. Two states rather than three (auto / light / dark): the header has one row of budget, and "follows the system until you say otherwise" already preserves what ADR-0007 wanted for anyone who never touches it. The cost, stated so nobody has to discover it: after one use, the operating system preference is ignored until site data is cleared.

Two implementation notes worth keeping:

- The label is chosen by CSS from `[data-mantine-color-scheme]`, not by React state. The server cannot know the operating system's preference, so a value read during render would either mismatch on hydration or briefly lie and then correct itself. Both words are in the markup and the attribute decides which is visible.
- Because of that, the button carries **no `aria-label`**: the visible word is its accessible name (verified: "深色" in the light scheme, "浅色" in the dark one). A hand-written label would disagree with whichever word is on screen.

The switch is a labelled button rather than a sun and a moon because this site has no icon set yet — see issue #14, which will replace it along with the other typographic glyphs.
