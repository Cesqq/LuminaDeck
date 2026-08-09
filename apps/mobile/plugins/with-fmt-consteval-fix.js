// plugins/with-fmt-consteval-fix.js
//
// Workaround for the fmt 11.0.2 + Apple Clang 21 (Xcode 26.4+) consteval
// build failure. fmt is a transitive C++ dep of RCT-Folly and gets
// source-compiled in every RN 0.81 project, so this hits Lumina Deck the
// same way it hit Girl Math (this plugin is a port of Girl Math's
// plugins/with-fmt-consteval-fix.js — keep the two in sync if either
// changes).
//
// Background
// ----------
// Issue: https://github.com/facebook/react-native/issues/55601
// fmt issue: https://github.com/fmtlib/fmt/issues/4740
// Expo SDK 55 issue: https://github.com/expo/expo/issues/44229
//
// Apple Clang 21 enforces stricter consteval rules than previous Clang
// versions. fmt's `FMT_STRING(...)` macro expansions in `format-inl.h` are
// evaluated at the call site without being constant expressions themselves
// (they hit consteval functions through templated paths), and Clang 21
// rejects them. Five errors in `Pods/fmt/include/fmt/format-inl.h` lines
// 59, 60, 1387, 1391, 1394.
//
// Fix
// ---
// Patch Pods/fmt/include/fmt/base.h to make FMT_CONSTEVAL empty. Defining
// `FMT_USE_CONSTEVAL=0` via GCC_PREPROCESSOR_DEFINITIONS does NOT work:
// fmt 11.0.2 has no outer `#ifndef FMT_USE_CONSTEVAL` guard around its
// platform-detection chain in base.h, so fmt's own #define overrides any
// outside value. The fmt maintainers' canonical fix is fmt 12.x, but RN
// 0.81.5 vendors 11.0.2 and we don't want to monkey-patch a different
// version in.
//
// Applies via Podfile post_install hook (injected into the Podfile during
// `expo prebuild`).

const { withPodfile } = require('expo/config-plugins');

const SENTINEL = '__luminadeck_fmt_consteval_fix__';

const POST_INSTALL_RUBY_BLOCK = `
    # ${SENTINEL}
    # Fix fmt 11.0.2 consteval errors with Apple Clang 21 / Xcode 26.4+.
    # See: https://github.com/facebook/react-native/issues/55601
    # See: plugins/with-fmt-consteval-fix.js
    base_h = "\#{installer.sandbox.root}/fmt/include/fmt/base.h"
    if File.exist?(base_h)
      # CocoaPods writes pod files read-only; flip writable before patching.
      File.chmod(0644, base_h)
      content = File.read(base_h)
      sentinel = '/* ${SENTINEL} */'
      unless content.include?(sentinel)
        # Replace the consteval-emitting branch with an empty macro
        old_block = "\#if FMT_USE_CONSTEVAL\\n#  define FMT_CONSTEVAL consteval\\n#  define FMT_CONSTEXPR20 constexpr\\n#else\\n#  define FMT_CONSTEVAL\\n#  define FMT_CONSTEXPR20\\n#endif"
        new_block = "/* \#{sentinel.gsub('/* ','').gsub(' */','')} */ /* fmt 11.0.2 + Apple Clang 21 fix */\\n#define FMT_CONSTEVAL\\n#define FMT_CONSTEXPR20"
        if content.include?(old_block)
          content.sub!(old_block, new_block)
          File.write(base_h, content)
          puts "[LuminaDeck] Patched fmt base.h to disable consteval (Apple Clang 21 fix)"
        else
          # Fallback: just nuke the \`consteval\` keyword on the FMT_CONSTEVAL define
          line_old = '#  define FMT_CONSTEVAL consteval'
          line_new = "/* \#{sentinel.gsub('/* ','').gsub(' */','')} */ #  define FMT_CONSTEVAL"
          if content.include?(line_old)
            content.sub!(line_old, line_new)
            File.write(base_h, content)
            puts "[LuminaDeck] Patched fmt base.h FMT_CONSTEVAL define (fallback)"
          else
            puts "[LuminaDeck] WARN: could not find expected fmt base.h consteval block — patch NOT applied"
          end
        end
      else
        puts "[LuminaDeck] fmt base.h already patched (sentinel present)"
      end
    else
      puts "[LuminaDeck] INFO: \#{base_h} not present; fmt may not be a source dep in this build"
    end
`;

const withFmtConstevalFix = (config) => {
  return withPodfile(config, (cfg) => {
    let podfile = cfg.modResults.contents;
    if (podfile.includes(SENTINEL)) return cfg;

    // Inject our block at the end of the existing post_install body.
    // Anchor on the closing paren of the react_native_post_install(...)
    // call (this is the Expo-generated boilerplate that exists in every
    // RN-Expo Podfile).
    const marker = 'react_native_post_install(';
    const idx = podfile.lastIndexOf(marker);
    if (idx === -1) {
      // eslint-disable-next-line no-console
      console.warn(
        '[with-fmt-consteval-fix] react_native_post_install( not found in Podfile; fmt fix NOT injected.',
      );
      return cfg;
    }

    let depth = 0;
    let endIdx = -1;
    for (let i = idx + marker.length - 1; i < podfile.length; i++) {
      const ch = podfile[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
    if (endIdx === -1) {
      // eslint-disable-next-line no-console
      console.warn(
        '[with-fmt-consteval-fix] could not find closing paren of react_native_post_install(...). Skipping injection.',
      );
      return cfg;
    }

    podfile =
      podfile.slice(0, endIdx) +
      '\n' +
      POST_INSTALL_RUBY_BLOCK +
      podfile.slice(endIdx);

    cfg.modResults.contents = podfile;
    return cfg;
  });
};

module.exports = withFmtConstevalFix;
