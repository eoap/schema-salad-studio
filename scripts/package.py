#!/usr/bin/env python3
"""Build an installable VSIX without downloading a packaging CLI."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape

root = Path(__file__).resolve().parents[1]
pkg = json.loads((root / 'package.json').read_text())
dest = root / 'dist' / f"{pkg['name']}-{pkg['version']}.vsix"
dest.parent.mkdir(exist_ok=True)
manifest = f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
<Metadata><Identity Language="en-US" Id="{pkg['name']}" Version="{pkg['version']}" Publisher="{pkg['publisher']}"/>
<DisplayName>{escape(pkg['displayName'])}</DisplayName><Description xml:space="preserve">{escape(pkg['description'])}</Description>
<Tags>Schema Salad,CWL,YAML</Tags><Categories>Programming Languages,Visualization</Categories><GalleryFlags>Public</GalleryFlags>
<Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="{pkg['engines']['vscode']}"/><Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/><Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/><Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value=""/><Property Id="Microsoft.VisualStudio.Code.EnabledApiProposals" Value=""/><Property Id="Microsoft.VisualStudio.Code.ExecutesCode" Value="true"/></Properties>
<License>extension/LICENSE</License></Metadata>
<Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/>
<Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true"/></Assets>
</PackageManifest>'''
content_types = '''<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="css" ContentType="text/css"/><Default Extension="md" ContentType="text/markdown"/><Default Extension="yml" ContentType="text/yaml"/><Default Extension="vsixmanifest" ContentType="text/xml"/><Default Extension="txt" ContentType="text/plain"/></Types>'''
files = [root / name for name in ['package.json','README.md','LICENSE']]
for directory in ['src','media','examples','node_modules/yaml']:
    files.extend(p for p in (root/directory).rglob('*') if p.is_file())
if not (root/'node_modules/yaml/package.json').exists():
    raise SystemExit('Run npm ci --omit=dev before packaging.')
with ZipFile(dest, 'w', ZIP_DEFLATED) as z:
    z.writestr('extension.vsixmanifest', manifest)
    z.writestr('[Content_Types].xml', content_types)
    for file in sorted(files):
        info_name = 'extension/' + file.relative_to(root).as_posix()
        z.writestr(info_name, file.read_bytes())
print(dest)
