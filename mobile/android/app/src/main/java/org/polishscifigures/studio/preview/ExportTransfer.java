package org.polishscifigures.studio.preview;

import java.io.*;
import java.util.Base64;

/** Bounded, sequential export staging. No paths supplied by JavaScript are opened. */
final class ExportTransfer implements Closeable {
    static final long MAX_BYTES = 200_000_000L;
    static final int MAX_CHUNK_BYTES = 196608;
    final String id, name, mime;
    final long expectedBytes;
    final File file;
    private OutputStream stream;
    long received;
    boolean sealed;

    ExportTransfer(File cacheDirectory, String id, String name, String mime, long size) throws IOException {
        if (id == null || !id.matches("[A-Za-z0-9_-]{1,80}")) throw new IllegalArgumentException("Invalid export ID");
        if (name == null || name.trim().isEmpty() || name.length() > 240 || name.equals(".") || name.equals("..") || name.chars().anyMatch(c -> c == '/' || c == '\\' || c < 32 || c == 127)) throw new IllegalArgumentException("Invalid export filename");
        if (mime == null || !mime.matches("[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+") || mime.length() > 100) throw new IllegalArgumentException("Invalid export MIME type");
        if (size < 0 || size > MAX_BYTES) throw new IllegalArgumentException("Export limit: 200 MB / 导出上限为 200 MB");
        this.id = id; this.name = name; this.mime = mime; expectedBytes = size;
        file = File.createTempFile("studio-export-", ".pending", cacheDirectory);
        stream = new FileOutputStream(file);
    }
    void append(long offset, String base64) throws IOException {
        if (sealed || stream == null || offset != received) throw new IllegalArgumentException("Unexpected export chunk order");
        if (base64 == null || base64.length() > 262144 || !base64.matches("[A-Za-z0-9+/]*={0,2}")) throw new IllegalArgumentException("Invalid export chunk");
        byte[] bytes = Base64.getDecoder().decode(base64);
        if (bytes.length == 0 || bytes.length > MAX_CHUNK_BYTES || received + bytes.length > expectedBytes) throw new IllegalArgumentException("Export chunk exceeds declared size");
        stream.write(bytes); received += bytes.length;
    }
    void seal() throws IOException {
        if (sealed || received != expectedBytes) throw new IllegalArgumentException("Incomplete export");
        stream.close(); stream = null; sealed = true;
    }
    void copyTo(OutputStream destination) throws IOException {
        if (!sealed) throw new IllegalStateException("Export has not completed");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[65536]; long written = 0; int count;
            while ((count = input.read(buffer)) >= 0) { destination.write(buffer, 0, count); written += count; }
            if (written != expectedBytes) throw new IOException("Export size changed");
            destination.flush();
        }
    }
    @Override public void close() throws IOException {
        try { if (stream != null) stream.close(); } finally { stream = null; if (file.exists() && !file.delete()) file.deleteOnExit(); }
    }
}
