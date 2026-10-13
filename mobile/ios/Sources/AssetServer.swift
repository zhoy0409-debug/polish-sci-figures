import Foundation
import Network

/// Serves immutable bundled public assets only. It has no research-data endpoint.
final class AssetServer {
    private let root: URL
    private let persistPort: Bool
    private let queue = DispatchQueue(label: "studio.local.assets", qos: .userInitiated)
    private var listener: NWListener?
    private var connections: [ObjectIdentifier: NWConnection] = [:]
    private var stopCallbacks: [() -> Void] = []
    private(set) var port: UInt16 = 0
    private(set) var requests = 0
    private(set) var rejectedRequests = 0
    var origin: String { "http://127.0.0.1:\(port)" }

    init(root: URL, persistPort: Bool = true) {
        self.root = root.standardizedFileURL.resolvingSymlinksInPath()
        self.persistPort = persistPort
    }

    func start(completion: @escaping (Result<URL, Error>) -> Void) {
        let remembered = persistPort ? UserDefaults.standard.integer(forKey: "studio.local.port.v1") : 0
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: UInt16(clamping: remembered))!)
        parameters.allowLocalEndpointReuse = true
        do {
            let current = try NWListener(using: parameters)
            listener = current
            var delivered = false
            current.stateUpdateHandler = { [weak self, weak current] state in
                guard let self, let current else { return }
                switch state {
                case .ready:
                    guard !delivered, let bound = current.port else { return }
                    delivered = true
                    self.port = bound.rawValue
                    if self.persistPort { UserDefaults.standard.set(Int(self.port), forKey: "studio.local.port.v1") }
                    DispatchQueue.main.async { completion(.success(URL(string: self.origin + "/index.html")!)) }
                case .failed(let error):
                    guard !delivered else { return }
                    delivered = true
                    DispatchQueue.main.async { completion(.failure(error)) }
                case .cancelled:
                    self.listener = nil
                    let callbacks = self.stopCallbacks; self.stopCallbacks.removeAll()
                    DispatchQueue.main.async { callbacks.forEach { $0() } }
                default: break
                }
            }
            current.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
            current.start(queue: queue)
        } catch { completion(.failure(error)) }
    }

    func stop(completion: (() -> Void)? = nil) {
        queue.async {
            if let completion { self.stopCallbacks.append(completion) }
            guard self.listener != nil else {
                let callbacks = self.stopCallbacks; self.stopCallbacks.removeAll()
                DispatchQueue.main.async { callbacks.forEach { $0() } }
                return
            }
            // Keep this server alive until cancellation is acknowledged. The
            // controller drops its old server before Retry, and the ordinary
            // listener handler intentionally holds only a weak reference.
            let stopping = self.listener!
            stopping.stateUpdateHandler = { [self, weak stopping] state in
                guard case .cancelled = state else { return }
                stopping?.stateUpdateHandler = nil
                self.listener = nil
                let callbacks = self.stopCallbacks; self.stopCallbacks.removeAll()
                DispatchQueue.main.async { callbacks.forEach { $0() } }
            }
            stopping.cancel()
            for connection in self.connections.values { connection.cancel() }
            self.connections.removeAll()
        }
    }

    func snapshot(_ completion: @escaping (Int, Int) -> Void) {
        queue.async {
            let values = (self.requests, self.rejectedRequests)
            DispatchQueue.main.async { completion(values.0, values.1) }
        }
    }

    private func accept(_ connection: NWConnection) {
        // Binding and peer checking are independent; no LAN interface is used.
        guard case .hostPort(let host, _) = connection.endpoint,
              host.debugDescription == "127.0.0.1", connections.count < 32 else { connection.cancel(); return }
        let key = ObjectIdentifier(connection)
        connections[key] = connection
        connection.stateUpdateHandler = { [weak self, weak connection] state in
            guard let connection else { return }
            if case .cancelled = state { self?.connections.removeValue(forKey: key) }
            if case .failed = state { connection.cancel() }
        }
        connection.start(queue: queue)
        queue.asyncAfter(deadline: .now() + 30) { [weak self, weak connection] in
            guard let self, let connection, self.connections[key] != nil else { return }
            connection.cancel()
        }
        receive(connection, buffered: Data())
    }

    private func receive(_ connection: NWConnection, buffered: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] content, _, done, error in
            guard let self else { return }
            var data = buffered
            if let content { data.append(content) }
            if data.count > 16384 { self.respond(connection, status: 431); return }
            if let end = data.range(of: Data("\r\n\r\n".utf8)) {
                self.serve(connection, headers: data[..<end.lowerBound], trailingBytes: data.count - end.upperBound)
            } else if done || error != nil { connection.cancel() }
            else { self.receive(connection, buffered: data) }
        }
    }

    static func assetURL(target: String, root: URL) -> URL? {
        guard target.hasPrefix("/"), !target.hasPrefix("//"),
              let raw = target.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false).first,
              let path = String(raw).removingPercentEncoding,
              !path.contains("\\"), !path.contains("\0"), !path.contains("#"),
              !path.split(separator: "/").contains(where: { $0 == "." || $0 == ".." || $0.hasPrefix(".") }) else { return nil }
        let normalizedRoot = root.standardizedFileURL.resolvingSymlinksInPath()
        let candidate = normalizedRoot.appendingPathComponent(path == "/" ? "index.html" : String(path.dropFirst())).standardizedFileURL.resolvingSymlinksInPath()
        guard candidate.path.hasPrefix(normalizedRoot.path + "/") else { return nil }
        return candidate
    }

    private func serve(_ connection: NWConnection, headers data: Data.SubSequence, trailingBytes: Int) {
        requests += 1
        guard let raw = String(data: data, encoding: .utf8) else { respond(connection, status: 400); return }
        let lines = raw.components(separatedBy: "\r\n")
        let request = lines[0].split(separator: " ")
        guard request.count == 3, request[2] == "HTTP/1.1" else { respond(connection, status: 400); return }
        let method = String(request[0])
        guard method == "GET" || method == "HEAD" else { respond(connection, status: 405); return }
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { respond(connection, status: 400); return }
            let key = line[..<colon].lowercased()
            guard headers[key] == nil else { respond(connection, status: 400); return }
            headers[key] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        }
        guard headers["host"] == "127.0.0.1:\(port)", trailingBytes == 0,
              headers["transfer-encoding"] == nil,
              headers["content-length"] == nil || headers["content-length"] == "0",
              headers["origin"] == nil || headers["origin"] == origin,
              headers["sec-fetch-site"] != "cross-site" else { respond(connection, status: 403); return }
        guard let url = Self.assetURL(target: String(request[1]), root: root),
              let resource = try? url.resourceValues(forKeys: [.isRegularFileKey]), resource.isRegularFile == true,
              let bytes = try? Data(contentsOf: url, options: .mappedIfSafe) else { respond(connection, status: 404); return }
        respond(connection, status: 200, data: bytes, mime: Self.mime(url), head: method == "HEAD")
    }

    static func mime(_ url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json"
        case "wasm": return "application/wasm"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "py", "txt": return "text/plain; charset=utf-8"
        case "zip", "whl": return "application/zip"
        default: return "application/octet-stream"
        }
    }

    private func respond(_ connection: NWConnection, status: Int, data: Data = Data(), mime: String = "text/plain", head: Bool = false) {
        if status != 200 { rejectedRequests += 1 }
        let phrase = [200: "OK", 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 431: "Request Header Fields Too Large"][status] ?? "Error"
        let headers = "HTTP/1.1 \(status) \(phrase)\r\nContent-Type: \(mime)\r\nContent-Length: \(data.count)\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nCross-Origin-Resource-Policy: same-origin\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://www.ebi.ac.uk; manifest-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'\r\n\r\n"
        connection.send(content: Data(headers.utf8), completion: .contentProcessed { error in
            guard error == nil, !head, !data.isEmpty else { connection.cancel(); return }
            // Network.framework keeps the mapped data alive until delivery; no second full copy.
            connection.send(content: data, isComplete: true, completion: .contentProcessed { _ in connection.cancel() })
        })
    }
}
