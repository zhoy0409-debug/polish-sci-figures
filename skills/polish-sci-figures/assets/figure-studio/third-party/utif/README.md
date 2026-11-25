# UTIF.js

Source: https://github.com/photopea/UTIF.js

Commit: `d5f4afefa9bde9f5ac1ee9782983088f6ffbf5e9`

SHA-256 of unmodified `UTIF.js`: `001a49c1734791bd1674e641de26eff216edd06c901fecf3dc4f05ac539bd0cb`

License: MIT, included in `LICENSE.txt` and the self-contained editor's worker source.

Figure Studio uses a bounded local worker for explicitly supported lossless TIFF planes. It parses and validates the TIFF directories before invoking the decoder, checks strip/tile geometry and compression integrity, retains the original file and a digest of native samples, and generates a separate reversible PNG for display. Unsupported sample types, colour profiles or layouts are reported explicitly. No TIFF file is fetched or sent to an external service.
