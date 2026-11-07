# Scalar license provenance

`scalar-LICENSE` is the unmodified MIT license distributed with the installed,
lockfile-pinned `@scalar/nestjs-api-reference@1.0.27`. Its text matches Scalar's
upstream license: https://github.com/scalar/scalar/blob/main/LICENSE (checked
2026-10-29). The official `@scalar/api-reference@1.44.23` tarball declares MIT
and links to that license in its README and standalone banner, but omits a
separate LICENSE file. Keep this notice with the extracted browser bundle.

No renderer code is vendored here. `prepare-scalar.cjs` downloads the official
npm tarball, checks its pinned SHA-512 and extracts its public browser export
unchanged. Both API Dockerfiles copy this notice before running that script.
