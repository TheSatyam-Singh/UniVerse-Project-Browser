#!/bin/sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
scratch=${UNIVERSE_CROSSCHECK_DIR:-$(mktemp -d -t universe-crosscheck)}
mkdir -p "$scratch"
swift build --package-path "$here/crosscheck" --scratch-path "$scratch/spm" -c release
tool=$(swift build --package-path "$here/crosscheck" --scratch-path "$scratch/spm" -c release --show-bin-path)/CrossCheck
"$tool" write "$scratch/swift-wrote"
"$here/../gradlew" -p "$here/.." --console=plain :sync:testDebugUnitTest --tests com.universe.projectbrowser.sync.core.SwiftCrossCheckTest \
  "-Duniverse.crossCheck.swiftWrote=$scratch/swift-wrote" "-Duniverse.crossCheck.kotlinWrites=$scratch/kotlin-wrote"
"$tool" read "$scratch/kotlin-wrote"
