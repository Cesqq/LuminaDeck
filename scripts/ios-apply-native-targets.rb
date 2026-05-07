#!/usr/bin/env ruby
# frozen_string_literal: true
#
# scripts/ios-apply-native-targets.rb
#
# Patches the Expo-prebuilt Xcode project at apps/mobile/ios/LuminaDeck.xcodeproj
# to add the three Phase-B native targets:
#
#   * LuminaDeckWidget    — WidgetKit extension (B1: Control Center / Lock Screen)
#   * LuminaDeckWatch     — watchOS companion app (B3: 6-slot grid)
#   * (Siri)              — Vocal shortcut source is added to the main app +
#                           widget extension (no separate target).
#
# Idempotent: re-running is safe. Runs on the Mac after `expo prebuild
# --platform ios --clean` and before `xcodebuild archive`. The prebuild
# `--clean` flag wipes the ios/ dir on every run, so this script is part
# of the archive pipeline (see scripts/ios-archive-and-upload.sh).
#
# No `expo-apple-targets` involvement — we talk to the pbxproj directly
# via the `xcodeproj` Ruby gem (already installed as a CocoaPods
# dependency; if missing, `gem install --user-install xcodeproj`).

require 'xcodeproj'
require 'fileutils'
require 'json'

REPO = ENV['REPO_ROOT'] || "#{ENV['HOME']}/LuminaDeck"
MOBILE = "#{REPO}/apps/mobile"
IOS = "#{MOBILE}/ios"
PROJECT_PATH = "#{IOS}/LuminaDeck.xcodeproj"
SRC = "#{MOBILE}/targets"

TEAM_ID = '7A2K2PDKW4'
APP_GROUP = 'group.com.luminadeck.shared'
MAIN_BUNDLE_ID = 'com.luminadeck.app'
WIDGET_BUNDLE_ID = "#{MAIN_BUNDLE_ID}.widget"
WATCH_BUNDLE_ID = "#{MAIN_BUNDLE_ID}.watchkitapp"
APP_CONFIG = JSON.parse(File.read("#{MOBILE}/app.json")).fetch('expo')
APP_VERSION = ENV['APP_VERSION'] || APP_CONFIG['version'] || '1.3.2'
BUILD_NUMBER = ENV['BUILD_NUMBER'] || APP_CONFIG.dig('ios', 'buildNumber') || '1'

# Launch-safe default: keep the shipped iPhone app free of optional native
# extension entitlements unless they are explicitly enabled for an archive.
# TestFlight builds can crash before main() with "Code Signature Invalid" when
# App Groups / widget App IDs / keychain groups are present in the app's
# entitlements but not actually included in the provisioning profile. Build 4
# enabled these by default; build 5 should opt in only after the portal IDs and
# profiles are verified.
ENABLE_WIDGET = ENV['ENABLE_WIDGET'] == '1'
ENABLE_APP_GROUP = ENABLE_WIDGET || ENV['ENABLE_APP_GROUP'] == '1'

abort "project not found at #{PROJECT_PATH}" unless File.directory?(PROJECT_PATH)

project = Xcodeproj::Project.open(PROJECT_PATH)
main = project.targets.find { |t| t.name == 'LuminaDeck' } or
  abort 'main target "LuminaDeck" missing from project'

puts "[ios-apply-native-targets] opened #{PROJECT_PATH}"
puts "[ios-apply-native-targets] main target: #{main.name} (#{main.product_type})"

# Keep Xcode's project-level version settings aligned with Expo's generated
# Info.plist. Expo prebuild writes CFBundleShortVersionString/CFBundleVersion,
# but the pbxproj can still show stale MARKETING_VERSION/CURRENT_PROJECT_VERSION
# values. That makes it too easy to archive/upload the wrong-looking build.
main.build_configurations.each do |config|
  bs = config.build_settings
  bs['MARKETING_VERSION'] = APP_VERSION
  bs['CURRENT_PROJECT_VERSION'] = BUILD_NUMBER
  bs['GENERATE_INFOPLIST_FILE'] = 'NO'
  bs['INFOPLIST_FILE'] = 'LuminaDeck/Info.plist'
end

# Must run BEFORE any embed_extension calls — xcodeproj's add_dependency
# iterates existing deps and blows up on nil target references.
project.targets.each do |t|
  before = t.dependencies.size
  t.dependencies.delete_if { |d| d.target.nil? }
  after = t.dependencies.size
  puts "[ios-apply-native-targets]   pruned #{before - after} dangling deps from #{t.name}" if after < before
end

# ---------------------------------------------------------------------------
# Entitlements helpers
# ---------------------------------------------------------------------------

def write_entitlements(path, groups: [], keychain_groups: [])
  lines = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
           '<plist version="1.0">', '<dict>']
  unless groups.empty?
    lines << "\t<key>com.apple.security.application-groups</key>"
    lines << "\t<array>"
    groups.each { |g| lines << "\t\t<string>#{g}</string>" }
    lines << "\t</array>"
  end
  unless keychain_groups.empty?
    lines << "\t<key>keychain-access-groups</key>"
    lines << "\t<array>"
    keychain_groups.each { |k| lines << "\t\t<string>#{k}</string>" }
    lines << "\t</array>"
  end
  lines << '</dict>'
  lines << '</plist>'
  File.write(path, lines.join("\n") + "\n")
end

MAIN_ENTITLEMENTS = "#{IOS}/LuminaDeck/LuminaDeck.entitlements"

# ---------------------------------------------------------------------------
# Helpers for adding a target idempotently
# ---------------------------------------------------------------------------

def ensure_group(project, name)
  project.main_group.find_subpath(name, true).tap do |g|
    g.set_source_tree('<group>')
    g.set_path(name)
  end
end

def copy_file_if_changed(src, dst)
  FileUtils.mkdir_p(File.dirname(dst))
  FileUtils.cp(src, dst)
end

def remove_existing_target!(project, name)
  old = project.targets.find { |t| t.name == name }
  return unless old
  old_product_uuid = old.product_reference&.uuid
  # Strip dependency + embed-phase references from every other target so
  # `dependency_for_target` stops tripping on dangling PBXReferenceProxy /
  # PBXTargetDependency entries when we next call add_dependency.
  project.targets.each do |t|
    next if t == old
    t.dependencies.delete_if { |d| d.target.nil? || d.target.uuid == old.uuid }
    t.copy_files_build_phases.each do |phase|
      phase.files.delete_if do |bf|
        ref = bf.file_ref
        ref.nil? || (old_product_uuid && ref.uuid == old_product_uuid)
      end
    end
  end
  old.remove_from_project
  puts "[ios-apply-native-targets]   removed pre-existing #{name} target"
end

# One-time sweep: prune broken dependency entries left over from earlier
# failed runs before we attempt to add_dependency anything new.
def prune_dangling_dependencies!(project)
  removed = 0
  project.targets.each do |t|
    before = t.dependencies.size
    t.dependencies.delete_if { |d| d.target.nil? }
    removed += (before - t.dependencies.size)
  end
  puts "[ios-apply-native-targets]   pruned #{removed} dangling dependency entries" if removed > 0
end

def add_source_file(project, group, target, repo_src, dest_path)
  copy_file_if_changed(repo_src, dest_path)
  fname = File.basename(dest_path)
  ref = group.files.find { |f| f.path == fname }
  ref ||= group.new_reference(fname)
  unless target.source_build_phase.files_references.include?(ref)
    target.add_file_references([ref])
  end
end

def remove_source_refs_from_target!(target, rel_paths)
  removed = 0
  target.source_build_phase.files.delete_if do |build_file|
    path = build_file.file_ref&.path
    hit = !path.nil? && rel_paths.include?(path)
    removed += 1 if hit
    hit
  end
  puts "[ios-apply-native-targets]   removed #{removed} optional main source refs" if removed > 0
end

def add_resource_file(project, group, target, repo_src, dest_path)
  copy_file_if_changed(repo_src, dest_path)
  fname = File.basename(dest_path)
  ref = group.files.find { |f| f.path == fname }
  ref ||= group.new_reference(fname)
  unless target.resources_build_phase.files_references.include?(ref)
    target.resources_build_phase.add_file_reference(ref)
  end
end

def embed_extension(main, ext_target, subfolder_spec_sym)
  phase_name = case subfolder_spec_sym
               when :plug_ins then 'Embed Foundation Extensions'
               when :products_directory then 'Embed Watch Content'
               else 'Embed Extensions'
               end
  embed = main.copy_files_build_phases.find { |p| p.name == phase_name }
  if embed.nil?
    embed = main.new_copy_files_build_phase(phase_name)
    embed.symbol_dst_subfolder_spec = subfolder_spec_sym
    if subfolder_spec_sym == :products_directory
      embed.dst_path = '$(CONTENTS_FOLDER_PATH)/Watch'
    end
  end
  unless embed.files_references.include?(ext_target.product_reference)
    build_file = embed.add_file_reference(ext_target.product_reference, true)
    build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  end
  add_target_dependency_safe(main, ext_target)
end

# Manual replacement for xcodeproj's `add_dependency` — its default impl
# tries to walk existing dependencies and dereference `.target` which
# errors with NoMethodError on nil when a previous run left a half-created
# PBXTargetDependency, and also chokes on cross-platform (iOS→watchOS)
# links on freshly-created targets. Build the PBXTargetDependency +
# PBXContainerItemProxy by hand instead.
def add_target_dependency_safe(host, dep_target)
  return if host.dependencies.any? { |d| d.target&.uuid == dep_target.uuid }
  project = host.project

  proxy = project.new(Xcodeproj::Project::Object::PBXContainerItemProxy)
  proxy.container_portal = project.root_object.uuid
  proxy.proxy_type = '1' # target proxy
  proxy.remote_global_id_string = dep_target.uuid
  proxy.remote_info = dep_target.name

  dependency = project.new(Xcodeproj::Project::Object::PBXTargetDependency)
  dependency.name = dep_target.name
  dependency.target = dep_target
  dependency.target_proxy = proxy

  host.dependencies << dependency
end

# ---------------------------------------------------------------------------
# Launch-safe entitlement / extension gate
# ---------------------------------------------------------------------------

if ENABLE_APP_GROUP
  # Merge App Group + keychain-access-groups into the main app entitlements
  # file the Expo template wrote. We rewrite the file from scratch so we
  # don't depend on the fiddly PlistBuddy commands.
  write_entitlements(
    MAIN_ENTITLEMENTS,
    groups: [APP_GROUP],
    keychain_groups: ["$(AppIdentifierPrefix)#{MAIN_BUNDLE_ID}"],
  )
  puts "[ios-apply-native-targets] rewrote #{MAIN_ENTITLEMENTS}"

  # Also make sure the main target's build settings point at the file for
  # every configuration. Expo usually already does this, but we re-assert.
  main.build_configurations.each do |c|
    c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'LuminaDeck/LuminaDeck.entitlements'
    c.build_settings['DEVELOPMENT_TEAM'] = TEAM_ID
  end
else
  # If the previous prebuild/archive pass generated entitlements, remove them
  # and clear CODE_SIGN_ENTITLEMENTS so the host app does not claim unverified
  # App Group / keychain capabilities. This is the safest default for launch.
  if File.exist?(MAIN_ENTITLEMENTS)
    FileUtils.rm_f(MAIN_ENTITLEMENTS)
    puts "[ios-apply-native-targets] removed #{MAIN_ENTITLEMENTS} (set ENABLE_APP_GROUP=1 to keep)"
  end
  main.build_configurations.each do |c|
    c.build_settings.delete('CODE_SIGN_ENTITLEMENTS')
    c.build_settings['DEVELOPMENT_TEAM'] = TEAM_ID
  end
end

unless ENABLE_WIDGET
  puts '[ios-apply-native-targets] skipping widget/watch/siri native targets (set ENABLE_WIDGET=1 after App Group + widget App ID are provisioned)'
  optional_main_sources = [
    'LuminaDeck/VoiceShortcutIntent.swift',
    'LuminaDeck/CompanionEndpoint.swift',
    'LuminaDeck/AppGroupBridge.swift',
    'LuminaDeck/AppGroupBridge.m',
    'LuminaDeck/WatchSessionBridge.swift',
    'LuminaDeck/WatchSessionBridge.m',
  ]
  remove_source_refs_from_target!(main, optional_main_sources)
  optional_main_sources.each { |rel| FileUtils.rm_f("#{IOS}/#{rel}") }
  remove_existing_target!(project, 'LuminaDeckWidget')
  remove_existing_target!(project, 'LuminaDeckWatch')
  project.save
  puts "[ios-apply-native-targets] ✓ project saved (main app only)"
  exit 0
end

# ---------------------------------------------------------------------------
# Widget extension target
# ---------------------------------------------------------------------------

puts "[ios-apply-native-targets] == widget target =="

widget_dir = "#{IOS}/LuminaDeckWidget"
FileUtils.mkdir_p(widget_dir)

# Clean-slate approach: remove any pre-existing target so re-runs don't
# accumulate duplicate build phases. The source files on disk stay; they
# just get re-linked into the freshly-created target below.
remove_existing_target!(project, 'LuminaDeckWidget')

widget_target = project.new_target(
  :app_extension,
  'LuminaDeckWidget',
  :ios,
  '17.0',
  nil,
  :swift,
)

widget_group = ensure_group(project, 'LuminaDeckWidget')

# Write widget entitlements (App Group + Keychain sharing with main app)
widget_entitlements = "#{widget_dir}/LuminaDeckWidget.entitlements"
write_entitlements(
  widget_entitlements,
  groups: [APP_GROUP],
  keychain_groups: ["$(AppIdentifierPrefix)#{MAIN_BUNDLE_ID}"],
)

# Copy Swift + Info.plist into ios/LuminaDeckWidget/ and register each
add_source_file(project, widget_group, widget_target,
                "#{SRC}/widget/LuminaDeckWidget.swift",
                "#{widget_dir}/LuminaDeckWidget.swift")
add_source_file(project, widget_group, widget_target,
                "#{SRC}/widget/AppIntent.swift",
                "#{widget_dir}/AppIntent.swift")

# Shared CompanionEndpoint.swift (HMAC POST + Keychain helper) — added to
# BOTH widget and main app so both intent call-sites share one
# implementation. We copy it into each target's source dir so file paths
# resolve correctly; the two copies are byte-identical and get the same
# updates from targets/shared/.
add_source_file(project, widget_group, widget_target,
                "#{SRC}/shared/CompanionEndpoint.swift",
                "#{widget_dir}/CompanionEndpoint.swift")

# Siri source lives in targets/siri/ and is shared between main + widget
# (the vocal-shortcut intent reuses the widget's CompanionEndpoint helper).
add_source_file(project, widget_group, widget_target,
                "#{SRC}/siri/VoiceShortcutIntent.swift",
                "#{widget_dir}/VoiceShortcutIntent.swift")

# Info.plist is a reference, not a source file
info_ref = widget_group.files.find { |f| f.path == 'Info.plist' } ||
           widget_group.new_reference('Info.plist')
FileUtils.cp("#{SRC}/widget/Info.plist", "#{widget_dir}/Info.plist")
_ = info_ref # Info.plist is referenced via INFOPLIST_FILE build setting, not a phase

# Ensure the entitlements file is a project reference too so Xcode shows it
ents_ref = widget_group.files.find { |f| f.path == 'LuminaDeckWidget.entitlements' } ||
           widget_group.new_reference('LuminaDeckWidget.entitlements')
_ = ents_ref

# Frameworks
['WidgetKit', 'SwiftUI', 'AppIntents'].each do |fw|
  widget_target.add_system_framework(fw)
end

# Per-configuration build settings
widget_target.build_configurations.each do |config|
  bs = config.build_settings
  bs['PRODUCT_BUNDLE_IDENTIFIER']     = WIDGET_BUNDLE_ID
  bs['PRODUCT_NAME']                  = '$(TARGET_NAME)'
  bs['INFOPLIST_FILE']                = 'LuminaDeckWidget/Info.plist'
  bs['CODE_SIGN_ENTITLEMENTS']        = 'LuminaDeckWidget/LuminaDeckWidget.entitlements'
  bs['DEVELOPMENT_TEAM']              = TEAM_ID
  bs['CODE_SIGN_STYLE']               = 'Automatic'
  bs['IPHONEOS_DEPLOYMENT_TARGET']    = '17.0'
  bs['SWIFT_VERSION']                 = '5.0'
  bs['TARGETED_DEVICE_FAMILY']        = '1,2'
  bs['SKIP_INSTALL']                  = 'YES'
  bs['LD_RUNPATH_SEARCH_PATHS']       = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
  bs['GENERATE_INFOPLIST_FILE']       = 'NO'
  bs['MARKETING_VERSION']             = APP_VERSION
  bs['CURRENT_PROJECT_VERSION']       = BUILD_NUMBER
end

embed_extension(main, widget_target, :plug_ins)

puts "[ios-apply-native-targets]   widget target wired (bundle: #{WIDGET_BUNDLE_ID})"

# ---------------------------------------------------------------------------
# Siri source added to main app target
# ---------------------------------------------------------------------------

puts "[ios-apply-native-targets] == siri source (main app) =="

# Expo's prebuilt project keeps its source file references at the project-
# root group level with the full path baked into `ref.path` (e.g.
# "LuminaDeck/AppDelegate.swift"). We mirror that pattern so Xcode
# resolves the file relative to ios/ (the project root).
siri_rel = 'LuminaDeck/VoiceShortcutIntent.swift'
siri_dest = "#{IOS}/#{siri_rel}"
copy_file_if_changed("#{SRC}/siri/VoiceShortcutIntent.swift", siri_dest)

# Drop any stale refs from previous runs that pointed at the wrong path
# (earlier versions of this script added the file as a bare
# "VoiceShortcutIntent.swift" at project root). Remove them from every
# build phase AND the underlying file references.
stale_uuids = []
project.files.each do |f|
  next unless f.path == 'VoiceShortcutIntent.swift'
  stale_uuids << f.uuid
end
unless stale_uuids.empty?
  project.targets.each do |t|
    t.source_build_phase.files.delete_if do |bf|
      bf.file_ref.nil? || stale_uuids.include?(bf.file_ref.uuid)
    end
  end
  project.files.each { |f| f.remove_from_project if stale_uuids.include?(f.uuid) }
  puts "[ios-apply-native-targets]   pruned #{stale_uuids.size} stale VoiceShortcutIntent.swift refs"
end

existing = project.main_group.files.find { |f| f.path == siri_rel }
ref = existing || project.main_group.new_reference(siri_rel)
unless main.source_build_phase.files_references.include?(ref)
  main.add_file_references([ref])
end
puts "[ios-apply-native-targets]   VoiceShortcutIntent.swift → main app (#{siri_rel})"

# CompanionEndpoint.swift is also needed by the main app (VoiceShortcutIntent
# references CompanionEndpoint). Same project-root-relative path pattern.
companion_rel = 'LuminaDeck/CompanionEndpoint.swift'
companion_dest = "#{IOS}/#{companion_rel}"
copy_file_if_changed("#{SRC}/shared/CompanionEndpoint.swift", companion_dest)

existing_companion = project.main_group.files.find { |f| f.path == companion_rel }
companion_ref = existing_companion || project.main_group.new_reference(companion_rel)
unless main.source_build_phase.files_references.include?(companion_ref)
  main.add_file_references([companion_ref])
end
puts "[ios-apply-native-targets]   CompanionEndpoint.swift → main app (#{companion_rel})"

# AppGroupBridge — Swift native module that lets RN JS write pinned tiles
# into the App Group UserDefaults that the widget reads. Needs BOTH the
# .swift implementation AND a matching .m bridge file for RCT_EXTERN_MODULE
# registration. The widget target does NOT need this file — widgets read
# UserDefaults directly without the RN bridge.
{
  'LuminaDeck/AppGroupBridge.swift'      => "#{SRC}/shared/AppGroupBridge.swift",
  'LuminaDeck/AppGroupBridge.m'          => "#{SRC}/shared/AppGroupBridge.m",
  # v1.4: WCSession event-emitter bridge that relays Watch taps,
  # trackpad mouse events, and Scribble/keyboard text to RN. The Swift
  # class extends RCTEventEmitter so the .m uses RCT_EXTERN_REMAP_MODULE.
  'LuminaDeck/WatchSessionBridge.swift'  => "#{SRC}/shared/WatchSessionBridge.swift",
  'LuminaDeck/WatchSessionBridge.m'      => "#{SRC}/shared/WatchSessionBridge.m",
}.each do |rel, src_path|
  dest = "#{IOS}/#{rel}"
  copy_file_if_changed(src_path, dest)
  existing_bridge = project.main_group.files.find { |f| f.path == rel }
  bridge_ref = existing_bridge || project.main_group.new_reference(rel)
  unless main.source_build_phase.files_references.include?(bridge_ref)
    main.add_file_references([bridge_ref])
  end
  puts "[ios-apply-native-targets]   #{File.basename(rel)} → main app (#{rel})"
end

# RN needs a Bridging Header entry for Swift ↔ ObjC interop. Expo's prebuild
# already creates `LuminaDeck-Bridging-Header.h`; the SWIFT_OBJC_BRIDGING_HEADER
# build setting is already set. No action needed here — the .m file imports
# `<React/RCTBridgeModule.h>` via the React pod dependency.

# ---------------------------------------------------------------------------
# watchOS app target
# ---------------------------------------------------------------------------

puts "[ios-apply-native-targets] == watch target =="

# Watch target is OPT-IN until the AppIcon.appiconset generation is
# wired (ASC rejects archives without a watch AppIcon + CFBundleIconName
# key — error codes 90391 + 90713). Swift source compiles cleanly; only
# icon assets are missing. Re-enable with ENABLE_WATCH=1 once the
# asset-catalog code path in this script is finished.
unless ENV['ENABLE_WATCH'] == '1'
  puts '[ios-apply-native-targets]   skipping watch target (set ENABLE_WATCH=1 to opt in after watch icons are wired)'
  remove_existing_target!(project, 'LuminaDeckWatch')
  project.save
  puts "[ios-apply-native-targets] ✓ project saved (widget + siri only)"
  exit 0
end

watch_dir = "#{IOS}/LuminaDeckWatch"
FileUtils.mkdir_p(watch_dir)

remove_existing_target!(project, 'LuminaDeckWatch')

# Modern watchOS 7+ uses a single-target unified app (product type
# `com.apple.product-type.application` with SDKROOT=watchos), NOT the
# legacy two-target `watchapp2` + extension split. xcodeproj's
# `:watch2_app` creates the legacy product type which fails to build on
# modern watchOS SDKs with "Multiple commands produce" errors — stick to
# `:application` and set SDKROOT manually below.
watch_target = project.new_target(
  :application,
  'LuminaDeckWatch',
  :watchos,
  '10.0',
  nil,
  :swift,
)

watch_group = ensure_group(project, 'LuminaDeckWatch')

# Minimal watch Info.plist
watch_info = "#{watch_dir}/Info.plist"
File.write(watch_info, <<~PLIST)
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
    <key>CFBundleDevelopmentRegion</key><string>en</string>
    <key>CFBundleDisplayName</key><string>LuminaDeck Watch</string>
    <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key><string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key><string>#{APP_VERSION}</string>
    <key>CFBundleVersion</key><string>#{BUILD_NUMBER}</string>
    <key>LSRequiresIPhoneOS</key><true/>
    <key>WKApplication</key><true/>
    <key>WKCompanionAppBundleIdentifier</key><string>#{MAIN_BUNDLE_ID}</string>
    <key>WKWatchOnly</key><false/>
    <key>UIApplicationSceneManifest</key>
    <dict>
      <key>UIApplicationSupportsMultipleScenes</key><false/>
    </dict>
  </dict>
  </plist>
PLIST

add_source_file(project, watch_group, watch_target,
                "#{SRC}/watch/ContentView.swift",
                "#{watch_dir}/ContentView.swift")
add_source_file(project, watch_group, watch_target,
                "#{SRC}/watch/WatchBridge.swift",
                "#{watch_dir}/WatchBridge.swift")
# v1.4: Trackpad face + Scribble/keyboard input view, both swiped to
# from the wrist deck via the verticalPage TabView in ContentView.
add_source_file(project, watch_group, watch_target,
                "#{SRC}/watch/TrackpadView.swift",
                "#{watch_dir}/TrackpadView.swift")
add_source_file(project, watch_group, watch_target,
                "#{SRC}/watch/ScribbleView.swift",
                "#{watch_dir}/ScribbleView.swift")

# Frameworks
['SwiftUI', 'WatchKit', 'WatchConnectivity'].each do |fw|
  watch_target.add_system_framework(fw)
end

watch_target.build_configurations.each do |config|
  bs = config.build_settings
  bs['PRODUCT_BUNDLE_IDENTIFIER']     = WATCH_BUNDLE_ID
  bs['PRODUCT_NAME']                  = '$(TARGET_NAME)'
  bs['INFOPLIST_FILE']                = 'LuminaDeckWatch/Info.plist'
  bs['DEVELOPMENT_TEAM']              = TEAM_ID
  bs['CODE_SIGN_STYLE']               = 'Automatic'
  bs['WATCHOS_DEPLOYMENT_TARGET']     = '10.0'
  bs['SWIFT_VERSION']                 = '5.0'
  bs['TARGETED_DEVICE_FAMILY']        = '4'                # Watch
  bs['SDKROOT']                       = 'watchos'
  bs['SKIP_INSTALL']                  = 'YES'
  bs['GENERATE_INFOPLIST_FILE']       = 'NO'
  bs['SUPPORTED_PLATFORMS']           = 'watchos watchsimulator'
  bs['MARKETING_VERSION']             = APP_VERSION
  bs['CURRENT_PROJECT_VERSION']       = BUILD_NUMBER
  bs['LD_RUNPATH_SEARCH_PATHS']       = '$(inherited) @executable_path/Frameworks'
end

embed_extension(main, watch_target, :products_directory)

puts "[ios-apply-native-targets]   watch target wired (bundle: #{WATCH_BUNDLE_ID})"

# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------

project.save
puts "[ios-apply-native-targets] ✓ project saved"
