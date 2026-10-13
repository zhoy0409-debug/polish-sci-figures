package org.polishscifigures.studio.preview;
import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Fixed synthetic files in the test APK, never a research-data provider. */
public class FixtureProvider extends ContentProvider {
    static final String AUTHORITY = "org.polishscifigures.studio.preview.test.fixtures";
    static final String CSV = "group,unit,value\nA,A1,1\nA,A2,2\nB,B1,3\nB,B2,4\n";
    @Override public boolean onCreate() {
        try { try (FileOutputStream out = new FileOutputStream(file(Uri.parse("content://"+AUTHORITY+"/input.csv")))) { out.write(CSV.getBytes(StandardCharsets.UTF_8)); } return true; }
        catch (IOException error) { throw new IllegalStateException(error); }
    }
    private File file(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (!java.util.Arrays.asList("input.csv","export.svg","project.json","figure.tif","cancelled.txt").contains(name)) throw new FileNotFoundException("Unknown synthetic fixture");
        return new File(getContext().getCacheDir(), "android-qa-"+name);
    }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException { return ParcelFileDescriptor.open(file(uri), ParcelFileDescriptor.parseMode(mode)); }
    @Override public String getType(Uri uri) { return uri.getLastPathSegment().endsWith("csv") ? "text/csv" : "application/octet-stream"; }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE} : projection;
        MatrixCursor cursor = new MatrixCursor(columns); Object[] row = new Object[columns.length];
        try { for(int i=0;i<columns.length;i++) row[i] = OpenableColumns.DISPLAY_NAME.equals(columns[i]) ? uri.getLastPathSegment() : file(uri).length(); cursor.addRow(row); }
        catch(IOException error){throw new IllegalArgumentException(error);} return cursor;
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { try {return file(uri).delete()?1:0;} catch(IOException error){return 0;} }
}
