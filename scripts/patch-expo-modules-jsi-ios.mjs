import fs from "node:fs";
import path from "node:path";
import process from "node:process";

if (process.platform !== "darwin") {
  process.exit(0);
}

const sqliteRoot = path.join(process.cwd(), "node_modules", "expo-sqlite");
for (const file of ["sqlite3.c", "sqlite3.h"]) {
  const sourcePath = path.join(sqliteRoot, "vendor", "sqlite3", file);
  const destinationPath = path.join(sqliteRoot, "ios", file);
  if (fs.existsSync(sourcePath) && !fs.existsSync(destinationPath)) {
    fs.copyFileSync(sourcePath, destinationPath);
    console.log(`[postinstall] Restored expo-sqlite iOS source: ${file}`);
  }
}

// Xcode can import Apple's sqlite3.h before ExpoSQLite's umbrella header.
// Expo's vendored header uses the same SQLITE3_H guard, which then hides all
// exsqlite3_* declarations from Swift. Give the vendored copy a unique guard.
// CocoaPods copies the vendor header over ios/sqlite3.h while evaluating the
// podspec, so patch the source as well as the existing iOS copy.
for (const sqliteHeaderPath of [path.join(sqliteRoot, "vendor", "sqlite3", "sqlite3.h"), path.join(sqliteRoot, "ios", "sqlite3.h")]) {
if (fs.existsSync(sqliteHeaderPath)) {
  const sqliteHeader = fs.readFileSync(sqliteHeaderPath, "utf8");
  const patchedSqliteHeader = sqliteHeader
    .replace("#ifndef SQLITE3_H\n#define SQLITE3_H", "#ifndef EXPO_SQLITE3_H\n#define EXPO_SQLITE3_H")
    .replace("#endif /* SQLITE3_H */", "#endif /* EXPO_SQLITE3_H */");

  if (patchedSqliteHeader !== sqliteHeader) {
    fs.writeFileSync(sqliteHeaderPath, patchedSqliteHeader);
    console.log("[postinstall] Patched expo-sqlite's iOS header guard.");
  }
}
}

const sqliteCModuleMapPath = path.join(sqliteRoot, "ios", "ExpoSQLiteC.modulemap");
const sqliteCHeaderPath = path.join(sqliteRoot, "ios", "ExpoSQLiteC.h");
const sqliteVendorHeaderPath = path.join(sqliteRoot, "vendor", "sqlite3", "sqlite3.h");
if (fs.existsSync(sqliteVendorHeaderPath)) {
  const sqliteCHeader = fs
    .readFileSync(sqliteVendorHeaderPath, "utf8")
    .replace("#ifndef SQLITE3_H\n#define SQLITE3_H", "#ifndef EXPO_SQLITE3_H\n#define EXPO_SQLITE3_H")
    .replace("#endif /* SQLITE3_H */", "#endif /* EXPO_SQLITE3_H */");
  if (
    !fs.existsSync(sqliteCHeaderPath) ||
    fs.readFileSync(sqliteCHeaderPath, "utf8") !== sqliteCHeader
  ) {
    fs.writeFileSync(sqliteCHeaderPath, sqliteCHeader);
    console.log("[postinstall] Created ExpoSQLite's explicit C header.");
  }
}
const sqliteCModuleMap = `module ExpoSQLiteC {
  header "ExpoSQLiteC.h"
  export *
}
`;
if (
  fs.existsSync(sqliteRoot) &&
  (!fs.existsSync(sqliteCModuleMapPath) ||
    fs.readFileSync(sqliteCModuleMapPath, "utf8") !== sqliteCModuleMap)
) {
  fs.writeFileSync(sqliteCModuleMapPath, sqliteCModuleMap);
  console.log("[postinstall] Created ExpoSQLite's explicit C module map.");
}

const sqliteModulePath = path.join(sqliteRoot, "ios", "SQLiteModule.swift");
if (fs.existsSync(sqliteModulePath)) {
  let sqliteModule = fs.readFileSync(sqliteModulePath, "utf8");
  if (sqliteModule.includes("\nimport ExpoSQLiteC")) {
    sqliteModule = sqliteModule.replace(
      "\nimport ExpoSQLiteC",
      "\n@_implementationOnly import ExpoSQLiteC"
    );
    fs.writeFileSync(sqliteModulePath, sqliteModule);
    console.log("[postinstall] Restricted ExpoSQLite's C module to its implementation.");
  } else if (!sqliteModule.includes("import ExpoSQLiteC")) {
    fs.writeFileSync(
      sqliteModulePath,
      sqliteModule.replace(
        "import ExpoModulesCore",
        "import ExpoModulesCore\n@_implementationOnly import ExpoSQLiteC"
      )
    );
    console.log("[postinstall] Patched ExpoSQLite's explicit C module import.");
  }
}

const sqlitePodspecPath = path.join(sqliteRoot, "ios", "ExpoSQLite.podspec");
if (fs.existsSync(sqlitePodspecPath)) {
  const sqlitePodspec = fs.readFileSync(sqlitePodspecPath, "utf8");
  const swiftFlagsAnchor =
    "  swift_flags = sqlite_cflags.split(' ').map { |flag| \"-Xcc #{flag}\" }.join(' ')";
  const forcedHeaderFlag =
    "  swift_flags += \" -Xcc -include -Xcc #{File.join(__dir__, 'sqlite3.h')}\"";
  const cModuleMapFlag =
    "  swift_flags += \" -Xcc -fmodule-map-file=#{File.join(__dir__, 'ExpoSQLiteC.modulemap')}\"";

  if (!sqlitePodspec.includes(forcedHeaderFlag)) {
    if (!sqlitePodspec.includes(swiftFlagsAnchor)) {
      console.warn("[postinstall] ExpoSQLite Swift flags anchor not found; patch skipped.");
    } else {
      fs.writeFileSync(
        sqlitePodspecPath,
        sqlitePodspec.replace(swiftFlagsAnchor, `${swiftFlagsAnchor}\n${forcedHeaderFlag}`)
      );
      console.log("[postinstall] Patched ExpoSQLite's Swift header import.");
    }
  }

  const currentSqlitePodspec = fs.readFileSync(sqlitePodspecPath, "utf8");
  if (!currentSqlitePodspec.includes(cModuleMapFlag)) {
    const moduleAnchor = currentSqlitePodspec.includes(forcedHeaderFlag)
      ? forcedHeaderFlag
      : swiftFlagsAnchor;
    fs.writeFileSync(
      sqlitePodspecPath,
      currentSqlitePodspec.replace(moduleAnchor, `${moduleAnchor}\n${cModuleMapFlag}`)
    );
    console.log("[postinstall] Patched ExpoSQLite's explicit C module map flag.");
  }
}

const scriptPath = path.join(
  process.cwd(),
  "node_modules",
  "expo-modules-jsi",
  "apple",
  "scripts",
  "build-xcframework.sh"
);

if (!fs.existsSync(scriptPath)) {
  process.exit(0);
}

let source = fs.readFileSync(scriptPath, "utf8");
let changed = false;

const signingAnchor = "    CLANG_COVERAGE_MAPPING=NO \\\n  )";
if (!source.includes("    CODE_SIGNING_ALLOWED=NO \\")) {
  if (!source.includes(signingAnchor)) {
    console.warn("[postinstall] ExpoModulesJSI signing anchor not found; patch skipped.");
    process.exit(0);
  }
  source = source.replace(
    signingAnchor,
    "    CLANG_COVERAGE_MAPPING=NO \\\n    CODE_SIGNING_ALLOWED=NO \\\n    CODE_SIGNING_REQUIRED=NO \\\n  )"
  );
  changed = true;
}

const frameworkAnchor = `  if [[ ! -d "$framework_src" ]]; then
    log "error: xcodebuild did not produce \${framework_src}"
    exit 1
  fi`;
if (!source.includes('  xattr -cr "$framework_src" 2>/dev/null || true')) {
  if (!source.includes(frameworkAnchor)) {
    console.warn("[postinstall] ExpoModulesJSI framework anchor not found; metadata patch skipped.");
  } else {
    source = source.replace(
      frameworkAnchor,
      `${frameworkAnchor}

  # Synced Documents folders can attach Finder metadata that framework signing rejects.
  xattr -cr "$framework_src" 2>/dev/null || true`
    );
    changed = true;
  }
}

const sliceAnchor = '  mv "$staging_dir" "$slice_dir"';
if (!source.includes('  xattr -cr "$slice_dir" 2>/dev/null || true')) {
  if (!source.includes(sliceAnchor)) {
    console.warn("[postinstall] ExpoModulesJSI slice anchor not found; metadata patch skipped.");
  } else {
    source = source.replace(
      sliceAnchor,
      `${sliceAnchor}
  xattr -cr "$slice_dir" 2>/dev/null || true`
    );
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(scriptPath, source);
  console.log("[postinstall] Patched ExpoModulesJSI for macOS File Provider metadata.");
}
