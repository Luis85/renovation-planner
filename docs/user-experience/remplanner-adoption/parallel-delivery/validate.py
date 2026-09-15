"""Run after the coordinator releases the machine lease. No production imports."""
import hashlib
import json
from pathlib import Path
import re
from PIL import Image
from urllib.parse import unquote, urlsplit


HERE = Path(__file__).resolve().parent
PACKAGE = HERE.parent
ROOT = PACKAGE.parents[2]


def main():
    manifest = json.loads((HERE / 'dispatch.json').read_text(encoding='utf-8'))
    schema = json.loads((HERE / 'dispatch.schema.json').read_text(encoding='utf-8'))
    errors = []
    required = set(schema['required'])
    if set(manifest) != required:
        errors.append('Manifest top-level keys differ from schema')
    if manifest.get('schemaVersion') != 1 or manifest.get('maxConcurrentCodingTasks') != 3:
        errors.append('Unexpected schema version or concurrency limit')
    schema_result = 'not run: jsonschema module unavailable'
    try:
        import jsonschema
    except ImportError:
        errors.append('Install jsonschema in the isolated validation environment')
    else:
        try:
            jsonschema.Draft202012Validator.check_schema(schema)
            jsonschema.validate(manifest, schema)
            schema_result = 'passed'
        except jsonschema.exceptions.SchemaError as exc:
            errors.append(str(exc))
        except jsonschema.exceptions.ValidationError as exc:
            errors.append(str(exc))
    packets = manifest.get('packets', [])
    ids = [packet['id'] for packet in packets]
    if ids != ['R00', 'R01', 'R02', 'R03', 'R04', 'R05']:
        errors.append('Unexpected packet IDs/order')
    paths = set()
    for packet in packets:
        if packet['model'] not in {'gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna'} or packet['reasoning'] != 'high':
            errors.append(f"{packet['id']}: invalid model/reasoning")
        if any(dep not in ids[:ids.index(packet['id'])] for dep in packet['dependsOn']):
            errors.append(f"{packet['id']}: missing or forward/cyclic dependency")
        if packet['status'] in {'active', 'pushed', 'accepted'}:
            if not packet['baseSha'] or not re.fullmatch('[a-f0-9]{40}', packet['baseSha']):
                errors.append(f"{packet['id']}: active packet has no immutable base")
            if packet['kind'] == 'coding' and not packet['threadId']:
                errors.append(f"{packet['id']}: active coding packet has no task ID")
        for key in ('ownedExistingPaths', 'ownedNewPaths', 'targetedTests'):
            for value in packet[key]:
                target = (ROOT / value).resolve()
                if Path(value).is_absolute() or not target.is_relative_to(ROOT):
                    errors.append(f'Unsafe ownership path: {value}')
                if key != 'ownedNewPaths' and not target.exists():
                    errors.append(f'Missing current path: {value}')
                paths.add(value)
    active = [p for p in packets if p['status'] == 'active' and p['kind'] == 'coding']
    reserved_active = sum(t['status'] == 'active' for t in manifest['reservedTasks'])
    if len(active) + reserved_active > manifest['maxConcurrentCodingTasks']:
        errors.append('Coding concurrency exceeded')
    if not manifest['dispatchAllowed'] and active:
        errors.append('Coding active despite dispatch prohibition')
    if manifest['dispatchAllowed'] and not manifest['finalStackTip']:
        errors.append('Dispatch allowed without final stack tip')
    for i, packet in enumerate(active):
        owned = set(packet['ownedExistingPaths'] + packet['ownedNewPaths'])
        for other in active[i + 1:]:
            if owned.intersection(other['ownedExistingPaths'] + other['ownedNewPaths']):
                errors.append(f"Overlapping active packets: {packet['id']}/{other['id']}")
        if reserved_active:
            for path in owned:
                if path in manifest['reservedExactPaths'] or any(path == prefix or path.startswith(prefix + '/') for prefix in manifest['reservedPathPrefixes']):
                    errors.append(f'Active reserved path overlap: {path}')
    links = 0
    for doc in PACKAGE.rglob('*.md'):
        content = doc.read_text(encoding='utf-8')
        for match in re.finditer(r'\[[^\]]*\]\(([^)]+)\)', content):
            raw = match.group(1).strip().strip('<>')
            url = urlsplit(raw)
            if url.scheme or raw.startswith('#'):
                continue
            links += 1
            target = (doc.parent / unquote(url.path)).resolve()
            if not target.exists():
                errors.append(f'{doc.relative_to(ROOT)}: missing link {raw}')
    images = []
    for path in sorted(p for p in (PACKAGE / 'evidence').iterdir() if p.suffix.lower() in {'.png', '.jpg', '.jpeg'}):
        data = path.read_bytes()
        try:
            with Image.open(path) as image:
                width, height = image.size
                expected = 'PNG' if path.suffix.lower() == '.png' else 'JPEG'
                if image.format != expected:
                    errors.append(f'Image format/extension mismatch: {path.name}')
                image.verify()
        except (OSError, ValueError) as exc:
            errors.append(f'Invalid image: {path.name}: {exc}')
            continue
        images.append({'path': str(path.relative_to(PACKAGE)).replace('\\', '/'), 'width': width, 'height': height, 'sha256': hashlib.sha256(data).hexdigest()})
    if len(images) < 10:
        errors.append('Expected five current-run and five user-reference images')
    ledger = HERE / 'evidence-hashes.json'
    if ledger.exists():
        expected_hashes = json.loads(ledger.read_text(encoding='utf-8'))
        actual_hashes = {image['path']: image['sha256'] for image in images}
        if actual_hashes != expected_hashes:
            errors.append('Evidence image hashes differ from committed ledger')
    print(json.dumps({'structuralChecks': 'failed' if errors else 'passed', 'jsonSchema': schema_result, 'packetCount': len(packets), 'pathsChecked': len(paths), 'localLinksChecked': links, 'images': images, 'errors': errors}, indent=2))
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
