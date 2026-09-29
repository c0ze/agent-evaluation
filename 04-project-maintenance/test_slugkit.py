import unittest
import warnings

from slugkit import normalize_version, slugify

# Versions whose output must not change across the distutils removal.
ORDINARY_VERSIONS = [
    "1.2.0",
    "2.0rc1",
    "0.3.2",
    "1.02",
    "10.0.0",
    "2024.01.15",
    "1.0.post1",
    "1.0.dev3",
    "1.0a1",
    "1.0-beta.2",
    "v1.0",
]


def _legacy_loose_version():
    """Return distutils' LooseVersion if it is importable, else None.

    It is available from the stdlib on Python 3.10/3.11 and, on 3.12+, only
    via the shim that setuptools installs. Importing it can emit a
    deprecation warning, so suppress that here only.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        try:
            from distutils.version import LooseVersion
        except ImportError:
            return None
    return LooseVersion


class SlugifyTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_repeated_punctuation_collapses_to_single_separator(self):
        self.assertEqual(slugify("Hello,,, World!!!"), "hello-world")
        self.assertEqual(slugify("a--b__c..d"), "a-b-c-d")
        self.assertEqual(slugify("--edge--"), "edge")


class NormalizeVersionTests(unittest.TestCase):
    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_ordinary_versions_are_returned_unchanged(self):
        for version in ORDINARY_VERSIONS:
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_no_pep440_rewriting(self):
        # Guards against swapping in packaging.version, which would give "1.2".
        self.assertEqual(normalize_version("1.02"), "1.02")

    def test_matches_legacy_loose_version(self):
        loose_version = _legacy_loose_version()
        if loose_version is None:
            self.skipTest("distutils.version is not importable on this interpreter")
        for version in ORDINARY_VERSIONS:
            with self.subTest(version=version):
                with warnings.catch_warnings():
                    # LooseVersion also warns on construction; the check is
                    # about slugkit, so silence the legacy side only.
                    warnings.simplefilter("ignore", DeprecationWarning)
                    legacy = str(loose_version(version))
                self.assertEqual(normalize_version(version), legacy)

    def test_does_not_emit_deprecation_warning(self):
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            normalize_version("1.2.0")
        self.assertEqual([w for w in caught if issubclass(w.category, DeprecationWarning)], [])

    def test_module_does_not_import_distutils(self):
        import slugkit

        self.assertNotIn("distutils", vars(slugkit))
        self.assertNotIn("LooseVersion", vars(slugkit))

    def test_empty_string_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize_version("")

    def test_non_string_is_rejected(self):
        for value in (None, 1, 1.2, b"1.2"):
            with self.subTest(value=value), self.assertRaises(TypeError):
                normalize_version(value)


if __name__ == "__main__":
    unittest.main()
