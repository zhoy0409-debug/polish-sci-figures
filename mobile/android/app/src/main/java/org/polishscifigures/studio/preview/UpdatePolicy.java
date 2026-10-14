package org.polishscifigures.studio.preview;

import java.net.URI;
import java.util.regex.Pattern;

/** Exact official release destinations; no arbitrary browsing/network grant. */
final class UpdatePolicy {
    static final String REPOSITORY = "https://github.com/zhoy0409-debug/polish-sci-figures";
    static final String RELEASES = REPOSITORY + "/releases";
    static final String API = "https://api.github.com/repos/zhoy0409-debug/polish-sci-figures/releases?per_page=30";
    static final String VERSION = "(?:0|[1-9][0-9]{0,4})\\.(?:0|[1-9][0-9]{0,4})\\.(?:0|[1-9][0-9]{0,4})";
    static final Pattern ASSET = Pattern.compile("polish-sci-figures-Studio-(" + VERSION + ")-Android-preview\\.apk");
    static boolean tag(String value) { return value != null && value.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,99}"); }
    static int compare(String a, String b) {
        if (a == null || b == null || !a.matches(VERSION) || !b.matches(VERSION)) throw new IllegalArgumentException("Invalid application version");
        String[] aa = a.split("\\."), bb = b.split("\\.");
        for (int i = 0; i < 3; i++) { int diff = Integer.compare(Integer.parseInt(aa[i]), Integer.parseInt(bb[i])); if (diff != 0) return diff; }
        return 0;
    }
    static boolean isOfficialLink(String raw) {
        try {
            if (raw == null || raw.length() > 2048 || raw.matches(".*[\\x00-\\x20\\x7f\\\\].*")) return false;
            URI uri = new URI(raw);
            if (!"https".equals(uri.getScheme()) || !"github.com".equals(uri.getHost()) || uri.getRawUserInfo() != null || uri.getPort() != -1 || uri.getRawQuery() != null || uri.getRawFragment() != null || !uri.getRawPath().equals(uri.getPath())) return false;
            if (raw.equals(RELEASES)) return true;
            String prefix = RELEASES + "/tag/";
            if (raw.startsWith(prefix)) return tag(raw.substring(prefix.length()));
            prefix = RELEASES + "/download/";
            if (!raw.startsWith(prefix)) return false;
            String[] parts = raw.substring(prefix.length()).split("/", -1);
            return parts.length == 2 && tag(parts[0]) && ASSET.matcher(parts[1]).matches();
        } catch (Exception error) { return false; }
    }
}
