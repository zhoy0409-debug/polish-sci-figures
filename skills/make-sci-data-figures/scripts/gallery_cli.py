"""List input contracts or generate an original editable gallery bundle."""
import argparse,json
from pathlib import Path
from gallery_registry import CONTRACTS,NOTES,generate

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--list',action='store_true',help='Print bilingual template contracts as JSON')
    parser.add_argument('--view',choices=sorted(CONTRACTS))
    parser.add_argument('--input',type=Path)
    parser.add_argument('--out',type=Path)
    parser.add_argument('--font',default='Arial')
    args=parser.parse_args()
    if args.list:
        print(json.dumps({k:{'zh':v[0],'en':v[1],'category':v[2],'columns':v[3].split(),'numeric':v[4].split(),'notes':NOTES[k]} for k,v in CONTRACTS.items()},ensure_ascii=False,indent=2));return
    if not all([args.view,args.input,args.out]):parser.error('--view, --input and --out are required')
    if args.out.exists() and any(args.out.iterdir()):parser.error('Choose a new or empty output directory')
    try:
        for path in generate(args.input,args.out,args.view,font=args.font):print(path)
    except (ValueError,KeyError) as exc:parser.error(str(exc))

if __name__=='__main__':main()
