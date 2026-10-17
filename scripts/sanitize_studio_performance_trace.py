"""Retain real CDP event timing while removing every argument and source URL.

This is a disclosure derivative, not a fresh capture or an optical-latency
measurement. Original event order, names, phases, IDs and timing are unchanged.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re

FIELDS = {'cat', 'name', 'ph', 'pid', 'tid', 'ts', 'dur', 'tts', 'tdur', 'id', 'id2', 'bp', 's'}
NUMBERS = {'pid', 'tid', 'ts', 'dur', 'tts', 'tdur'}


def disclose(events):
    output = []
    for event in events:
        if set(event) - FIELDS - {'args'}:
            raise ValueError('Review unexpected CDP fields before disclosure')
        entry = {key: value for key, value in event.items() if key in FIELDS}
        if not {'name', 'ph', 'pid', 'tid', 'ts'} <= set(entry):
            raise ValueError('Missing actual CDP identity or timestamp')
        for key, value in entry.items():
            if key in NUMBERS:
                if type(value) not in {int, float}:
                    raise ValueError('Timing and process fields must remain numeric')
            elif key == 'id2':
                if not isinstance(value, dict) or set(value) - {'local', 'global'}:
                    raise ValueError('Unexpected nested trace identity')
                if not all(re.fullmatch(r'(?:0x)?[0-9a-fA-F]+', str(v)) for v in value.values()):
                    raise ValueError('Unexpected trace identity value')
            elif key == 'id':
                if not ((type(value) is int and value >= 0) or
                        (isinstance(value, str) and re.fullmatch(r'(?:0x)?[0-9a-fA-F]+', value))):
                    raise ValueError('Unexpected trace identity value')
            elif not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_. :,\-]+', value):
                raise ValueError('Review nonstandard trace label before disclosure')
        output.append(entry)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--expected-sha256', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    manifest_file = args.out.with_suffix(args.out.suffix + '.manifest.json')
    if args.out.exists() or manifest_file.exists():
        raise ValueError('Never overwrite earlier evidence')
    original = args.input.read_bytes()
    source_hash = hashlib.sha256(original).hexdigest()
    if source_hash != args.expected_sha256:
        raise ValueError('Original capture hash mismatch')
    raw = json.loads(original)
    events = disclose(raw['traceEvents'])
    derivative = {'traceEvents': events, 'metadata': {'sourceSha256': source_hash,
                  'disclosure': 'Original ordered event timing, names, phases and IDs; every args field and original top-level metadata removed. No events, timestamps or durations synthesized.'}}
    encoded = json.dumps(derivative, separators=(',', ':'), allow_nan=False).encode('utf-8')
    compressed = gzip.compress(encoded, compresslevel=6, mtime=0)
    assert json.loads(gzip.decompress(compressed))['traceEvents'] == events
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(compressed)
    manifest = {'schema': 'figure-studio-timing-trace-disclosure/1',
                'sourceSha256': source_hash, 'sourceBytes': len(original),
                'eventsRetained': len(events), 'eventsDropped': 0,
                'allArgumentsRemoved': True, 'originalMetadataRemoved': True,
                'orderedTimingFieldsVerifiedExact': True,
                'file': args.out.name, 'bytes': len(compressed),
                'sha256': hashlib.sha256(compressed).hexdigest(),
                'uncompressedSha256': hashlib.sha256(encoded).hexdigest(),
                'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'scope': derivative['metadata']['disclosure'] + ' Source-development four-panel diagnostic, including selections, exports and checks. Not installed-build performance, optical latency, continuous FPS or a new capture.'}
    manifest_file.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
