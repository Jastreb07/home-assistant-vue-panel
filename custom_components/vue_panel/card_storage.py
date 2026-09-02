"""Validation and revision-safe storage for portable Vue Panel cards."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
from typing import Any

#: Read-only HTTP root for the files a folder card ships beside its index.html.
#: Defined here rather than in const.py so this module stays importable on its own.
CARD_ASSET_URL_BASE = "/vue-panel-card-assets"

CARD_FORMAT = "vue-panel-card"
CARD_FORMAT_VERSION = 2
SANDBOX_API_VERSION = 1
CARD_BACKUP_LIMIT = 5
MAX_CARD_BYTES = 512 * 1024

_IDENTIFIER_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_VARIABLE_KEY_PATTERN = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")
_ICON_PATTERN = re.compile(r"^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$")
# Hex (#rgb/#rgba/#rrggbb/#rrggbbaa) or functional rgb()/rgba() notation
_COLOR_PATTERN = re.compile(
    r"^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})"
    r"|rgba?\([0-9.,%\s/]+\))$",
    re.IGNORECASE,
)
_DOMAIN_PATTERN = re.compile(r"^[a-z0-9_]+$")
_DOCUMENT_PATTERN = re.compile(
    r"^\s*<script\s+data-vue-panel-config>\s*"
    r"(?P<config>[\s\S]*?)\s*</script>\s*"
    r"(?:<script\s+data-vue-panel-translation>\s*"
    r"(?P<translation>[\s\S]*?)\s*</script>\s*)?"
    r"<template\s+data-vue-panel-html>(?P<html>[\s\S]*?)</template>\s*"
    r"<style\s+data-vue-panel-css>(?P<css>[\s\S]*?)</style>\s*"
    r"<script\s+data-vue-panel-javascript>(?P<javascript>[\s\S]*?)</script>\s*$"
)
_CONFIG_PATTERN = re.compile(
    r"^\s*const\s+vuePanelCard\s*=\s*(?P<json>\{[\s\S]*\})\s*;\s*$"
)
_TRANSLATION_PATTERN = re.compile(
    r"^\s*const\s+vuePanelTranslations\s*=\s*(?P<json>\{[\s\S]*\})\s*;\s*$"
)
# A card may ship any BCP-47-style language tag, for example "en", "pt-BR"
_TRANSLATION_LANGUAGE_PATTERN = re.compile(r"^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")
_TRANSLATION_FALLBACK = "en"
_TRANSLATION_KEY_PATTERN = re.compile(
    r"^translation\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$"
)
_MAX_TRANSLATION_LANGUAGES = 40
_MAX_TRANSLATION_ENTRIES = 4000
_AREAS = {"dashboard", "sidebar", "header", "bottom", "dialog"}
_CAPABILITIES = {
    "entity:read",
    "entity:subscribe",
    "icon:render",
    "service:call",
    "navigation:read",
    "navigation:write",
    "dashboard:context",
    "shell:events",
    "dialog:open",
    # Reaching out of the panel into Home Assistant itself: opening its
    # config panel or notification drawer, and reading the counters its
    # own sidebar shows next to them.
    "host:navigate",
    "host:badges",
}
_GESTURES = ("tap", "double_tap", "hold")
_ACTIONS = (
    "default",
    "more-info",
    "ha-more-info",
    "toggle",
    "navigate",
    "url",
    "perform-action",
    "popup",
    "assist",
    "none",
)
_VARIABLE_TYPES = {
    "action",
    "entity",
    "icon",
    "view",
    "popup",
    "select",
    "string",
    "number",
    "boolean",
    "color",
    "list",
}
_FORBIDDEN_VARIABLE_KEYS = {"__proto__", "prototype", "constructor"}
_METADATA_FIELDS = {
    "format",
    "formatVersion",
    "apiVersion",
    "manufacturer",
    "cardName",
    "name",
    "description",
    "icon",
    "group",
    "areas",
    "capabilities",
    "defaultSize",
    "defaultResponsive",
    "fullRow",
    "variables",
}
# Optional metadata: a card without them simply keeps the engine defaults
_OPTIONAL_METADATA_FIELDS = {"detail"}
_DETAIL_FIELDS = {"card", "variables", "entityKey", "position", "mobileHeight"}
_VARIABLE_FIELDS = {
    "gestures",
    "actions",
    "key",
    "label",
    "group",
    "visibleIf",
    "type",
    "required",
    "default",
    "domain",
    "options",
    "optionLabels",
    "min",
    "max",
    "step",
    "itemFields",
    "nestable",
}
# A list holds repeated objects, so it never carries a scalar default itself.
_LIST_ONLY_FIELDS = {"itemFields", "nestable"}
# The tap-action editor is a core component; a card only narrows its choices.
_ACTION_ONLY_FIELDS = {"gestures", "actions"}
_MAX_LIST_ITEM_FIELDS = 24


class CardFileError(Exception):
    """Raised when a card file is unsafe, unreadable, or invalid."""


class CardRevisionConflict(CardFileError):
    """Raised when a card changed after the client loaded it."""

    def __init__(self, current_hash: str) -> None:
        super().__init__("Card revision conflict")
        self.current_hash = current_hash


class CardAlreadyExists(CardFileError):
    """Raised when a create operation targets an existing card."""


class CardNotFound(CardFileError):
    """Raised when a requested card does not exist."""


class CardReadOnly(CardFileError):
    """Raised when a managed card is targeted by a write operation."""


def _reject_json_constant(value: str) -> None:
    raise ValueError(f"Unsupported JSON constant: {value}")


def _validate_identifier(value: Any, label: str) -> str:
    if not isinstance(value, str) or not _IDENTIFIER_PATTERN.fullmatch(value):
        raise CardFileError(f"{label} must be a URL-safe identifier")
    return value


def _positive_number(value: Any, label: str) -> float | int:
    _finite_number(value, label)
    if value <= 0:
        raise CardFileError(f"{label} must be a positive number")
    return value


def _finite_number(value: Any, label: str) -> float | int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise CardFileError(f"{label} must be a number")
    if value != value or value in (float("inf"), float("-inf")):
        raise CardFileError(f"{label} must be finite")
    return value


def _validate_action_variable(variable: dict[str, Any], index: int) -> None:
    """An `action` variable holds one action per gesture.

    The card only decides which gestures it reacts to and which actions they
    may use — the panel renders the editor and the target field for them.
    """

    for field, allowed in (("gestures", _GESTURES), ("actions", _ACTIONS)):
        if field not in variable:
            continue
        values = variable[field]
        if (
            not isinstance(values, list)
            or not values
            or len(set(values)) != len(values)
            or any(value not in allowed for value in values)
        ):
            raise CardFileError(f"Variable {index} has an invalid {field} list")

    default = variable.get("default")
    if default is None:
        return
    if not isinstance(default, dict):
        raise CardFileError(f"Variable {index} has an invalid default value")
    gestures = variable.get("gestures", list(_GESTURES))
    actions = variable.get("actions", list(_ACTIONS))
    for gesture, entry in default.items():
        if gesture not in gestures:
            raise CardFileError(f"Variable {index} defaults an unsupported gesture")
        if not isinstance(entry, dict) or set(entry) - {"action", "target"}:
            raise CardFileError(f"Variable {index} has an invalid default action")
        if entry.get("action") not in actions:
            raise CardFileError(f"Variable {index} defaults an unsupported action")
        if "target" in entry and not isinstance(entry["target"], str):
            raise CardFileError(f"Variable {index} has an invalid default target")


def _validate_default(variable: dict[str, Any], index: int) -> None:
    if "default" not in variable:
        return
    value = variable["default"]
    variable_type = variable["type"]
    if variable_type == "action":
        return
    if variable_type == "list":
        raise CardFileError(f"Variable {index} must not define a default")
    valid = (
        isinstance(value, bool)
        if variable_type == "boolean"
        else isinstance(value, (int, float)) and not isinstance(value, bool)
        if variable_type == "number"
        else isinstance(value, str)
    )
    if not valid:
        raise CardFileError(f"Variable {index} has an invalid default value")
    if variable_type == "number":
        _finite_number(value, f"Variable {index} default")
    if variable_type == "icon" and not _ICON_PATTERN.fullmatch(value):
        raise CardFileError(f"Variable {index} has an invalid icon default")
    if variable_type == "color" and value and not _COLOR_PATTERN.fullmatch(value):
        raise CardFileError(f"Variable {index} has an invalid colour default")


def _validate_list_variable(variable: dict[str, Any], index: int) -> None:
    """A list variable repeats a small set of scalar fields per entry."""

    item_fields = variable.get("itemFields")
    if (
        not isinstance(item_fields, list)
        or not item_fields
        or len(item_fields) > _MAX_LIST_ITEM_FIELDS
    ):
        raise CardFileError(f"Variable {index} requires item fields")
    if "nestable" in variable and not isinstance(variable["nestable"], bool):
        raise CardFileError(f"Variable {index} has an invalid nestable flag")
    item_keys: set[str] = set()
    referenced: list[str] = []
    for item in item_fields:
        if not isinstance(item, dict) or item.get("type") == "list":
            raise CardFileError(f"Variable {index} has an invalid item field")
        referenced.extend(_validate_variable(item, index, item_keys))
    for key in referenced:
        if key not in item_keys:
            raise CardFileError(f"Variable {index} references an unknown item field")


def _validate_visible_if(value: Any, index: int) -> list[str]:
    """One or more conditions that decide whether a variable is offered.

    Every condition names another variable of the same card and exactly one
    matcher. Several conditions all have to hold. Returns the referenced keys
    so the caller can check them once every variable is known.
    """

    conditions = value if isinstance(value, list) else [value]
    if not conditions:
        raise CardFileError(f"Variable {index} has an empty visibleIf")
    referenced: list[str] = []
    for condition in conditions:
        if not isinstance(condition, dict) or set(condition) - {
            "key", "equals", "in", "not"
        }:
            raise CardFileError(f"Variable {index} has an invalid visibleIf")
        key = condition.get("key")
        if not isinstance(key, str) or not _VARIABLE_KEY_PATTERN.fullmatch(key):
            raise CardFileError(f"Variable {index} has an invalid visibleIf key")
        matchers = [name for name in ("equals", "in", "not") if name in condition]
        if len(matchers) != 1:
            raise CardFileError(f"Variable {index} needs exactly one visibleIf matcher")
        if "in" in condition:
            options = condition["in"]
            if not isinstance(options, list) or not options or any(
                not isinstance(option, (str, int, float, bool)) for option in options
            ):
                raise CardFileError(f"Variable {index} has an invalid visibleIf list")
        else:
            expected = condition[matchers[0]]
            if not isinstance(expected, (str, int, float, bool)):
                raise CardFileError(f"Variable {index} has an invalid visibleIf value")
        referenced.append(key)
    return referenced


def _validate_variable(value: Any, index: int, keys: set[str]) -> list[str]:
    if not isinstance(value, dict):
        raise CardFileError(f"Variable {index} must be an object")
    if set(value) - _VARIABLE_FIELDS:
        raise CardFileError(f"Variable {index} contains unsupported fields")
    key = value.get("key")
    if (
        not isinstance(key, str)
        or not _VARIABLE_KEY_PATTERN.fullmatch(key)
        or key in _FORBIDDEN_VARIABLE_KEYS
        or key in keys
    ):
        raise CardFileError(f"Variable {index} has an invalid or duplicate key")
    keys.add(key)
    if not isinstance(value.get("label"), str) or not value["label"].strip():
        raise CardFileError(f"Variable {index} requires a label")
    # Optional: the settings dialog puts variables of one group into one box
    if "group" in value and (
        not isinstance(value["group"], str) or not value["group"].strip()
    ):
        raise CardFileError(f"Variable {index} has an invalid group")
    variable_type = value.get("type")
    if variable_type not in _VARIABLE_TYPES:
        raise CardFileError(f"Variable {index} has an unsupported type")
    if not isinstance(value.get("required"), bool):
        raise CardFileError(f"Variable {index} requires an explicit required flag")
    if variable_type != "list" and set(value) & _LIST_ONLY_FIELDS:
        raise CardFileError(f"Variable {index} contains unsupported fields")
    if variable_type != "action" and set(value) & _ACTION_ONLY_FIELDS:
        raise CardFileError(f"Variable {index} contains unsupported fields")
    _validate_default(value, index)

    if variable_type == "action":
        _validate_action_variable(value, index)
    if variable_type == "list":
        _validate_list_variable(value, index)
    if variable_type == "entity" and "domain" in value:
        domain = value["domain"]
        if not isinstance(domain, str) or not _DOMAIN_PATTERN.fullmatch(domain):
            raise CardFileError(f"Variable {index} has an invalid entity domain")
    if variable_type == "select":
        options = value.get("options")
        if (
            not isinstance(options, list)
            or not options
            or any(not isinstance(option, str) or not option for option in options)
            or len(set(options)) != len(options)
        ):
            raise CardFileError(f"Variable {index} requires unique select options")
        labels = value.get("optionLabels")
        if labels is not None and (
            not isinstance(labels, dict)
            or any(
                key not in options or not isinstance(label, str)
                for key, label in labels.items()
            )
        ):
            raise CardFileError(f"Variable {index} has invalid option labels")
        if "default" in value and value["default"] not in options:
            raise CardFileError(f"Variable {index} default is not a select option")
    if variable_type == "number":
        for constraint in ("min", "max", "step"):
            if constraint in value:
                _finite_number(value[constraint], f"Variable {index} {constraint}")
        if "step" in value and value["step"] <= 0:
            raise CardFileError(f"Variable {index} step must be positive")
        if "min" in value and "max" in value and value["min"] > value["max"]:
            raise CardFileError(f"Variable {index} min must not exceed max")

    if "visibleIf" not in value:
        return []
    return _validate_visible_if(value["visibleIf"], index)


def validate_card_translations(value: Any) -> dict[str, Any]:
    """Validate the translation block: a fallback language and its catalogs."""

    if value is None:
        return {"fallback": _TRANSLATION_FALLBACK, "languages": {}}
    if not isinstance(value, dict) or set(value) - {"fallback", "languages"}:
        raise CardFileError("Card translations must be an object")

    languages = value.get("languages", {})
    if not isinstance(languages, dict):
        raise CardFileError("Card translations require a languages object")
    if len(languages) > _MAX_TRANSLATION_LANGUAGES:
        raise CardFileError("Card translations exceed the language limit")
    entries = 0
    for language, catalog in languages.items():
        if not isinstance(language, str) or not _TRANSLATION_LANGUAGE_PATTERN.fullmatch(
            language
        ):
            raise CardFileError(f"Unsupported card translation language: {language}")
        if not isinstance(catalog, dict):
            raise CardFileError(f"Card translations for {language} must be an object")
        for key, text in catalog.items():
            if not isinstance(key, str) or not _TRANSLATION_KEY_PATTERN.fullmatch(key):
                raise CardFileError(f"Invalid card translation key: {key}")
            if not isinstance(text, str):
                raise CardFileError(f"Card translation {key} must be text")
            entries += 1
    if entries > _MAX_TRANSLATION_ENTRIES:
        raise CardFileError("Card translations exceed the entry limit")

    # Without an explicit fallback a card always falls back to English
    fallback = value.get("fallback", _TRANSLATION_FALLBACK)
    if fallback != _TRANSLATION_FALLBACK and fallback not in languages:
        raise CardFileError("Card translation fallback must be a translated language")
    return {"fallback": fallback, "languages": deepcopy(languages)}


def validate_card_metadata(value: Any) -> dict[str, Any]:
    """Validate and return Card Format v2 metadata."""

    if not isinstance(value, dict):
        raise CardFileError("Card metadata must be an object")
    fields = set(value)
    if not _METADATA_FIELDS <= fields or fields - _METADATA_FIELDS - _OPTIONAL_METADATA_FIELDS:
        raise CardFileError("Card metadata fields are incomplete or unsupported")
    if value.get("format") != CARD_FORMAT:
        raise CardFileError("Unsupported card format")
    if value.get("formatVersion") != CARD_FORMAT_VERSION:
        raise CardFileError("Unsupported card format version")
    api_version = value.get("apiVersion")
    if api_version != SANDBOX_API_VERSION:
        raise CardFileError("Unsupported sandbox API version")
    _validate_identifier(value.get("manufacturer"), "Card manufacturer")
    _validate_identifier(value.get("cardName"), "Card name")
    for field in ("name", "description", "group"):
        if not isinstance(value.get(field), str):
            raise CardFileError(f"Card {field} must be a string")
    if not value["name"].strip() or not value["group"].strip():
        raise CardFileError("Card name and group must not be empty")
    if not isinstance(value.get("icon"), str) or not _ICON_PATTERN.fullmatch(value["icon"]):
        raise CardFileError("Card icon must be an MDI icon")

    areas = value.get("areas")
    if (
        not isinstance(areas, list)
        or not areas
        or any(area not in _AREAS for area in areas)
        or len(set(areas)) != len(areas)
    ):
        raise CardFileError("Card areas are invalid")
    capabilities = value.get("capabilities")
    if (
        not isinstance(capabilities, list)
        or any(capability not in _CAPABILITIES for capability in capabilities)
        or len(set(capabilities)) != len(capabilities)
    ):
        raise CardFileError("Card capabilities are invalid")

    size = value.get("defaultSize")
    if not isinstance(size, dict) or set(size) != {"cols", "rows", "width", "height"}:
        raise CardFileError("Card defaultSize must be an object")
    for field in ("cols", "rows", "width", "height"):
        _positive_number(size.get(field), f"Card defaultSize.{field}")

    responsive = value.get("defaultResponsive")
    if not isinstance(responsive, dict) or set(responsive) != {
        "mobile", "tablet", "desktop", "mobileMax", "tabletMax"
    }:
        raise CardFileError("Card defaultResponsive must be an object")
    for field in ("mobile", "tablet", "desktop"):
        if not isinstance(responsive.get(field), bool):
            raise CardFileError(f"Card defaultResponsive.{field} must be boolean")
    mobile_max = responsive.get("mobileMax")
    tablet_max = responsive.get("tabletMax")
    if (
        isinstance(mobile_max, bool)
        or not isinstance(mobile_max, int)
        or isinstance(tablet_max, bool)
        or not isinstance(tablet_max, int)
        or mobile_max < 1
        or tablet_max <= mobile_max
    ):
        raise CardFileError("Card responsive breakpoints are invalid")
    if not isinstance(value.get("fullRow"), bool):
        raise CardFileError("Card fullRow must be boolean")
    variables = value.get("variables")
    if not isinstance(variables, list):
        raise CardFileError("Card variables must be an array")
    keys: set[str] = set()
    referenced: list[str] = []
    for index, variable in enumerate(variables, start=1):
        referenced.extend(_validate_variable(variable, index, keys))
    for key in referenced:
        if key not in keys:
            raise CardFileError(f"A visibleIf condition references the unknown key {key}")
    if "detail" in value:
        _validate_detail(value["detail"], keys)
    return deepcopy(value)


def _validate_detail(value: Any, keys: set[str]) -> None:
    """Validate the optional detail view a card opens for `more-info`."""

    if not isinstance(value, dict):
        raise CardFileError("Card detail must be an object")
    if set(value) - _DETAIL_FIELDS:
        raise CardFileError("Card detail contains unsupported fields")
    card = value.get("card")
    if card is not None:
        if not isinstance(card, str) or card.count("/") != 1:
            raise CardFileError("Card detail card must be a card type")
        manufacturer, card_name = card.split("/")
        _validate_identifier(manufacturer, "Card detail manufacturer")
        _validate_identifier(card_name, "Card detail card name")
    variables = value.get("variables")
    if variables is not None:
        if not isinstance(variables, list) or len(set(variables)) != len(variables):
            raise CardFileError("Card detail variables must be a unique array")
        for key in variables:
            if not isinstance(key, str) or key not in keys:
                raise CardFileError(f"Card detail references the unknown variable {key}")
    entity_key = value.get("entityKey")
    if entity_key is not None and (
        not isinstance(entity_key, str) or entity_key not in keys
    ):
        raise CardFileError("Card detail entityKey must be a declared variable")
    position = value.get("position")
    if position is not None and position not in {"top", "center", "bottom"}:
        raise CardFileError("Card detail position must be top, center, or bottom")
    mobile_height = value.get("mobileHeight")
    if mobile_height is not None and mobile_height not in {"full", "fit-content"}:
        raise CardFileError("Card detail mobileHeight must be full or fit-content")


def parse_card_document(document: str) -> dict[str, Any]:
    """Parse one portable HTML document without executing its JavaScript."""

    if not isinstance(document, str):
        raise CardFileError("Card document must be text")
    if len(document.encode("utf-8")) > MAX_CARD_BYTES:
        raise CardFileError("Card document exceeds the size limit")
    match = _DOCUMENT_PATTERN.fullmatch(document)
    if match is None:
        raise CardFileError("Card document has an invalid structure")
    config_match = _CONFIG_PATTERN.fullmatch(match.group("config"))
    if config_match is None:
        raise CardFileError("Card configuration must only assign JSON to vuePanelCard")
    try:
        metadata = json.loads(
            config_match.group("json"),
            parse_constant=_reject_json_constant,
        )
    except (json.JSONDecodeError, ValueError) as error:
        raise CardFileError("Card configuration is not valid JSON") from error
    return {
        "metadata": validate_card_metadata(metadata),
        "translations": _parse_translation_block(match.group("translation")),
        "html": match.group("html").removeprefix("\n").removesuffix("\n"),
        "css": match.group("css").removeprefix("\n").removesuffix("\n"),
        "javascript": match.group("javascript").removeprefix("\n").removesuffix("\n"),
    }


def _parse_translation_block(block: str | None) -> dict[str, Any]:
    """A card without the block simply ships no translations."""

    if block is None:
        return validate_card_translations(None)
    translation_match = _TRANSLATION_PATTERN.fullmatch(block)
    if translation_match is None:
        raise CardFileError(
            "Card translations must only assign JSON to vuePanelTranslations"
        )
    try:
        translations = json.loads(
            translation_match.group("json"),
            parse_constant=_reject_json_constant,
        )
    except (json.JSONDecodeError, ValueError) as error:
        raise CardFileError("Card translations are not valid JSON") from error
    return validate_card_translations(translations)


def serialize_card_document(parsed: dict[str, Any]) -> str:
    """Serialize a parsed card into the canonical portable HTML structure."""

    metadata = validate_card_metadata(parsed["metadata"])
    config = json.dumps(metadata, ensure_ascii=False, indent=2)
    translations = json.dumps(
        validate_card_translations(parsed.get("translations")),
        ensure_ascii=False,
        indent=2,
    )
    return (
        "<script data-vue-panel-config>\n"
        f"const vuePanelCard = {config};\n"
        "</script>\n\n"
        "<script data-vue-panel-translation>\n"
        f"const vuePanelTranslations = {translations};\n"
        "</script>\n\n"
        "<template data-vue-panel-html>\n"
        f"{parsed['html']}\n"
        "</template>\n\n"
        "<style data-vue-panel-css>\n"
        f"{parsed['css']}\n"
        "</style>\n\n"
        "<script data-vue-panel-javascript>\n"
        f"{parsed['javascript']}\n"
        "</script>\n"
    )


def card_content_hash(document: str) -> str:
    """Return the immutable revision token for one card document."""

    return hashlib.sha256(document.encode("utf-8")).hexdigest()


def _safe_directory(path: Path, label: str) -> None:
    if path.is_symlink():
        raise CardFileError(f"{label} must not be a symbolic link")
    path.mkdir(parents=True, exist_ok=True)
    if not path.is_dir():
        raise CardFileError(f"{label} is not a directory")


#: Card document inside a card folder, next to the card's own assets
CARD_INDEX_FILE = "index.html"


def _card_path(root: Path, manufacturer: str, card_name: str, create: bool) -> Path:
    _validate_identifier(manufacturer, "Card manufacturer")
    _validate_identifier(card_name, "Card name")
    if create:
        _safe_directory(root, "Card directory")
    elif not root.is_dir() or root.is_symlink():
        raise CardNotFound("Card directory does not exist")
    manufacturer_root = root / manufacturer
    if create:
        _safe_directory(manufacturer_root, "Card manufacturer directory")
    elif not manufacturer_root.is_dir() or manufacturer_root.is_symlink():
        raise CardNotFound("Card manufacturer does not exist")

    """
    A card is either a single `<name>.html` or a `<name>/` folder holding
    `index.html` next to its own assets. New cards are always written as a
    single file; the folder form is picked up when it already exists.
    """
    folder = manufacturer_root / card_name
    if not create and folder.is_dir() and not folder.is_symlink():
        path = folder / CARD_INDEX_FILE
        if path.is_symlink() or path.parent != folder:
            raise CardFileError("Card path is unsafe")
        return path

    path = manufacturer_root / f"{card_name}.html"
    if path.is_symlink() or path.parent != manufacturer_root:
        raise CardFileError("Card path is unsafe")
    return path


def _atomic_write_text(path: Path, document: str) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as file:
            file.write(document)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def _read_card(path: Path) -> tuple[str, dict[str, Any]]:
    if path.is_symlink() or not path.is_file():
        raise CardNotFound("Card file does not exist")
    try:
        document = path.read_text(encoding="utf-8")
    except OSError as error:
        raise CardFileError("Unable to read card file") from error
    return document, parse_card_document(document)


def _catalog_entry(
    document: str,
    parsed: dict[str, Any],
    source: str,
    writable: bool,
    folder: bool = False,
) -> dict[str, Any]:
    metadata = deepcopy(parsed["metadata"])
    manufacturer = metadata["manufacturer"]
    card_name = metadata["cardName"]
    """
    Only a folder card can ship assets; a single-file card gets an empty base
    so `vuePanel.asset()` can tell the difference and fail loudly.
    """
    asset_base = (
        f"{CARD_ASSET_URL_BASE}/{'local' if writable else 'bundled'}"
        f"/{manufacturer}/{card_name}/"
        if folder
        else ""
    )
    return {
        "assetBase": asset_base,
        **metadata,
        # The picker and the settings dialog translate labels without the document
        "translations": deepcopy(parsed["translations"]),
        "type": f"{manufacturer}/{card_name}",
        "source": source,
        "writable": writable,
        "contentHash": card_content_hash(document),
        "resourceUrl": f"vue-panel-card://{manufacturer}/{card_name}",
        "sizeBytes": len(document.encode("utf-8")),
    }


def _scan_root(root: Path, source: str, writable: bool) -> list[dict[str, Any]]:
    if not root.exists():
        return []
    if root.is_symlink() or not root.is_dir():
        raise CardFileError("Card catalog root is unsafe")
    entries: list[dict[str, Any]] = []
    for manufacturer_root in sorted(root.iterdir(), key=lambda item: item.name):
        if manufacturer_root.is_symlink() or not manufacturer_root.is_dir():
            raise CardFileError("Card catalog contains an unsafe manufacturer entry")
        _validate_identifier(manufacturer_root.name, "Card manufacturer")
        for path in sorted(manufacturer_root.iterdir(), key=lambda item: item.name):
            if path.is_symlink():
                raise CardFileError("Card catalog contains an unsupported entry")
            """
            A card is either `<name>.html` or a `<name>/` folder whose
            `index.html` is the card. Everything else inside such a folder is
            the card's own assets and is not inspected here.
            """
            if path.is_dir():
                card_name = path.name
                document_path = path / CARD_INDEX_FILE
                if document_path.is_symlink() or not document_path.is_file():
                    raise CardFileError("Card folder has no index.html")
            elif path.is_file() and path.suffix == ".html":
                card_name = path.stem
                document_path = path
            else:
                raise CardFileError("Card catalog contains an unsupported entry")
            _validate_identifier(card_name, "Card name")
            document, parsed = _read_card(document_path)
            metadata = parsed["metadata"]
            if metadata["manufacturer"] != manufacturer_root.name or metadata["cardName"] != card_name:
                raise CardFileError("Card metadata does not match its file location")
            entries.append(
                _catalog_entry(document, parsed, source, writable, path.is_dir())
            )
    return entries


def list_cards(private_root: Path, bundled_root: Path) -> list[dict[str, Any]]:
    """Return a validated catalog from managed and editable card roots."""

    cards = _scan_root(bundled_root, "bundled", False)
    cards.extend(_scan_root(private_root / "cards", "local", True))
    types: set[str] = set()
    for card in cards:
        if card["type"] in types:
            raise CardFileError("Card catalog contains a duplicate identity")
        types.add(card["type"])
    return cards


def read_card(
    private_root: Path,
    bundled_root: Path,
    manufacturer: str,
    card_name: str,
) -> dict[str, Any]:
    """Read one managed or editable card by immutable identity."""

    writable = manufacturer != "vue-panel"
    root = private_root / "cards" if writable else bundled_root
    path = _card_path(root, manufacturer, card_name, False)
    document, parsed = _read_card(path)
    metadata = parsed["metadata"]
    if metadata["manufacturer"] != manufacturer or metadata["cardName"] != card_name:
        raise CardFileError("Card metadata does not match its file location")
    return {
        **_catalog_entry(
            document,
            parsed,
            "local" if writable else "bundled",
            writable,
            path.name == CARD_INDEX_FILE,
        ),
        "document": document,
        "html": parsed["html"],
        "css": parsed["css"],
        "javascript": parsed["javascript"],
    }


def _validated_editable_document(document: str) -> tuple[dict[str, Any], str, str]:
    parsed = parse_card_document(document)
    manufacturer = parsed["metadata"]["manufacturer"]
    card_name = parsed["metadata"]["cardName"]
    if manufacturer == "vue-panel":
        raise CardReadOnly("The vue-panel manufacturer is reserved")
    return parsed, manufacturer, card_name


def create_card(private_root: Path, document: str) -> dict[str, Any]:
    """Create a new editable card without overwriting an existing identity."""

    parsed, manufacturer, card_name = _validated_editable_document(document)
    path = _card_path(private_root / "cards", manufacturer, card_name, True)
    if path.exists():
        raise CardAlreadyExists("Card already exists")
    _atomic_write_text(path, document)
    return read_card(private_root, Path(), manufacturer, card_name)


def _backup_card(
    private_root: Path,
    manufacturer: str,
    card_name: str,
    document: str,
) -> None:
    backup_root = private_root / "backups" / "cards" / manufacturer / card_name
    _safe_directory(backup_root, "Card backup directory")
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
    digest = card_content_hash(document)[:12]
    _atomic_write_text(backup_root / f"{timestamp}-{digest}.html", document)
    backups = sorted(backup_root.glob("*.html"), key=lambda item: item.name, reverse=True)
    for expired in backups[CARD_BACKUP_LIMIT:]:
        if expired.is_symlink() or not expired.is_file():
            raise CardFileError("Unsafe card backup entry")
        expired.unlink()


def update_card(
    private_root: Path,
    manufacturer: str,
    card_name: str,
    document: str,
    expected_hash: str,
) -> dict[str, Any]:
    """Update one editable card after an optimistic hash check."""

    if manufacturer == "vue-panel":
        raise CardReadOnly("Managed cards cannot be updated")
    parsed, document_manufacturer, document_card_name = _validated_editable_document(document)
    if document_manufacturer != manufacturer or document_card_name != card_name:
        raise CardFileError("Card identity cannot be changed during update")
    path = _card_path(private_root / "cards", manufacturer, card_name, False)
    current, _ = _read_card(path)
    current_hash = card_content_hash(current)
    if expected_hash != current_hash:
        raise CardRevisionConflict(current_hash)
    _backup_card(private_root, manufacturer, card_name, current)
    _atomic_write_text(path, document)
    return {
        **_catalog_entry(document, parsed, "local", True),
        "document": document,
        "html": parsed["html"],
        "css": parsed["css"],
        "javascript": parsed["javascript"],
    }


def delete_card(
    private_root: Path,
    manufacturer: str,
    card_name: str,
    expected_hash: str,
) -> bool:
    """Back up and delete one editable card after an optimistic hash check."""

    if manufacturer == "vue-panel":
        raise CardReadOnly("Managed cards cannot be deleted")
    path = _card_path(private_root / "cards", manufacturer, card_name, False)
    current, _ = _read_card(path)
    current_hash = card_content_hash(current)
    if expected_hash != current_hash:
        raise CardRevisionConflict(current_hash)
    _backup_card(private_root, manufacturer, card_name, current)
    """
    A folder card owns its assets, so the whole folder goes; a single-file
    card only takes its own document with it.
    """
    if path.name == CARD_INDEX_FILE:
        card_root = path.parent
        shutil.rmtree(card_root)
        manufacturer_root = card_root.parent
    else:
        path.unlink()
        manufacturer_root = path.parent
    if manufacturer_root.is_dir() and not any(manufacturer_root.iterdir()):
        manufacturer_root.rmdir()
    return True


def duplicate_card(
    private_root: Path,
    bundled_root: Path,
    source_manufacturer: str,
    source_card_name: str,
    manufacturer: str,
    card_name: str,
    display_name: str | None = None,
) -> dict[str, Any]:
    """Duplicate any card into a new editable identity."""

    source = read_card(
        private_root,
        bundled_root,
        source_manufacturer,
        source_card_name,
    )
    parsed = {
        "translations": deepcopy(source["translations"]),
        "metadata": {
            key: deepcopy(value)
            for key, value in source.items()
            if key in _METADATA_FIELDS | _OPTIONAL_METADATA_FIELDS
        },
        "html": source["html"],
        "css": source["css"],
        "javascript": source["javascript"],
    }
    parsed["metadata"]["manufacturer"] = manufacturer
    parsed["metadata"]["cardName"] = card_name
    parsed["metadata"]["group"] = manufacturer
    if display_name is not None:
        if not isinstance(display_name, str) or not display_name.strip():
            raise CardFileError("Duplicated card requires a display name")
        parsed["metadata"]["name"] = display_name.strip()
    return create_card(private_root, serialize_card_document(parsed))
