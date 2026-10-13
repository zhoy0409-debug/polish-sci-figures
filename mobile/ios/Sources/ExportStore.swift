import Foundation

enum ExportFailure: LocalizedError {
    case invalid(String)
    var errorDescription: String? { if case .invalid(let text) = self { return text }; return nil }
}

/// A single bounded disk stream; source research data is never sent over HTTP.
final class ExportStore {
    static let maximumBytes = 256 * 1024 * 1024
    static let chunkBytes = 256 * 1024
    private let directory: URL
    private(set) var id: String?
    private(set) var file: URL?
    private(set) var expected = 0
    private(set) var written = 0
    private var handle: FileHandle?
    private var sequence = 0

    init(directory: URL = FileManager.default.temporaryDirectory.appendingPathComponent("FigureStudioExports", isDirectory: true)) throws {
        self.directory = directory
        // This fixed application-private directory contains only our transient exports.
        if FileManager.default.fileExists(atPath: directory.path) { try FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    static func safeName(_ value: String) throws -> String {
        let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, clean.utf8.count <= 180, clean != ".", clean != "..",
              !clean.contains("/"), !clean.contains("\\"),
              clean.unicodeScalars.allSatisfy({ !CharacterSet.controlCharacters.contains($0) }) else {
            throw ExportFailure.invalid("Invalid export filename / 导出文件名无效")
        }
        return clean
    }

    func begin(name: String, bytes: Int) throws -> String {
        guard id == nil, bytes >= 0, bytes <= Self.maximumBytes else { throw ExportFailure.invalid("Export busy or too large (256 MiB maximum) / 导出忙碌或文件过大（最多 256 MiB）") }
        let safe = try Self.safeName(name)
        let token = UUID().uuidString
        let folder = directory.appendingPathComponent(token, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let target = folder.appendingPathComponent(safe)
        guard FileManager.default.createFile(atPath: target.path, contents: nil) else { throw ExportFailure.invalid("Cannot prepare export file / 无法准备导出文件") }
        handle = try FileHandle(forWritingTo: target)
        id = token; file = target; expected = bytes; written = 0; sequence = 0
        return token
    }

    func append(id token: String, index: Int, base64: String) throws -> Int {
        guard token == id, index == sequence, base64.utf8.count <= ((Self.chunkBytes + 2) / 3) * 4,
              let data = Data(base64Encoded: base64), !data.isEmpty, data.count <= Self.chunkBytes,
              written + data.count <= expected, let handle else { throw ExportFailure.invalid("Invalid export chunk / 导出分块无效") }
        try handle.write(contentsOf: data)
        written += data.count; sequence += 1
        return written
    }

    func finish(id token: String) throws -> URL {
        guard token == id, expected == written, let file else { throw ExportFailure.invalid("Incomplete export / 导出内容不完整") }
        try handle?.synchronize(); try handle?.close(); handle = nil
        return file
    }

    func abort(id token: String? = nil) {
        guard token == nil || token == id else { return }
        try? handle?.close(); handle = nil
        if let file { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }
        id = nil; file = nil; expected = 0; written = 0; sequence = 0
    }
    deinit { abort() }
}
