import Foundation

/// Public-paper links are opened outside the editor, never as privileged pages.
enum LiteraturePolicy {
    // WebKit's content blocker uses a restricted regex dialect: keep the two
    // read-only endpoint patterns separate, and never exempt the whole host.
    static let lookupPatterns = [
        "^https://www[.]ebi[.]ac[.]uk/europepmc/webservices/rest/search[?]query=[^&]+&format=json&pageSize=5&resultType=core$",
        "^https://www[.]ebi[.]ac[.]uk/europepmc/webservices/rest/PMC[1-9][0-9]*/fullTextXML$"
    ]

    static func isPaperLink(_ url: URL?) -> Bool {
        guard let url, url.absoluteString.count <= 2048,
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "https", parts.user == nil, parts.password == nil,
              parts.port == nil || parts.port == 443, parts.query == nil else { return false }
        let path = parts.path
        if parts.host == "europepmc.org" {
            guard parts.percentEncodedPath == path,
                  matches(path, "^/articles/PMC[1-9][0-9]{0,11}$") || matches(path, "^/article/MED/[1-9][0-9]{0,11}$") else { return false }
            return parts.fragment == nil || matches(parts.fragment!, "^[A-Za-z][A-Za-z0-9_.:-]{0,119}$")
        }
        return parts.host == "doi.org" && parts.fragment == nil && path.count <= 241
            && !path.contains("..") && matches(path, "^/10[.][0-9]{4,9}/[A-Za-z0-9._;()/:+\\-]+$")
    }

    private static func matches(_ value: String, _ pattern: String) -> Bool {
        guard let range = value.range(of: pattern, options: .regularExpression) else { return false }
        return range == value.startIndex..<value.endIndex
    }

    /// Executed by the existing simulator smoke suite as part of its pass gate.
    static func selfChecks() -> [String: Bool] {
        let accepted = ["https://europepmc.org/articles/PMC12345", "https://europepmc.org/articles/PMC12345#Fig-2",
                        "https://europepmc.org/article/MED/12345", "https://doi.org/10.1234/example.5",
                        "https://doi.org/10.1234%2Fexample.5"]
        let rejected = ["http://europepmc.org/articles/PMC12345", "https://europepmc.org.evil.invalid/articles/PMC12345",
                        "https://evil.invalid@europepmc.org/articles/PMC12345", "https://europepmc.org:8443/articles/PMC12345",
                        "https://europepmc.org/articles/PMC12345?next=https://evil.invalid", "https://europepmc.org/articles/PMC12345#%0Aalert",
                        "https://europepmc.org/articles/PMC0", "https://europepmc.org/articles/%50MC12345",
                        "https://doi.org/10.1234/../private", "https://doi.org/10.1234/example?token=private",
                        "file:///private/data", "javascript:alert(1)"]
        let lookupAccepted = ["https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=%28%22box+plot%22%29+AND+OPEN_ACCESS%3AY&format=json&pageSize=5&resultType=core",
                              "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12345/fullTextXML"]
        let lookupRejected = ["https://www.ebi.ac.uk/anything", "https://www.ebi.ac.uk.evil.invalid/europepmc/webservices/rest/PMC12345/fullTextXML",
                              "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12345/fullTextXML?token=private",
                              "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12345/fullTextXML/extra",
                              "http://www.ebi.ac.uk/europepmc/webservices/rest/PMC12345/fullTextXML",
                              "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=box&format=json&pageSize=5&resultType=core&extra=private"]
        return ["literaturePaperLinksAllowed": accepted.allSatisfy { isPaperLink(URL(string: $0)) },
                "literatureUnsafeLinksRejected": rejected.allSatisfy { !isPaperLink(URL(string: $0)) },
                "literatureLookupRoutesAllowed": lookupAccepted.allSatisfy { value in lookupPatterns.contains { matches(value, $0) } },
                "literatureOtherRoutesRejected": lookupRejected.allSatisfy { value in !lookupPatterns.contains { matches(value, $0) } }]
    }
}
