#!/usr/bin/env python3
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

WINDOWS_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = WINDOWS_DIR.parent.parent
PROJECT_DIR = WINDOWS_DIR / "src" / "UniVerseProjectBrowser"
CSPROJ = PROJECT_DIR / "UniVerseProjectBrowser.csproj"
SLN = WINDOWS_DIR / "UniVerseProjectBrowser.sln"
MANIFEST = PROJECT_DIR / "Package.appxmanifest"

HELP = """check-windows-tree.py -- validate the Windows shell tree without building it.

Checks: the solution references a real project with a matching GUID, every
file the .csproj lists exists (including the filter-list catalog linked from
apps/android), every asset the manifest names exists, every XAML file has a
matching code-behind class, and every content script
Services/ContentScriptService.cs loads exists under ContentScripts/.

Usage: python3 apps/windows/scripts/check-windows-tree.py
Exit code 0 means the tree is consistent; 1 means a problem was found.
"""

failures = []
notes = []


def fail(message):
    failures.append(message)


def check_exists(path, label):
    if not path.exists():
        fail(label + " is missing: " + str(path))
        return False
    return True


def windows_path(base, value):
    return base / Path(*value.split("\\"))


def check_csproj():
    tree = ET.parse(CSPROJ)
    root = tree.getroot()
    guid = None
    for group in root.findall("PropertyGroup"):
        found = group.find("ProjectGuid")
        if found is not None and found.text:
            guid = found.text.strip()
    if guid is None:
        fail("csproj has no ProjectGuid")
    includes = set()
    for item in root.iter():
        if item.tag == "PackageReference":
            continue
        value = item.get("Include")
        if value is None:
            continue
        includes.add(value)
    for value in sorted(includes):
        if value.startswith(".."):
            target = windows_path(PROJECT_DIR, value)
            check_exists(target, "csproj linked file " + value)
        else:
            target = windows_path(PROJECT_DIR, value)
            check_exists(target, "csproj file " + value)
    return guid


def check_sln(expected_guid):
    text = SLN.read_text()
    match = re.search(r'"src\\UniVerseProjectBrowser\\UniVerseProjectBrowser\.csproj", "\{([^}]+)\}"', text)
    if match is None:
        fail("sln does not reference src/UniVerseProjectBrowser/UniVerseProjectBrowser.csproj")
        return
    if "{" + match.group(1) + "}" != expected_guid:
        fail("sln project GUID " + match.group(1) + " does not match csproj " + expected_guid)
    if not (WINDOWS_DIR / "src" / "UniVerseProjectBrowser" / "UniVerseProjectBrowser.csproj").exists():
        fail("sln project file does not exist on disk")


def check_manifest():
    tree = ET.parse(MANIFEST)
    root = tree.getroot()
    ns = {"m": "http://schemas.microsoft.com/appx/manifest/foundation/windows10",
          "uap": "http://schemas.microsoft.com/appx/manifest/uap/windows10"}
    identity = root.find("m:Identity", ns)
    if identity is None:
        fail("manifest has no Identity element")
    else:
        for attr in ("Name", "Publisher", "Version"):
            if not identity.get(attr):
                fail("manifest Identity is missing " + attr)
    for element in root.iter():
        for attr in ("Square150x150Logo", "Square44x44Logo", "Wide310x150Logo", "Image"):
            value = element.get(attr)
            if value:
                check_exists(windows_path(PROJECT_DIR, value), "manifest asset " + value)
    logo = root.find("m:Properties/m:Logo", ns)
    if logo is not None and logo.text:
        check_exists(windows_path(PROJECT_DIR, logo.text), "manifest Logo")


def check_xaml():
    for xaml in sorted(PROJECT_DIR.rglob("*.xaml")):
        codebehind = xaml.with_suffix(".xaml.cs")
        if not check_exists(codebehind, "code-behind for " + xaml.name):
            continue
        text = xaml.read_text()
        match = re.search(r'x:Class="([^"]+)"', text)
        if match is None:
            fail(xaml.name + " has no x:Class")
            continue
        full = match.group(1)
        short = full.split(".")[-1]
        body = codebehind.read_text()
        if ("class " + short) not in body:
            fail(codebehind.name + " does not declare class " + short)
        if ("namespace " + full.rsplit(".", 1)[0]) not in body:
            fail(codebehind.name + " is not in namespace " + full.rsplit(".", 1)[0])


def check_content_scripts():
    service = PROJECT_DIR / "Services" / "ContentScriptService.cs"
    body = service.read_text()
    wanted = sorted(set(re.findall(r'ReadScriptAsync\("([^"]+)"\)', body)))
    if not wanted:
        fail("ContentScriptService.cs loads no scripts")
    for name in wanted:
        check_exists(PROJECT_DIR / "ContentScripts" / name, "content script " + name)
    notes.append("content scripts referenced: " + str(len(wanted)))


def check_cs_braces():
    for path in sorted(PROJECT_DIR.rglob("*.cs")):
        text = path.read_text()
        if text.count("{") != text.count("}"):
            fail(str(path) + " has unbalanced braces")


def main():
    if "--help" in sys.argv or "-h" in sys.argv:
        print(HELP)
        return 0
    for required in (CSPROJ, SLN, MANIFEST):
        check_exists(required, "required file")
    guid = check_csproj()
    check_sln(guid)
    check_manifest()
    check_xaml()
    check_content_scripts()
    check_cs_braces()
    cs_files = list(PROJECT_DIR.rglob("*.cs"))
    xaml_files = list(PROJECT_DIR.rglob("*.xaml"))
    print("checked: " + str(len(cs_files)) + " C# files, " + str(len(xaml_files)) + " XAML files")
    for note in notes:
        print("note: " + note)
    if failures:
        print("FAILED:")
        for failure in failures:
            print("  - " + failure)
        return 1
    print("PASS: Windows shell tree is consistent")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
