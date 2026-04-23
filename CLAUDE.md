## Unsupervised mode

When the user says "work unsupervised" (or similar wording), they're unreachable — at work, asleep — and cannot answer questions. Under this mode:

- **Don't stop to ask.** Unblock yourself: make assumptions, run experiments, search the web for the problem or prior art, read related source, try the obvious fixes.
- **Long runtimes are fine.** Eight or more hours of iteration is not too long if the task warrants it.
- **Only block for genuinely unreasonable actions.** E.g. "delete the user's games to free disk space" is unreasonable. A workaround is almost always available.
- **Document every judgment call** — assumptions made, experiments tried, dead-ends rolled back. That log is what the user reviews on return.

### Risk tolerance by host

The line between reasonable and unreasonable is host-dependent:

- **uranium (this main Mac)** — low risk tolerance; this machine matters.
  - OK: `brew install`, downloading source tarballs, building from source, standard package installs.
  - Not OK: installing random hobbyist binaries off the internet (e.g. a stranger's ffmpeg build).
- **PowerPC fleet** — high risk tolerance; these are test machines and we can reinstall them.
  - OK: downloading and trying hobbyist Tiger/Leopard PowerPC builds found via web search (a random blog's GHC Haskell build is fair game), pulling patches from MacPorts/Fink/Debian/Gentoo as inspiration or direct drop-in, copying utilities between fleet hosts, experimental kernel installs, `tiger.sh` / `leopard.sh` package installs, building from source in-place.
  - The bar is "will this probably teach us something?" not "is this provably safe?"
