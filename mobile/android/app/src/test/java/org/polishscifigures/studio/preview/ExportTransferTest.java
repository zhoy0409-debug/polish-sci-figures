package org.polishscifigures.studio.preview;
import org.junit.Test;
import java.io.*;
import java.nio.file.Files;
import java.util.Base64;
import static org.junit.Assert.*;

public class ExportTransferTest {
    @Test public void chunksPreserveBinaryAndCleanup() throws Exception {
        File root = Files.createTempDirectory("studio-unit-").toFile();
        byte[] bytes = new byte[500001]; for (int i=0; i<bytes.length; i++) bytes[i] = (byte)(i%251);
        File staged;
        try (ExportTransfer transfer = new ExportTransfer(root,"test","figure.tif","image/tiff",bytes.length)) {
            staged = transfer.file;
            for (int offset=0; offset<bytes.length; offset+=ExportTransfer.MAX_CHUNK_BYTES) {
                byte[] chunk = java.util.Arrays.copyOfRange(bytes,offset,Math.min(bytes.length,offset+ExportTransfer.MAX_CHUNK_BYTES));
                transfer.append(offset,Base64.getEncoder().encodeToString(chunk));
            }
            transfer.seal(); ByteArrayOutputStream output = new ByteArrayOutputStream(); transfer.copyTo(output);
            assertArrayEquals(bytes,output.toByteArray());
        }
        assertFalse(staged.exists()); assertTrue(root.delete());
    }
    @Test public void incompleteOrderAndLimitsAreRejected() throws Exception {
        File root = Files.createTempDirectory("studio-unit-").toFile();
        assertThrows(IllegalArgumentException.class, () -> new ExportTransfer(root,"id","../unsafe","text/plain",1));
        assertThrows(IllegalArgumentException.class, () -> new ExportTransfer(root,"id","a","text/plain",200000001));
        try (ExportTransfer transfer = new ExportTransfer(root,"id","a","text/plain",2)) {
            assertThrows(IllegalArgumentException.class,transfer::seal);
            assertThrows(IllegalArgumentException.class,() -> transfer.append(1,"YQ=="));
            assertThrows(IllegalArgumentException.class,() -> transfer.append(0,"***"));
            transfer.append(0,"YQ==");
            assertThrows(IllegalArgumentException.class,() -> transfer.append(1,"YWE="));
            transfer.append(1,"Yg=="); transfer.seal();
            assertThrows(IllegalArgumentException.class,() -> transfer.append(2,"Yw=="));
        }
        assertTrue(root.delete());
    }
    @Test public void emptyFileAndFailedDestinationHandled() throws Exception {
        File root = Files.createTempDirectory("studio-unit-").toFile();
        try (ExportTransfer transfer = new ExportTransfer(root,"id","a","text/plain",0)) {
            transfer.seal(); ByteArrayOutputStream out = new ByteArrayOutputStream(); transfer.copyTo(out); assertEquals(0,out.size());
        }
        try (ExportTransfer transfer = new ExportTransfer(root,"id","a","text/plain",1)) {
            transfer.append(0,"YQ=="); transfer.seal();
            assertThrows(IOException.class,() -> transfer.copyTo(new OutputStream(){public void write(int b) throws IOException {throw new IOException("full");}}));
        }
        assertTrue(root.delete());
    }
}
