"""Deterministic public synthetic TIFFs and independent Pillow display goldens."""
from pathlib import Path
import base64, hashlib, io, json, sys
import numpy as np
from PIL import Image, TiffImagePlugin
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/polish-sci-figures/scripts'))
import studio_tiff

def build(output):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    rng=np.random.default_rng(20261126)
    gray=rng.integers(0,65536,(137,193),dtype=np.uint16)
    cases=[]
    def add(name,arrays,compression='raw',tags=None,valid=True):
        images=[Image.fromarray(a) for a in arrays];buff=io.BytesIO()
        info=TiffImagePlugin.ImageFileDirectory_v2()
        for key,value in (tags or {}).items(): info[key]=value
        images[0].save(buff,format='TIFF',save_all=True,append_images=images[1:],compression=compression,tiffinfo=info)
        raw=buff.getvalue();entry={'name':name,'data':base64.b64encode(raw).decode(),'valid':valid}
        if valid:
            display=studio_tiff.request({'action':'display','data':entry['data'],'page':len(arrays)-1,'window':[0,4095] if arrays[0].dtype.itemsize==2 else [0,255],'gamma':1.1,'lut':'gray'})
            entry.update(page=len(arrays)-1,window=display['display']['window'],gamma=1.1,lut='gray',native=display['native']['samplesSha256'],fileSha256=hashlib.sha256(raw).hexdigest(),displayRgbSha256=hashlib.sha256(Image.open(io.BytesIO(base64.b64decode(display['display']['data']))).convert('RGB').tobytes()).hexdigest())
        cases.append(entry)
    for compression in ('raw','tiff_lzw','tiff_adobe_deflate','packbits'):
        add('u16-'+compression,[gray],compression)
        add('u8-'+compression,[(gray%256).astype('u1')],compression)
        add('rgb-'+compression,[rng.integers(0,256,(79,91,3),dtype='u1')],compression)
    add('big-endian-u16',[gray.astype('>u2')])
    add('multipage-u16',[gray,gray//2], 'tiff_lzw')
    ome='<OME xmlns="http://www.openmicroscopy.org/Schemas/OME/2016-06"><Image ID="Image:0"><Pixels ID="Pixels:0" DimensionOrder="XYCZT" Type="uint16" SizeX="193" SizeY="137" SizeC="2" SizeZ="1" SizeT="1"><Channel ID="Channel:0:0" SamplesPerPixel="1"/><Channel ID="Channel:0:1" SamplesPerPixel="1"/><TiffData/></Pixels></Image></OME>'
    add('ome-two-planes',[gray,gray//2],tags={270:ome})
    add('float-refused',[gray.astype('float32')],valid=False)
    cases.append({'name':'truncated-refused','data':cases[0]['data'][:160],'valid':False})
    # Mutate the encoded LZW payload without changing dimensions or original tags.
    bad=bytearray(base64.b64decode(cases[3]['data']));image=Image.open(io.BytesIO(bad));start=image.tag_v2[273][0];count=image.tag_v2[279][0];bad[start:start+min(40,count)]=b'\xff'*min(40,count)
    cases.append({'name':'damaged-strip-refused','data':base64.b64encode(bad).decode(),'valid':False})
    (output/'fixtures.json').write_text(json.dumps(cases),encoding='utf8')
    return output/'fixtures.json'
if __name__=='__main__': print(build(sys.argv[1]))
