#!/usr/bin/env python3
"""Structural validation for the Starttech plugin marketplace.

Runs in CI on every pull request (and on push to master) as the required
`validate` check. Mirrors what `claude plugin validate` checks locally, with
no external dependencies so it can't be bypassed by a missing toolchain:

  - every *.json in the repo parses
  - marketplace.json has name, owner.name, and a non-empty plugins[]
  - each plugin entry has a unique name and a source
  - local (monorepo) sources resolve to a directory inside the repo that
    contains .claude-plugin/plugin.json with a name
  - object sources declare a type (github/url/git-subdir/npm) and carry the
    locator field that type requires (repo / url / url+path / package)
  - every bundled skill has a SKILL.md with name + description frontmatter

Exits non-zero on any error so the PR's required check fails.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
errors = []
warnings = []


def rel(path):
    return os.path.relpath(path, ROOT)


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        err(f"missing file: {rel(path)}")
    except json.JSONDecodeError as e:
        err(f"invalid JSON in {rel(path)}: {e}")
    return None


def parse_frontmatter(text):
    """Minimal leading --- ... --- block -> {key: value}. No YAML dep.
    Both fences must be a line that is exactly '---' (a body line that merely
    starts with '---', e.g. a markdown rule or '---extra', is not a fence)."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if end is None:
        return None
    keys = {}
    for line in lines[1:end]:
        stripped = line.lstrip()
        if ":" in line and not stripped.startswith("#") and line[:1] not in (" ", "\t"):
            k, _, v = line.partition(":")
            keys[k.strip()] = v.strip()
    return keys


def validate_plugin(pdir, entry_name, where):
    pj_path = os.path.join(pdir, ".claude-plugin", "plugin.json")
    if not os.path.isfile(pj_path):
        err(f"{where} ('{entry_name}'): missing {rel(pj_path)}")
        return
    pj = load_json(pj_path)
    if pj is None:
        return
    if not pj.get("name"):
        err(f"{rel(pj_path)}: missing 'name'")
    elif entry_name and pj["name"] != entry_name:
        warn(f"{rel(pj_path)}: plugin name '{pj['name']}' != marketplace entry '{entry_name}'")

    skills_dir = os.path.join(pdir, "skills")
    if not os.path.isdir(skills_dir):
        return
    for sk in sorted(os.listdir(skills_dir)):
        skdir = os.path.join(skills_dir, sk)
        if not os.path.isdir(skdir):
            continue
        sp = os.path.join(skdir, "SKILL.md")
        if not os.path.isfile(sp):
            err(f"skill '{sk}': missing SKILL.md")
            continue
        with open(sp, encoding="utf-8") as f:
            fm = parse_frontmatter(f.read())
        if fm is None:
            err(f"{rel(sp)}: missing YAML frontmatter (--- ... ---)")
            continue
        if not fm.get("name"):
            err(f"{rel(sp)}: frontmatter missing 'name'")
        if not fm.get("description"):
            err(f"{rel(sp)}: frontmatter missing 'description'")


def main():
    # 1. every JSON file parses (os.walk reaches dot-dirs like .claude-plugin,
    #    which glob's '**' silently skips; prune .git so we don't scan it)
    for dirpath, dirnames, filenames in os.walk(ROOT):
        if ".git" in dirnames:
            dirnames.remove(".git")
        for fn in filenames:
            if fn.endswith(".json"):
                load_json(os.path.join(dirpath, fn))

    # 2. marketplace manifest
    mkt_path = os.path.join(ROOT, ".claude-plugin", "marketplace.json")
    mkt = load_json(mkt_path)
    if mkt is not None and not isinstance(mkt, dict):
        err("marketplace.json: top-level value must be a JSON object")
        mkt = None
    if mkt is not None:
        if not isinstance(mkt.get("name"), str) or not mkt["name"].strip():
            err("marketplace.json: missing/empty 'name'")
        owner = mkt.get("owner")
        if not isinstance(owner, dict) or not owner.get("name"):
            err("marketplace.json: 'owner.name' is required")
        plugins = mkt.get("plugins")
        if not isinstance(plugins, list) or not plugins:
            err("marketplace.json: 'plugins' must be a non-empty array")
            plugins = []

        seen = set()
        for i, p in enumerate(plugins):
            where = f"marketplace.json plugins[{i}]"
            if not isinstance(p, dict):
                err(f"{where}: must be a JSON object")
                continue
            name = p.get("name")
            if not name:
                err(f"{where}: missing 'name'")
            elif name in seen:
                err(f"{where}: duplicate plugin name '{name}'")
            else:
                seen.add(name)

            source = p.get("source")
            if source is None:
                err(f"{where} ('{name}'): missing 'source'")
            elif isinstance(source, str):
                if not source.startswith("./"):
                    err(f"{where} ('{name}'): local source must start with './' (got '{source}')")
                else:
                    pdir = os.path.normpath(os.path.join(ROOT, source))
                    if os.path.relpath(pdir, ROOT).startswith(".."):
                        err(f"{where} ('{name}'): source escapes repo root")
                    elif not os.path.isdir(pdir):
                        err(f"{where} ('{name}'): source directory not found: {source}")
                    else:
                        validate_plugin(pdir, name, where)
            elif isinstance(source, dict):
                # Object sources are typed by a 'source' discriminator. Each
                # known type requires its own locator field (per the Claude Code
                # marketplace docs): github->repo, url->url, git-subdir->url+path,
                # npm->package.
                required = {"github": "repo", "url": "url",
                            "git-subdir": "url", "npm": "package"}
                stype = source.get("source")
                if stype is None:
                    # Untyped object: accept any recognized locator key.
                    if not (source.get("url") or source.get("repo") or source.get("package")):
                        err(f"{where} ('{name}'): object source needs a 'source' type "
                            f"(github/url/git-subdir/npm) or a url/repo/package")
                elif stype not in required:
                    err(f"{where} ('{name}'): unknown object source type '{stype}' "
                        f"(expected one of github, url, git-subdir, npm)")
                else:
                    if not source.get(required[stype]):
                        err(f"{where} ('{name}'): '{stype}' source requires '{required[stype]}'")
                    if stype == "git-subdir" and not source.get("path"):
                        err(f"{where} ('{name}'): 'git-subdir' source requires 'path'")
            else:
                err(f"{where} ('{name}'): 'source' must be a string path or an object")

    # 3. report
    for w in warnings:
        print(f"::warning::{w}")
    if errors:
        for e in errors:
            print(f"::error::{e}")
        print(f"\n✗ marketplace validation failed with {len(errors)} error(s)")
        return 1
    summary = "✓ marketplace validation passed"
    if warnings:
        summary += f" ({len(warnings)} warning(s))"
    print(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
