package org.polishscifigures.studio.preview;

/** Also runnable with plain javac on hosts without an Android SDK. */
final class LiteraturePolicyChecks {
    public static void main(String[] args) { run(); System.out.println("Literature native URL policy: all checks passed"); }
    static void run() {
        String api = "https://www.ebi.ac.uk/europepmc/webservices/rest/";
        String search = api + "search?query=%28%22box+plot%22%29+AND+OPEN_ACCESS%3AY&format=json&pageSize=5&resultType=core";
        String full = api + "PMC12345/fullTextXML";
        check(LiteraturePolicy.allowsLookup(search, "GET", false), "The explicit search route must work");
        check(LiteraturePolicy.allowsLookup(full, "GET", false), "Caption verification must work");
        check(!LiteraturePolicy.allowsLookup(search, "POST", false), "Do not grant data upload");
        check(!LiteraturePolicy.allowsLookup(search, "GET", true), "Do not navigate the app to the API");
        String[] unsafeLookups = {
            "http://www.ebi.ac.uk/europepmc/webservices/rest/PMC12345/fullTextXML", api + "PMC12345/fullTextXML?token=secret",
            api + "PMC12345/fullTextXML/extra", api + "%50MC12345/fullTextXML", api + "PMC0/fullTextXML",
            "https://www.ebi.ac.uk.evil.invalid/europepmc/webservices/rest/PMC12345/fullTextXML",
            "https://secret@www.ebi.ac.uk/europepmc/webservices/rest/PMC12345/fullTextXML",
            "https://www.ebi.ac.uk:8443/europepmc/webservices/rest/PMC12345/fullTextXML",
            search + "&extra=secret", search + "&query=secret", search.replace("pageSize=5", "pageSize=1000"),
            search.replace("query=%28%22box+plot%22%29+AND+OPEN_ACCESS%3AY", "query=%0A%0A"), search + "#fragment",
            "https://www.ebi.ac.uk/upload", "https://example.invalid/", "file:///private/project.json"
        };
        for (String value : unsafeLookups) check(!LiteraturePolicy.allowsLookup(value, "GET", false), "Rejected lookup: " + value);
        String[] papers = {"https://europepmc.org/articles/PMC12345", "https://europepmc.org/articles/PMC12345#Fig-2",
            "https://europepmc.org/articles/PMC12345#fig%3A2", "https://europepmc.org/article/MED/12345",
            "https://doi.org/10.1234/example.5", "https://doi.org/10.1234%2Fexample.5"};
        for (String value : papers) check(LiteraturePolicy.isPaperLink(value), "Open public paper: " + value);
        String[] unsafePapers = {"http://europepmc.org/articles/PMC12345", "https://europepmc.org.evil.invalid/articles/PMC12345",
            "https://secret@europepmc.org/articles/PMC12345", "https://europepmc.org:8443/articles/PMC12345",
            "https://europepmc.org/articles/PMC12345?next=https://evil.invalid", "https://europepmc.org/articles/PMC12345#%0Aalert",
            "https://europepmc.org/articles/PMC0", "https://europepmc.org/articles/%50MC12345",
            "https://doi.org/10.1234/../private", "https://doi.org/10.1234/example?token=private",
            "https://doi.org/10.1234/example#fragment", "javascript:alert(1)", "file:///private/data"};
        for (String value : unsafePapers) check(!LiteraturePolicy.isPaperLink(value), "Rejected paper URL: " + value);
    }
    private static void check(boolean actual, String message) { if (!actual) throw new AssertionError(message); }
}
