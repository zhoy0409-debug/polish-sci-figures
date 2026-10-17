"""Bounded local workbook import. No filename, path or network accepted."""
import base64, binascii, io, zipfile

def import_table(payload):
    if not isinstance(payload,dict) or set(payload)-{'data','sheet'} or not isinstance(payload.get('data'),str) or len(payload['data'])>2800000:
        raise ValueError('Invalid local workbook payload')
    try:
        raw=base64.b64decode(payload['data'],validate=True)
        if len(raw)>2000000:raise ValueError()
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            if len(z.infolist())>1000 or sum(i.file_size for i in z.infolist())>20000000:raise ValueError()
        import pandas as pd
        book=pd.ExcelFile(io.BytesIO(raw),engine='openpyxl')
        sheet=payload.get('sheet',0)
        if isinstance(sheet,bool) or not isinstance(sheet,(str,int)):raise ValueError()
        data=pd.read_excel(book,sheet_name=sheet,header=None,dtype=str,nrows=10002,keep_default_na=False)
        if not 2<=len(data)<=10001 or not 1<=len(data.columns)<=100:raise ValueError()
        rows=data.astype(str).values.tolist()
        from studio_server import validate_table
        validate_table({},rows)
        return {'rows':rows,'sheets':book.sheet_names}
    except (ValueError,KeyError,IndexError,OSError,zipfile.BadZipFile,binascii.Error):
        raise ValueError('Cannot read workbook; use a bounded XLSX sheet or export CSV / 无法读取工作表，请使用 XLSX 或导出 CSV') from None
