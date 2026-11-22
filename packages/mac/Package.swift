// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AgentControlMenu",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "AgentControlMenu", path: "Sources/AgentControlMenu")
    ]
)
