import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_collapses_repeated_punctuation(self):
        self.assertEqual(slugify("Hello...?!___World"), "hello-world")

    def test_normalize_version_preserves_original_spelling(self):
        for version in ("1.2.0", "2.0rc1", "01.02.003", "2.0-rc.1", "2.0+Build.5"):
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)


if __name__ == "__main__":
    unittest.main()

