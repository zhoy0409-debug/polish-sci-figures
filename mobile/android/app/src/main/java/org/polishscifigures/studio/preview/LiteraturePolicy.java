package org.polishscifigures.studio.preview;

import java.net.URI;
import java.net.URLDecoder;
import java.util.LinkedHashMap;
import java.util.Map;

/** The optional literature browser cannot grant general network/navigation access. */
final class LiteraturePolicy {
    private static final String API = "/europepmc/webservices/rest/";
    private static URI https(String raw) {
        try {
            if (raw == null || raw.length() > 2048 || raw.matches(".*[\\x00-\\x20\\x7f\\\\].*")) return null;
            URI uri = new URI(raw);
            return "https".equals(uri.getScheme()) && uri.getRawUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443) ? uri : null;
        } catch (Exception error) { return null; }
    }

    static boolean allowsLookup(String raw, String method, boolean mainFrame) {
        URI uri = https(raw);
        if (uri == null || mainFrame || !"GET".equals(method) || !"www.ebi.ac.uk".equals(uri.getHost())
            || uri.getRawFragment() != null || !uri.getRawPath().equals(uri.getPath())) return false;
        if (uri.getPath().matches(API + "PMC[1-9][0-9]{0,11}/fullTextXML")) return uri.getRawQuery() == null;
        if (!(API + "search").equals(uri.getPath()) || uri.getRawQuery() == null) return false;
        try {
            Map<String, String> query = new LinkedHashMap<>();
            for (String pair : uri.getRawQuery().split("&", -1)) {
                String[] parts = pair.split("=", 2);
                if (parts.length != 2) return false;
                String key = URLDecoder.decode(parts[0], "UTF-8"), value = URLDecoder.decode(parts[1], "UTF-8");
                if (query.put(key, value) != null) return false;
            }
            String terms = query.get("query");
            return query.size() == 4 && "json".equals(query.get("format")) && "5".equals(query.get("pageSize"))
                && "core".equals(query.get("resultType")) && terms != null && !terms.isEmpty() && terms.length() <= 700
                && !terms.matches("(?s).*[\\x00-\\x1f\\x7f].*");
        } catch (Exception error) { return false; }
    }

    static boolean isPaperLink(String raw) {
        URI uri = https(raw);
        if (uri == null || uri.getRawQuery() != null) return false;
        String path = uri.getPath(), fragment = uri.getFragment();
        if ("europepmc.org".equals(uri.getHost())) {
            if (!uri.getRawPath().equals(path)) return false;
            return (path.matches("/articles/PMC[1-9][0-9]{0,11}") || path.matches("/article/MED/[1-9][0-9]{0,11}"))
                && (fragment == null || fragment.matches("[A-Za-z][A-Za-z0-9_.:-]{0,119}"));
        }
        return "doi.org".equals(uri.getHost()) && fragment == null && path.length() <= 241
            && path.matches("/10\\.[0-9]{4,9}/[A-Za-z0-9._;()/:+\\-]+") && !path.contains("..");
    }
}
