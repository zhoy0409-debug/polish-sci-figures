import Cocoa
import CoreGraphics
import Foundation
import Vision

func privacyPrompt(_ file: String) throws -> Bool {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(url: URL(fileURLWithPath: file), options: [:]).perform([request])
    let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ").lowercased()
    return text.contains("local network") && text.contains("figure studio")
}

if CommandLine.arguments[1] == "--image" {
    let flag = try privacyPrompt(CommandLine.arguments[2])
    print("{\"localNetworkPromptDetected\":\(flag)}")
    exit(0)
}

let pid = Int32(CommandLine.arguments[1])!
let all = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
let windows = all.filter { row in
    let owner = (row[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value
    let layer = (row[kCGWindowLayer as String] as? NSNumber)?.intValue
    let bounds = row[kCGWindowBounds as String] as? [String: Any] ?? [:]
    return owner == pid && layer == 0 && (bounds["Width"] as? Double ?? 0) >= 500 && (bounds["Height"] as? Double ?? 0) >= 300
}.map { row -> [String: Any] in
    return ["windowID": row[kCGWindowNumber as String] ?? 0,
            "ownerPID": pid, "bounds": row[kCGWindowBounds as String] ?? [:],
            "onScreen": true]
}
var flag = false
if CommandLine.arguments.count > 2 { flag = try privacyPrompt(CommandLine.arguments[2]) }
let result: [String: Any] = ["screens": NSScreen.screens.count, "windows": windows,
                           "localNetworkPromptDetected": flag]
let data = try! JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
print(String(data: data, encoding: .utf8)!)
exit(NSScreen.screens.count > 0 && !windows.isEmpty && !flag ? 0 : 1)
